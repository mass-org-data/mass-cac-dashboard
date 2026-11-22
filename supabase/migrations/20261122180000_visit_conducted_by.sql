-- Visits: "Conducted by". Stored on mass_core.cluster_officer_visits.conducted_by (a governed application user). A new visit may name
-- any active Leadership user or an active Cluster Officer assigned to that centre; when omitted it defaults to the recording user.
-- Existing visits keep NULL (shown as unknown, never guessed). The column is set once at creation (guard_visit already keeps every
-- other column immutable on correction).
-- 1. column  2. mass_api.visit_conductors (scoped choices)  3. record_visit gains p_conducted_by (old signature replaced; reads of the
-- table return the new column through SETOF). Run supabase/activation/seal.sql in the same transaction.
-- Rollback: drop the column only while it is empty or accept losing the field; restore the previous record_visit text, then seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
ALTER TABLE mass_core.cluster_officer_visits ADD COLUMN IF NOT EXISTS conducted_by uuid REFERENCES mass_core.application_users(user_id) ON DELETE RESTRICT;

CREATE FUNCTION mass_api.visit_conductors(p_centres uuid[]) RETURNS TABLE(user_id uuid,centre_id uuid,role_code text,label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded visit scope required'; END IF;
 FOREACH c IN ARRAY p_centres LOOP
  IF c IS NULL OR NOT mass_core.can_record_visit(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer detail scope required'; END IF;
 END LOOP;
 RETURN QUERY
 SELECT u.user_id,NULL::uuid,u.role_code,coalesce((SELECT min(s.display_name) FROM mass_core.staff_members s WHERE s.auth_user_id=u.user_id),'Leadership account '||left(md5(u.user_id::text),8))
 FROM mass_core.application_users u WHERE u.role_code='Leadership' AND u.status='Active'
 UNION ALL
 SELECT u.user_id,a.centre_id,u.role_code,coalesce((SELECT min(s.display_name) FROM mass_core.staff_members s WHERE s.auth_user_id=u.user_id),'Cluster Officer account '||left(md5(u.user_id::text),8))
 FROM mass_core.user_centre_assignments a JOIN mass_core.application_users u ON u.user_id=a.user_id AND u.role_code='Cluster Officer' AND u.status='Active'
 WHERE a.centre_id=ANY(p_centres) AND a.status='Active';
END;$$;
REVOKE ALL ON FUNCTION mass_api.visit_conductors(uuid[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.visit_conductors(uuid[]) TO authenticated;

DO $rv$
DECLARE d text; f regprocedure:=to_regprocedure('mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text)');
 sig text:='p_reason text DEFAULT NULL::text)';
 i1 text:='created_by,last_updated_by)'||chr(10)||'  VALUES(p_id,p_assignment,c,officer,p_shift,p_date,p_status,p_feedback,p_next_action,mass_core.request_user_id(),mass_core.request_user_id())';
 v1 text:='verified officer scope required''; END IF;';
BEGIN
 IF f IS NULL THEN RAISE EXCEPTION 'record_visit is not installed'; END IF;
 d:=pg_get_functiondef(f);
 IF position(sig IN d)=0 OR position(v1 IN d)=0 OR position('created_by,last_updated_by)' IN d)=0 OR position('p_next_action,mass_core.request_user_id(),mass_core.request_user_id())' IN d)=0 THEN
  RAISE EXCEPTION 'Unexpected record_visit body; review before installation';
 END IF;
 d:=replace(d,sig,'p_reason text DEFAULT NULL::text,p_conducted_by uuid DEFAULT NULL::uuid)');
 d:=replace(d,v1,v1||chr(10)||' IF old.id IS NULL AND p_conducted_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mass_api.visit_conductors(ARRAY[c]) x WHERE x.user_id=p_conducted_by) THEN RAISE EXCEPTION USING ERRCODE=''42501'',MESSAGE=''visit conductor must be Leadership or the centre Cluster Officer''; END IF;');
 d:=replace(d,'created_by,last_updated_by)','created_by,last_updated_by,conducted_by)');
 d:=replace(d,'p_next_action,mass_core.request_user_id(),mass_core.request_user_id())','p_next_action,mass_core.request_user_id(),mass_core.request_user_id(),coalesce(p_conducted_by,mass_core.request_user_id()))');
 DROP FUNCTION mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text);
 EXECUTE d;
END;$rv$;
REVOKE ALL ON FUNCTION mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
