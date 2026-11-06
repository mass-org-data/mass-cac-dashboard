-- PROPOSAL ONLY: separately reviewed before moving to supabase/migrations.
-- Apply AFTER the unchanged 15 production migrations in isolated tests only.
-- Adds no tables, real staff grants/accounts or source records. Adds one narrow
-- self-discovery SELECT policy; all 71 baseline policies remain unchanged.
BEGIN;
SET LOCAL ROLE mass_core_owner;

CREATE FUNCTION mass_core.require_read_scope(p_centre uuid,p_limit integer,p_offset integer,p_from date DEFAULT NULL,p_until date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_user<>'authenticated' OR mass_core.request_user_id() IS NULL OR p_centre IS NULL OR NOT mass_core.can_read(p_centre) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid pagination'; END IF;
 IF (p_from IS NULL)<>(p_until IS NULL) OR (p_from IS NOT NULL AND (p_until<=p_from OR p_until-p_from>366)) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid bounded reporting window'; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_core.require_read_scope(uuid,integer,integer,date,date) TO authenticated;

-- Minimum column rights for an invoker-only context RPC. No full-table SELECT,
-- verifier metadata, mutation rights or private-schema API exposure is granted.
CREATE POLICY self_scope_discovery ON mass_core.user_scope_grants FOR SELECT TO authenticated
 USING(current_user='authenticated' AND user_id=mass_core.request_user_id()
  AND starts_at<=statement_timestamp() AND (ends_at IS NULL OR statement_timestamp()<ends_at));
GRANT SELECT(user_id,centre_id,role_code,starts_at,ends_at,can_read_profiles)
 ON mass_core.user_scope_grants TO authenticated;
-- Returns ONLY the caller's active grants/capabilities under the policy above.
CREATE FUNCTION mass_api.get_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE subject uuid:=mass_core.request_user_id(); result jsonb;
BEGIN
 IF current_user<>'authenticated' OR subject IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required'; END IF;
 SELECT jsonb_build_object('api_version','frontend-reads-v1','user_id',subject,'centres',coalesce(jsonb_agg(x ORDER BY x.label,x.id),'[]'::jsonb)) INTO result
 FROM (
  SELECT c.id,c.label,array_agg(DISTINCT g.role_code ORDER BY g.role_code) AS roles,
   mass_core.can_write(c.id) AS can_write,
   (bool_or(g.can_read_profiles AND g.role_code IN ('Teacher','Cluster Officer')) AND mass_core.can_write(c.id)) AS can_read_profiles
  FROM mass_core.user_scope_grants g JOIN mass_core.centres c ON c.id=g.centre_id
  WHERE g.user_id=subject AND g.starts_at<=statement_timestamp()
   AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)
  GROUP BY c.id,c.label
 )x;
 RETURN result;
END;
$$;

CREATE FUNCTION mass_api.get_references() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_user<>'authenticated' OR mass_core.request_user_id() IS NULL OR NOT EXISTS(SELECT 1 FROM mass_core.centres) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned programme read required'; END IF;
 RETURN jsonb_build_object(
 'academic_years',(SELECT coalesce(jsonb_agg(x ORDER BY x.starts_on),'[]'::jsonb) FROM (SELECT id,starts_on,ends_before FROM mass_core.academic_years)x),
 'assessment_periods',(SELECT coalesce(jsonb_agg(x ORDER BY x.academic_year_id,x.quarter),'[]'::jsonb) FROM (SELECT id,academic_year_id,quarter FROM mass_core.assessment_periods)x),
 'assessment_definitions',(SELECT coalesce(jsonb_agg(x ORDER BY x.period_id),'[]'::jsonb) FROM (SELECT id,period_id,max_score FROM mass_core.assessment_definitions)x),
 'programme_cohorts',(SELECT coalesce(jsonb_agg(x ORDER BY x.label,x.id),'[]'::jsonb) FROM (SELECT id,label,academic_year_id FROM mass_core.programme_cohorts)x),
 'attendance_codes',(SELECT coalesce(jsonb_agg(x ORDER BY x.code),'[]'::jsonb) FROM (SELECT code,meaning FROM mass_core.attendance_codes)x));
END;
$$;

CREATE FUNCTION mass_api.read_students(p_centre uuid,p_on date DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(child_id uuid,student_id text,enrolment_id uuid,grade_label text,shift_code text,starts_on date,ends_before date,status_code text,row_version bigint,full_name text,gender_code text,class10_board_passed boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset);
 RETURN QUERY SELECT c.id,c.student_id,e.id,e.grade_label,e.shift_code,e.starts_on,e.ends_before,e.status_code,e.row_version,p.full_name,p.gender_code,p.class10_board_passed
 FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id
 LEFT JOIN mass_core.private_child_profiles p ON p.child_id=c.id
 WHERE e.centre_id=p_centre AND (p_on IS NULL OR (p_on>=e.starts_on AND (e.ends_before IS NULL OR p_on<e.ends_before)))
 ORDER BY e.child_id,e.starts_on,e.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE FUNCTION mass_api.read_attendance(p_centre uuid,p_from date,p_until date,p_child uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,child_id uuid,enrolment_id uuid,shift_code text,attendance_date date,code text,row_version bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reporting dates required'; END IF;
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 RETURN QUERY SELECT a.id,a.child_id,a.enrolment_id,a.shift_code,a.attendance_date,a.code,a.row_version
 FROM mass_core.attendance_records a WHERE a.centre_id=p_centre AND a.attendance_date>=p_from AND a.attendance_date<p_until
 AND (p_child IS NULL OR a.child_id=p_child) ORDER BY a.attendance_date,a.child_id,a.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE FUNCTION mass_api.read_calendar(p_centre uuid,p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,shift_code text,session_date date,is_scheduled boolean,row_version bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reporting dates required'; END IF;
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 RETURN QUERY SELECT s.id,s.shift_code,s.session_date,s.is_scheduled,s.row_version
 FROM mass_core.cac_sessions s WHERE s.centre_id=p_centre AND s.session_date>=p_from AND s.session_date<p_until
 ORDER BY s.session_date,s.shift_code,s.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE FUNCTION mass_api.read_assessments(p_centre uuid,p_from date,p_until date,p_child uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,child_id uuid,enrolment_id uuid,shift_code text,definition_id uuid,assessed_on date,score numeric,row_version bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reporting dates required'; END IF;
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 RETURN QUERY SELECT a.id,a.child_id,a.enrolment_id,a.shift_code,a.definition_id,a.assessed_on,a.score,a.row_version
 FROM mass_core.assessment_results a WHERE a.centre_id=p_centre AND a.assessed_on>=p_from AND a.assessed_on<p_until
 AND (p_child IS NULL OR a.child_id=p_child) ORDER BY a.assessed_on,a.child_id,a.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE FUNCTION mass_api.read_activities(p_centre uuid,p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,shift_code text,activity_date date,name text,row_version bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reporting dates required'; END IF;
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 RETURN QUERY SELECT a.id,a.shift_code,a.activity_date,a.name,a.row_version
 FROM mass_core.activity_events a WHERE a.centre_id=p_centre AND a.activity_date>=p_from AND a.activity_date<p_until
 ORDER BY a.activity_date,a.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE FUNCTION mass_api.read_participation(p_centre uuid,p_from date,p_until date,p_event uuid DEFAULT NULL,p_child uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,event_id uuid,child_id uuid,enrolment_id uuid,shift_code text,activity_date date,participated boolean,row_version bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reporting dates required'; END IF;
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 RETURN QUERY SELECT a.id,a.event_id,a.child_id,a.enrolment_id,a.shift_code,v.activity_date,a.participated,a.row_version
 FROM mass_core.activity_participation a JOIN mass_core.activity_events v ON v.id=a.event_id
 WHERE a.centre_id=p_centre AND v.activity_date>=p_from AND v.activity_date<p_until
 AND (p_event IS NULL OR a.event_id=p_event) AND (p_child IS NULL OR a.child_id=p_child)
 ORDER BY v.activity_date,a.event_id,a.child_id,a.id LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE FUNCTION mass_api.read_morarji(p_centre uuid,p_cohort uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(membership_id uuid,cohort_id uuid,child_id uuid,enrolment_id uuid,shift_code text,outcome_id uuid,applied boolean,attended boolean,passed boolean,school_name text,row_version bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset);
 RETURN QUERY SELECT m.id,m.cohort_id,m.child_id,m.enrolment_id,m.shift_code,o.id,o.applied,o.attended,o.passed,o.school_name,o.row_version
 FROM mass_core.cohort_memberships m LEFT JOIN mass_core.morarji_outcomes o ON o.membership_id=m.id AND o.centre_id=m.centre_id
 WHERE m.centre_id=p_centre AND (p_cohort IS NULL OR m.cohort_id=p_cohort)
 ORDER BY m.cohort_id,m.child_id,m.id LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION mass_core.require_read_scope(uuid,integer,integer,date,date),
 mass_api.get_context(),mass_api.get_references(),
 mass_api.read_students(uuid,date,integer,integer),mass_api.read_attendance(uuid,date,date,uuid,integer,integer),
 mass_api.read_calendar(uuid,date,date,integer,integer),mass_api.read_assessments(uuid,date,date,uuid,integer,integer),
 mass_api.read_activities(uuid,date,date,integer,integer),mass_api.read_participation(uuid,date,date,uuid,uuid,integer,integer),
 mass_api.read_morarji(uuid,uuid,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.get_context(),mass_api.get_references(),
 mass_api.read_students(uuid,date,integer,integer),mass_api.read_attendance(uuid,date,date,uuid,integer,integer),
 mass_api.read_calendar(uuid,date,date,integer,integer),mass_api.read_assessments(uuid,date,date,uuid,integer,integer),
 mass_api.read_activities(uuid,date,date,integer,integer),mass_api.read_participation(uuid,date,date,uuid,uuid,integer,integer),
 mass_api.read_morarji(uuid,uuid,integer,integer) TO authenticated;
DO $acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p,
  LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid IN ('mass_core.require_read_scope(uuid,integer,integer,date,date)'::regprocedure,
   'mass_api.get_context()'::regprocedure,'mass_api.get_references()'::regprocedure,
   'mass_api.read_students(uuid,date,integer,integer)'::regprocedure,'mass_api.read_attendance(uuid,date,date,uuid,integer,integer)'::regprocedure,
   'mass_api.read_calendar(uuid,date,date,integer,integer)'::regprocedure,'mass_api.read_assessments(uuid,date,date,uuid,integer,integer)'::regprocedure,
   'mass_api.read_activities(uuid,date,date,integer,integer)'::regprocedure,'mass_api.read_participation(uuid,date,date,uuid,uuid,integer,integer)'::regprocedure,
   'mass_api.read_morarji(uuid,uuid,integer,integer)'::regprocedure)
  AND (a.grantee NOT IN (p.proowner,'authenticated'::regrole) OR (a.grantee='authenticated'::regrole AND a.is_grantable))) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='unexpected read API default grants; review before retry';
 END IF;
END;
$acl$;
-- Existing owner defaults revoke PUBLIC EXECUTE; no new API schema/table grants.
NOTIFY pgrst,'reload schema';
COMMIT;
