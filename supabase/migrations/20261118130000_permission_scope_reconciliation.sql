-- Phase 2: compare the legacy grant model with the additive governance model.
-- This does not change can_read/can_write, RLS policies, RPC behavior or the UI.
-- Installation aborts if any current or historical grant holder has unexplained
-- role, Active/Inactive, or effective-centre drift.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE FUNCTION mass_core.permission_scope_reconciliation()
RETURNS TABLE(
 user_id uuid,
 legacy_role text,
 governed_role text,
 legacy_active boolean,
 governed_active boolean,
 missing_governed_centres uuid[],
 unexpected_governed_centres uuid[],
 reconciled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH subjects AS(
  SELECT g.user_id FROM mass_core.user_scope_grants g
  UNION
  SELECT u.user_id FROM mass_core.application_users u
 ), legacy_ranked AS(
  SELECT g.user_id,g.role_code,g.verified_at,g.id,
   (g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)) AS active,
   CASE g.role_code WHEN 'Leadership' THEN 3 WHEN 'Cluster Officer' THEN 2 ELSE 1 END AS role_rank
  FROM mass_core.user_scope_grants g
 ), legacy_role AS(
  SELECT DISTINCT ON(r.user_id) r.user_id,r.role_code
  FROM legacy_ranked r
  ORDER BY r.user_id,r.active DESC,r.role_rank DESC,r.verified_at DESC,r.id
 ), legacy AS(
  SELECT s.user_id,lr.role_code,
   EXISTS(SELECT 1 FROM legacy_ranked r WHERE r.user_id=s.user_id AND r.active) AS active,
   coalesce(ARRAY(
    SELECT DISTINCT g.centre_id FROM mass_core.user_scope_grants g
    WHERE g.user_id=s.user_id AND g.starts_at<=statement_timestamp()
     AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)
    ORDER BY g.centre_id
   ),ARRAY[]::uuid[]) AS centres
  FROM subjects s LEFT JOIN legacy_role lr USING(user_id)
 ), governed AS(
  SELECT s.user_id,u.role_code,(u.status='Active') AS active,
   CASE
    WHEN u.status<>'Active' OR u.user_id IS NULL THEN ARRAY[]::uuid[]
    WHEN u.role_code='Leadership' THEN coalesce(ARRAY(SELECT c.id FROM mass_core.centres c ORDER BY c.id),ARRAY[]::uuid[])
    ELSE coalesce(ARRAY(
     SELECT a.centre_id FROM mass_core.user_centre_assignments a
     WHERE a.user_id=s.user_id AND a.status='Active' ORDER BY a.centre_id
    ),ARRAY[]::uuid[])
   END AS centres
  FROM subjects s LEFT JOIN mass_core.application_users u USING(user_id)
 ), compared AS(
  SELECT l.user_id,l.role_code AS legacy_role,g.role_code AS governed_role,l.active AS legacy_active,g.active AS governed_active,
   ARRAY(SELECT unnest(l.centres) EXCEPT SELECT unnest(g.centres) ORDER BY 1) AS missing_centres,
   ARRAY(SELECT unnest(g.centres) EXCEPT SELECT unnest(l.centres) ORDER BY 1) AS unexpected_centres
  FROM legacy l JOIN governed g USING(user_id)
 )
 SELECT c.user_id,c.legacy_role,c.governed_role,c.legacy_active,c.governed_active,
  c.missing_centres,c.unexpected_centres,
  c.legacy_role IS NOT DISTINCT FROM c.governed_role
   AND c.legacy_active IS NOT DISTINCT FROM c.governed_active
   AND cardinality(c.missing_centres)=0 AND cardinality(c.unexpected_centres)=0 AS reconciled
 FROM compared c
 ORDER BY c.user_id
$$;

CREATE FUNCTION mass_core.permission_scope_reconciliation_summary() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
  'users',count(*),
  'reconciled',count(*) FILTER(WHERE r.reconciled),
  'mismatches',count(*) FILTER(WHERE NOT r.reconciled),
  'role_mismatches',count(*) FILTER(WHERE r.legacy_role IS DISTINCT FROM r.governed_role),
  'status_mismatches',count(*) FILTER(WHERE r.legacy_active IS DISTINCT FROM r.governed_active),
  'missing_centre_links',coalesce(sum(cardinality(r.missing_governed_centres)),0),
  'unexpected_centre_links',coalesce(sum(cardinality(r.unexpected_governed_centres)),0)
 ) FROM mass_core.permission_scope_reconciliation() r
$$;

CREATE FUNCTION mass_core.assert_permission_scope_reconciled() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE mismatch_count bigint;
BEGIN
 SELECT count(*) INTO mismatch_count FROM mass_core.permission_scope_reconciliation() r WHERE NOT r.reconciled;
 IF mismatch_count>0 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='permission governance scope reconciliation failed',DETAIL=mismatch_count||' user record(s) differ';
 END IF;
END;
$$;

REVOKE ALL ON FUNCTION mass_core.permission_scope_reconciliation(),mass_core.permission_scope_reconciliation_summary(),mass_core.assert_permission_scope_reconciled() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_core.permission_scope_reconciliation(),mass_core.permission_scope_reconciliation_summary(),mass_core.assert_permission_scope_reconciled() TO mass_core_admin;

SELECT mass_core.assert_permission_scope_reconciled();
NOTIFY pgrst,'reload schema';
COMMIT;
