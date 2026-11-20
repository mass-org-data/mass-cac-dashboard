-- Phase 3: make the explicit governance model authoritative for reads.
-- Writes retain the legacy role/override rules until Phase 4, but are intersected
-- with active governed user/centre scope so an inactive user or assignment can
-- never retain a write-only path.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

SELECT mass_core.assert_permission_scope_reconciled();

-- These private helpers must also work while an authenticated RPC is executing
-- as its SECURITY DEFINER owner. Authentication is enforced by the RPC or RLS
-- entry point and by EXECUTE grants; requiring current role='authenticated'
-- here would make forced-RLS owner policies silently see no governed scope.
CREATE OR REPLACE FUNCTION mass_core.application_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.role_code FROM mass_core.application_users u
 WHERE u.user_id=mass_core.request_user_id() AND u.status='Active'
$$;
CREATE OR REPLACE FUNCTION mass_core.governed_can_read(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(
  SELECT 1 FROM mass_core.application_users u
  WHERE u.user_id=mass_core.request_user_id() AND u.status='Active'
   AND (u.role_code='Leadership' OR EXISTS(
    SELECT 1 FROM mass_core.user_centre_assignments a
    WHERE a.user_id=u.user_id AND a.centre_id=c AND a.status='Active')))
$$;
REVOKE ALL ON FUNCTION mass_core.application_role(),mass_core.governed_can_read(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_core.application_role(),mass_core.governed_can_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION mass_core.role_at_least(required_role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE mass_core.application_role()
  WHEN 'Leadership' THEN 3 WHEN 'Cluster Officer' THEN 2 WHEN 'Teacher' THEN 1 ELSE 0 END
 >= CASE required_role
  WHEN 'Leadership' THEN 3 WHEN 'Cluster Officer' THEN 2 WHEN 'Teacher' THEN 1 ELSE 2147483647 END
$$;
REVOKE ALL ON FUNCTION mass_core.role_at_least(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_core.role_at_least(text) TO authenticated;

CREATE OR REPLACE FUNCTION mass_core.can_read(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.governed_can_read(c)
$$;

-- Do not broaden writes in the read phase. Existing legacy write rules remain,
-- but active governed status/scope is now a mandatory fail-closed intersection.
CREATE OR REPLACE FUNCTION mass_core.can_write(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.governed_can_read(c)
 AND EXISTS(
  SELECT 1 FROM mass_core.user_scope_grants g
  WHERE g.user_id=mass_core.request_user_id() AND g.centre_id=c
   AND g.role_code IN ('Teacher','Cluster Officer')
   AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
 AND (mass_core.staff_operational_enabled() OR NOT EXISTS(
  SELECT 1 FROM mass_core.user_scope_grants g
  WHERE g.user_id=mass_core.request_user_id() AND g.role_code='Leadership'
   AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)))
$$;

-- Profile visibility used to double as the profile-correction capability. Keep
-- the old, narrower write entitlement private until Phase 4 replaces writes;
-- otherwise this read cutover would silently grant new corrections.
CREATE OR REPLACE FUNCTION mass_core.can_write_profile(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.can_write_child(c)
 AND EXISTS(
  SELECT 1 FROM mass_core.enrolments e JOIN mass_core.user_scope_grants g ON g.centre_id=e.centre_id
  WHERE e.child_id=c AND g.user_id=mass_core.request_user_id() AND g.can_read_profiles
   AND g.role_code IN ('Teacher','Cluster Officer') AND g.starts_at<=statement_timestamp()
   AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
 AND NOT EXISTS(
  SELECT 1 FROM mass_core.user_scope_grants g
  WHERE g.user_id=mass_core.request_user_id() AND g.role_code='Leadership'
   AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
$$;
REVOKE ALL ON FUNCTION mass_core.can_write_profile(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION mass_core.can_read_child(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE mass_core.application_role()
  WHEN 'Leadership' THEN EXISTS(SELECT 1 FROM mass_core.children ch WHERE ch.id=c)
  WHEN 'Cluster Officer' THEN EXISTS(
   SELECT 1 FROM mass_core.enrolments e WHERE e.child_id=c AND mass_core.can_read(e.centre_id)
    AND e.starts_on<=(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
    AND (e.ends_before IS NULL OR (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date<e.ends_before))
  WHEN 'Teacher' THEN EXISTS(
   SELECT 1 FROM mass_core.enrolments e WHERE e.child_id=c AND mass_core.can_read(e.centre_id)
    AND e.starts_on<=(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
    AND (e.ends_before IS NULL OR (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date<e.ends_before))
  ELSE false END
$$;

CREATE OR REPLACE FUNCTION mass_core.can_read_profile(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.can_read_child(c)
$$;

CREATE OR REPLACE FUNCTION mass_api.correct_profile(p_child uuid,p_expected bigint,p_name text,p_gender text,p_board boolean) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.private_child_profiles;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid profile fields required';END IF;
 IF NOT mass_core.can_write_profile(p_child) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='profile correction capability required'; END IF;
 SELECT * INTO r FROM mass_core.private_child_profiles WHERE child_id=p_child FOR UPDATE;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='profile not found'; END IF;
 UPDATE mass_core.private_child_profiles SET full_name=p_name,gender_code=p_gender,class10_board_passed=p_board WHERE id=r.id RETURNING row_version INTO p_expected;
 RETURN p_expected;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.get_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE subject uuid:=mass_core.request_user_id(); app_role text; result jsonb;
BEGIN
 IF current_setting('role')<>'authenticated' OR subject IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required';
 END IF;
 app_role:=mass_core.application_role();
 IF app_role IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='active application user required';END IF;
 SELECT jsonb_build_object(
  'api_version','governed-reads-v1','authorization_model','single-role-v1','user_id',subject,
  'role',app_role,'roles',jsonb_build_array(app_role),'status','Active',
  'capabilities',jsonb_build_object(
   'read_operational',true,'write_operational',coalesce(bool_or(mass_core.can_write(c.id)),false),
   'read_profiles',true,'read_visits',mass_core.role_at_least('Cluster Officer'),
   'export',app_role='Leadership','manage_users',app_role='Leadership'),
  'operational_roles_enabled',mass_core.staff_operational_enabled(),
  'centres',coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'label',c.label,'roles',jsonb_build_array(app_role),
   'can_write',mass_core.can_write(c.id),'can_read_profiles',true) ORDER BY c.label,c.id),'[]'::jsonb)
 ) INTO result
 FROM mass_core.centres c WHERE mass_core.can_read(c.id);
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION mass_api.get_context() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.get_context() TO authenticated;

CREATE OR REPLACE FUNCTION mass_api.read_students(p_centre uuid,p_on date DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(child_id uuid,student_id text,enrolment_id uuid,grade_label text,shift_code text,starts_on date,ends_before date,status_code text,row_version bigint,full_name text,gender_code text,class10_board_passed boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE effective_on date;
BEGIN
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset);
 effective_on:=CASE WHEN mass_core.application_role()='Leadership' THEN p_on ELSE (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date END;
 RETURN QUERY SELECT c.id,c.student_id,e.id,e.grade_label,e.shift_code,e.starts_on,e.ends_before,e.status_code,e.row_version,p.full_name,p.gender_code,p.class10_board_passed
 FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id
 LEFT JOIN mass_core.private_child_profiles p ON p.child_id=c.id
 WHERE e.centre_id=p_centre AND (effective_on IS NULL OR (effective_on>=e.starts_on AND (e.ends_before IS NULL OR effective_on<e.ends_before)))
  AND mass_core.can_read_profile(e.child_id)
 ORDER BY e.child_id,e.starts_on,e.id LIMIT p_limit OFFSET p_offset;
END;
$$;

DO $profile_cutover$
BEGIN
 IF to_regprocedure('mass_api.student_profile_page(uuid[],date,text,text,text,text,text,integer,integer,text)') IS NOT NULL THEN
  EXECUTE $profile_function$
CREATE OR REPLACE FUNCTION mass_api.student_profile_page(p_centres uuid[],p_on date,p_query text DEFAULT '',p_sort text DEFAULT 'name',p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 10,p_id_query text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE c uuid; value jsonb;effective_on date;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_on IS NULL OR p_on>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_query IS NULL OR length(p_query)>160 OR p_id_query IS NULL OR length(p_id_query)>160 OR p_sort IS NULL OR p_sort NOT IN ('name','id','centre','grade','gender','shift','newest') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded profile selection required'; END IF;
 FOREACH c IN ARRAY p_centres LOOP
  IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned profile scope required';END IF;
 END LOOP;
 effective_on:=CASE WHEN mass_core.application_role()='Leadership' THEN p_on ELSE (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date END;
 WITH roster AS (
  SELECT e.id,e.grade_label,e.shift_code,e.starts_on,ch.student_id,co.label centre_name,pr.full_name student_name,pr.gender_code gender
  FROM mass_core.enrolments e JOIN mass_core.children ch ON ch.id=e.child_id JOIN mass_core.centres co ON co.id=e.centre_id
  JOIN mass_core.private_child_profiles pr ON pr.child_id=ch.id
  WHERE e.centre_id=ANY(p_centres) AND e.starts_on<=effective_on AND (e.ends_before IS NULL OR effective_on<e.ends_before)
   AND mass_core.can_read_profile(ch.id)
 ), matching AS (
  SELECT * FROM roster WHERE (p_grade IS NULL OR grade_label=p_grade) AND (p_shift IS NULL OR shift_code=p_shift)
   AND (p_gender IS NULL OR coalesce(gender,'Unknown')=p_gender)
   AND (p_id_query='' OR position(lower(btrim(p_id_query)) IN lower(student_id))>0)
   AND (p_query='' OR position(lower(btrim(p_query)) IN lower(concat_ws(' ',student_name,student_id,centre_name)))>0)
 ), ranked AS (
  SELECT id,row_number() OVER(ORDER BY
   CASE WHEN p_sort='id' THEN student_id END,
   CASE WHEN p_sort='centre' THEN lower(centre_name) END,
   CASE WHEN p_sort='grade' THEN grade_label::integer END,
   CASE WHEN p_sort='gender' THEN coalesce(gender,'') END,
   CASE WHEN p_sort='shift' THEN shift_code END,
   CASE WHEN p_sort='newest' THEN starts_on END DESC,
   lower(student_name),student_id,id) ordinal FROM matching
 ) SELECT jsonb_build_object('total',(SELECT count(*) FROM matching),'ids',coalesce((SELECT jsonb_agg(id ORDER BY ordinal) FROM (SELECT * FROM ranked ORDER BY ordinal LIMIT p_limit OFFSET p_offset) page),'[]'::jsonb)) INTO value;
 RETURN value;
END;
$body$;
$profile_function$;
 END IF;
END;
$profile_cutover$;

CREATE OR REPLACE FUNCTION mass_api.read_attendance_register(p_centre uuid,p_shift text,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE roster jsonb; marks jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centre IS NULL OR NOT mass_core.can_read(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned read scope required';END IF;
 IF p_date IS NULL OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='observed date and shift required';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'student_id',c.student_id,'name',p.full_name,'grade',e.grade_label) ORDER BY c.student_id,e.id),'[]'::jsonb) INTO roster
 FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.centre_id=p_centre AND e.shift_code=p_shift AND e.starts_on<=p_date AND (e.ends_before IS NULL OR p_date<e.ends_before)
  AND mass_core.can_read_profile(e.child_id);
 marks:=mass_core.attendance_register_snapshot(p_centre,p_shift,p_date);
 RETURN jsonb_build_object('roster',roster,'marks',(SELECT coalesce(jsonb_agg(jsonb_build_object('enrolment',x->>'enrolment_id','code',x->>'code','version',x->'row_version')),'[]'::jsonb) FROM jsonb_array_elements(marks) x),'token',md5(marks::text),'recorded',jsonb_array_length(marks));
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.read_visits(p_centre uuid,p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS SETOF mass_core.cluster_officer_visits LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.role_at_least('Cluster Officer') OR NOT mass_core.can_read(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer visit scope required';END IF;
 IF p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>366 OR p_limit NOT BETWEEN 1 AND 100 OR p_offset NOT BETWEEN 0 AND 100000 OR p_limit IS NULL OR p_offset IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded visit window required'; END IF;
 RETURN QUERY SELECT * FROM mass_core.cluster_officer_visits v WHERE v.centre_id=p_centre AND v.visit_date>=p_from AND v.visit_date<p_until ORDER BY v.visit_date,v.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.read_visits_v2(p_centres uuid[],p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS SETOF mass_core.cluster_officer_visits LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>366 OR p_limit IS NULL OR p_offset IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded visit window required'; END IF;
 IF NOT mass_core.role_at_least('Cluster Officer') OR p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer visit scope required'; END IF;
 RETURN QUERY SELECT v.* FROM mass_core.cluster_officer_visits v WHERE v.centre_id=ANY(p_centres) AND v.visit_date>=p_from AND v.visit_date<p_until ORDER BY v.visit_date,v.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.read_visit_history(p_visit uuid) RETURNS SETOF mass_core.visit_revisions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.role_at_least('Cluster Officer') OR NOT EXISTS(SELECT 1 FROM mass_core.cluster_officer_visits v WHERE v.id=p_visit AND mass_core.can_read(v.centre_id)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer history scope required'; END IF;
 RETURN QUERY SELECT * FROM mass_core.visit_revisions WHERE visit_id=p_visit ORDER BY revision;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.morarji_followup(p_centres uuid[],p_cohort uuid DEFAULT NULL,p_limit integer DEFAULT 500,p_offset integer DEFAULT 0)
RETURNS TABLE(membership_id uuid,cohort_id uuid,child_id uuid,enrolment_id uuid,centre_id uuid,shift_code text,outcome_id uuid,applied boolean,attended boolean,passed boolean,school_name text,row_version bigint,student_id text,full_name text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_user<>'authenticated' OR mass_core.request_user_id() IS NULL OR p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100
  OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid pagination'; END IF;
 RETURN QUERY SELECT m.id,m.cohort_id,m.child_id,m.enrolment_id,m.centre_id,m.shift_code,o.id,o.applied,o.attended,o.passed,o.school_name,o.row_version,c.student_id,p.full_name
 FROM mass_core.cohort_memberships m LEFT JOIN mass_core.morarji_outcomes o ON o.membership_id=m.id AND o.centre_id=m.centre_id
 JOIN mass_core.children c ON c.id=m.child_id JOIN mass_core.private_child_profiles p ON p.child_id=m.child_id
 WHERE m.centre_id=ANY(p_centres) AND mass_core.can_read_profile(m.child_id) AND (p_cohort IS NULL OR m.cohort_id=p_cohort)
 ORDER BY m.centre_id,m.cohort_id,m.child_id,m.id LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Patch the large reviewed paging function in place, aborting if its reviewed
-- source no longer matches. Visit detail becomes CO-or-higher and centre-scoped;
-- Morarji identity rows require current profile visibility.
DO $pages$
DECLARE definition text;updated text;
BEGIN
 definition:=pg_get_functiondef('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)'::regprocedure);
 IF position($$IF p_sort NOT IN ('date','centre','shift','status','feedback','next') OR EXISTS(SELECT 1 FROM unnest(p_centres)x WHERE NOT mass_core.can_record_visit(x)) THEN$$ IN definition)>0
  AND position($$v.centre_id=ANY(p_centres) AND v.created_by=mass_core.request_user_id() AND v.visit_date>=from_date$$ IN definition)>0
  AND position($$WHERE m.centre_id=ANY(p_centres) AND m.cohort_id=cohort_filter),filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR coalesce(name,'Name not recorded')$$ IN definition)>0 THEN
  updated:=replace(definition,
   $$IF p_sort NOT IN ('date','centre','shift','status','feedback','next') OR EXISTS(SELECT 1 FROM unnest(p_centres)x WHERE NOT mass_core.can_record_visit(x)) THEN$$,
   $$IF p_sort NOT IN ('date','centre','shift','status','feedback','next') OR NOT mass_core.role_at_least('Cluster Officer') THEN$$);
  updated:=replace(updated,$$v.centre_id=ANY(p_centres) AND v.created_by=mass_core.request_user_id() AND v.visit_date>=from_date$$,$$v.centre_id=ANY(p_centres) AND v.visit_date>=from_date$$);
  updated:=replace(updated,$$WHERE m.centre_id=ANY(p_centres) AND m.cohort_id=cohort_filter),filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR coalesce(name,'Name not recorded')$$,$$WHERE m.centre_id=ANY(p_centres) AND m.cohort_id=cohort_filter AND mass_core.can_read_profile(m.child_id)),filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR coalesce(name,'Name not recorded')$$);
  IF updated=definition OR position('v.created_by=mass_core.request_user_id()' IN updated)>0 OR position('mass_core.can_read_profile(m.child_id)' IN updated)=0 THEN RAISE EXCEPTION 'Dashboard read authorization patch failed';END IF;
  EXECUTE updated;
 ELSIF position($$NOT mass_core.role_at_least('Cluster Officer')$$ IN definition)=0
  OR position('v.created_by=mass_core.request_user_id()' IN definition)>0
  OR position('mass_core.can_read_profile(m.child_id)' IN definition)=0 THEN
  RAISE EXCEPTION 'Unrecognized dashboard read authorization source';
 END IF;
END;
$pages$;

-- visit_coverage is aggregate/detail support for the Visits screen. Teachers do
-- not inherit the Cluster Officer visit capability.
DO $coverage$
DECLARE definition text;updated text;
BEGIN
 definition:=pg_get_functiondef('mass_api.visit_coverage(uuid[],date,date,uuid)'::regprocedure);
 IF position('PERFORM mass_core.require_staff_session();' IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized visit coverage source';END IF;
 IF position($$mass_core.role_at_least('Cluster Officer')$$ IN definition)=0 THEN
  updated:=replace(definition,'PERFORM mass_core.require_staff_session();','PERFORM mass_core.require_staff_session();'||E'\n IF NOT mass_core.role_at_least(''Cluster Officer'') THEN RAISE EXCEPTION USING ERRCODE=''42501'',MESSAGE=''officer visit scope required'';END IF;');
  EXECUTE updated;
 END IF;
END;
$coverage$;

REVOKE ALL ON FUNCTION mass_core.role_at_least(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_core.role_at_least(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
