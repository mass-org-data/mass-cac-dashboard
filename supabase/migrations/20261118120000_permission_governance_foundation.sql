-- Permission-governance foundation. This migration is deliberately additive:
-- existing user_scope_grants remain authoritative until every dependent RPC,
-- policy and client has moved to this model in a later reviewed migration.
--
-- The backfill chooses one role per Auth user using the approved hierarchy
-- Leadership > Cluster Officer > Teacher. Active authorization is represented
-- by explicit status values; starts_at/ends_at remain administrative history.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE TABLE mass_core.application_users(
 user_id uuid PRIMARY KEY,
 role_code text NOT NULL CHECK(role_code IN ('Teacher','Cluster Officer','Leadership')),
 status text NOT NULL CHECK(status IN ('Active','Inactive')),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz CHECK(ends_at IS NULL OR ends_at>starts_at),
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 1 AND 200),
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL,
 row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0)
);

CREATE TABLE mass_core.user_centre_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES mass_core.application_users(user_id) ON DELETE RESTRICT,
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('Active','Inactive')),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz CHECK(ends_at IS NULL OR ends_at>starts_at),
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 1 AND 200),
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL,
 row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),
 UNIQUE(user_id,centre_id,starts_at)
);

RESET ROLE;
ALTER TABLE mass_core.application_users
 ADD CONSTRAINT application_users_user_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
 ADD CONSTRAINT application_users_approver_fkey FOREIGN KEY(approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE mass_core.user_centre_assignments
 ADD CONSTRAINT user_centre_assignments_approver_fkey FOREIGN KEY(approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

SET LOCAL ROLE mass_core_owner;
CREATE UNIQUE INDEX one_active_centre_assignment
 ON mass_core.user_centre_assignments(user_id,centre_id) WHERE status='Active';
CREATE INDEX active_centre_assignment_lookup
 ON mass_core.user_centre_assignments(user_id,centre_id) WHERE status='Active';
CREATE INDEX centre_assignment_administration
 ON mass_core.user_centre_assignments(centre_id,status,user_id);

ALTER TABLE mass_core.application_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.application_users FORCE ROW LEVEL SECURITY;
ALTER TABLE mass_core.user_centre_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.user_centre_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.application_users TO mass_core_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_access ON mass_core.user_centre_assignments TO mass_core_owner USING(true) WITH CHECK(true);
CREATE POLICY admin_access ON mass_core.application_users TO mass_core_admin USING(true) WITH CHECK(true);
CREATE POLICY admin_access ON mass_core.user_centre_assignments TO mass_core_admin USING(true) WITH CHECK(true);
REVOKE ALL ON mass_core.application_users,mass_core.user_centre_assignments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON mass_core.application_users,mass_core.user_centre_assignments TO mass_core_admin;

CREATE FUNCTION mass_core.guard_centre_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE account mass_core.application_users; other_active bigint;
BEGIN
 SELECT * INTO account FROM mass_core.application_users WHERE user_id=NEW.user_id FOR SHARE;
 IF account.user_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='application user required';
 END IF;
 IF NEW.status='Active' THEN
  IF account.status<>'Active' THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='active centre assignment requires active user';
  END IF;
  IF account.role_code='Leadership' THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Leadership receives global scope without centre assignments';
  END IF;
  IF account.role_code='Teacher' THEN
   SELECT count(*) INTO other_active FROM mass_core.user_centre_assignments a
   WHERE a.user_id=NEW.user_id AND a.status='Active' AND (TG_OP='INSERT' OR a.id<>NEW.id);
   IF other_active>0 THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Teacher may have only one active centre assignment';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mass_core.guard_centre_assignment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER validate_assignment BEFORE INSERT OR UPDATE ON mass_core.user_centre_assignments
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_centre_assignment();

-- Backfill every historical grant holder, but use explicit status (not dates)
-- for the new model's authorization state.
WITH ranked AS(
 SELECT g.*,
  (g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)) AS currently_active,
  CASE g.role_code WHEN 'Leadership' THEN 3 WHEN 'Cluster Officer' THEN 2 ELSE 1 END AS role_rank
 FROM mass_core.user_scope_grants g
), selected AS(
 SELECT DISTINCT ON(user_id) user_id,role_code
 FROM ranked
 ORDER BY user_id,currently_active DESC,role_rank DESC,verified_at DESC,id
), history AS(
 SELECT r.user_id,s.role_code,
  CASE WHEN bool_or(r.currently_active) THEN 'Active' ELSE 'Inactive' END AS status,
  min(r.starts_at) AS starts_at,
  CASE WHEN bool_or(r.currently_active) THEN NULL ELSE max(r.ends_at) END AS ends_at,
  (array_agg(r.verified_by ORDER BY r.verified_at DESC,r.id))[1] AS approved_by,
  max(r.verified_at) AS approved_at
 FROM ranked r JOIN selected s USING(user_id)
 GROUP BY r.user_id,s.role_code
)
INSERT INTO mass_core.application_users(user_id,role_code,status,starts_at,ends_at,approval_reference,approved_by,approved_at)
SELECT user_id,role_code,status,starts_at,ends_at,'Legacy user_scope_grants backfill 2026-11-18',approved_by,approved_at
FROM history;

WITH grants AS(
 SELECT g.*,
  (g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)) AS currently_active
 FROM mass_core.user_scope_grants g
), grouped AS(
 SELECT g.user_id,g.centre_id,
  CASE WHEN u.status='Active' AND bool_or(g.currently_active) THEN 'Active' ELSE 'Inactive' END AS status,
  min(g.starts_at) AS starts_at,
  CASE WHEN u.status='Active' AND bool_or(g.currently_active) THEN NULL ELSE max(g.ends_at) END AS ends_at,
  (array_agg(g.verified_by ORDER BY g.verified_at DESC,g.id))[1] AS approved_by,
  max(g.verified_at) AS approved_at
 FROM grants g JOIN mass_core.application_users u USING(user_id)
 WHERE u.role_code<>'Leadership'
 GROUP BY g.user_id,g.centre_id,u.status
)
INSERT INTO mass_core.user_centre_assignments(user_id,centre_id,status,starts_at,ends_at,approval_reference,approved_by,approved_at)
SELECT user_id,centre_id,status,starts_at,ends_at,'Legacy user_scope_grants backfill 2026-11-18',approved_by,approved_at
FROM grouped;

CREATE FUNCTION mass_core.application_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.role_code FROM mass_core.application_users u
 WHERE current_setting('role')='authenticated' AND u.user_id=mass_core.request_user_id() AND u.status='Active'
$$;
CREATE FUNCTION mass_core.governed_can_read(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(
  SELECT 1 FROM mass_core.application_users u
  WHERE current_setting('role')='authenticated' AND u.user_id=mass_core.request_user_id() AND u.status='Active'
   AND (u.role_code='Leadership' OR EXISTS(
    SELECT 1 FROM mass_core.user_centre_assignments a
    WHERE a.user_id=u.user_id AND a.centre_id=c AND a.status='Active')))
$$;
CREATE FUNCTION mass_core.governed_can_write(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.governed_can_read(c)
$$;
CREATE FUNCTION mass_core.governed_can_manage_users() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.application_role()='Leadership'
$$;
REVOKE ALL ON FUNCTION mass_core.application_role(),mass_core.governed_can_read(uuid),mass_core.governed_can_write(uuid),mass_core.governed_can_manage_users() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_core.application_role(),mass_core.governed_can_read(uuid),mass_core.governed_can_write(uuid),mass_core.governed_can_manage_users() TO authenticated;

DO $validate$
BEGIN
 IF EXISTS(
  SELECT 1 FROM mass_core.application_users u
  JOIN mass_core.user_centre_assignments a ON a.user_id=u.user_id AND a.status='Active'
  WHERE u.role_code='Leadership') THEN
  RAISE EXCEPTION 'Leadership backfill unexpectedly created centre assignments';
 END IF;
 IF EXISTS(
  SELECT 1 FROM mass_core.application_users u
  JOIN mass_core.user_centre_assignments a ON a.user_id=u.user_id AND a.status='Active'
  WHERE u.role_code='Teacher' GROUP BY u.user_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Teacher backfill requires centre resolution';
 END IF;
END;
$validate$;

NOTIFY pgrst,'reload schema';
COMMIT;
