-- Additive original-interface contracts. Previously applied files stay unchanged.
BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_core.require_staff_session() RETURNS void
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('role')<>'authenticated' OR mass_core.request_user_id() IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated staff session required'; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_core.require_staff_session() TO authenticated;
-- Period overlap includes source-backed NULL exact dates. Same RPC shape/ACL.
CREATE OR REPLACE FUNCTION mass_api.read_assessments(p_centre uuid,p_from date,p_until date,p_child uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,child_id uuid,enrolment_id uuid,shift_code text,definition_id uuid,assessed_on date,score numeric,row_version bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reporting dates required'; END IF;
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 RETURN QUERY SELECT a.id,a.child_id,a.enrolment_id,a.shift_code,a.definition_id,a.assessed_on,a.score,a.row_version
 FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id
 JOIN mass_core.assessment_periods q ON q.id=d.period_id JOIN mass_core.academic_years y ON y.id=q.academic_year_id
 WHERE a.centre_id=p_centre AND (p_child IS NULL OR a.child_id=p_child)
 AND ((a.assessed_on>=p_from AND a.assessed_on<p_until) OR
 (a.assessed_on IS NULL AND (y.starts_on+(q.quarter-1)*interval '3 months')::date<p_until
 AND (y.starts_on+q.quarter*interval '3 months')::date>p_from))
 ORDER BY a.assessed_on NULLS FIRST,a.child_id,a.id LIMIT p_limit OFFSET p_offset;
END;
$$;
-- A correction must retain even NULL assessment context, not exploit SQL NULL <>.
CREATE OR REPLACE FUNCTION mass_api.record_assessment(p_enrolment uuid,p_definition uuid,p_date date,p_score numeric,p_expected bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; r mass_core.assessment_results;
BEGIN
 PERFORM mass_core.require_staff_session();
 e:=mass_core.writable_enrolment(p_enrolment);
 PERFORM pg_advisory_xact_lock(hashtextextended('assessment.'||e.child_id::text||p_definition::text,0));
 SELECT * INTO r FROM mass_core.assessment_results WHERE child_id=e.child_id AND definition_id=p_definition FOR UPDATE;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NOT NULL THEN
  IF r.enrolment_id IS DISTINCT FROM e.id OR r.assessed_on IS DISTINCT FROM p_date THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='assessment context is immutable'; END IF;
  UPDATE mass_core.assessment_results SET score=p_score WHERE id=r.id;
 ELSE
  INSERT INTO mass_core.assessment_results(child_id,centre_id,shift_code,enrolment_id,definition_id,assessed_on,score)
  VALUES(e.child_id,e.centre_id,e.shift_code,e.id,p_definition,p_date,p_score) RETURNING id INTO r.id;
 END IF;
 RETURN r.id;
END;
$$;
CREATE OR REPLACE FUNCTION mass_api.record_attendance(p_enrolment uuid,p_date date,p_code text,p_expected bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; r mass_core.attendance_records;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='future attendance cannot be observed';END IF;
 IF p_code='WO' AND extract(isodow FROM p_date)<>7 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='WO denotes Sunday';END IF;
 e:=mass_core.writable_enrolment(p_enrolment);
 PERFORM pg_advisory_xact_lock(hashtextextended('attendance.'||e.id::text||p_date::text,0));
 SELECT * INTO r FROM mass_core.attendance_records WHERE child_id=e.child_id AND centre_id=e.centre_id AND shift_code=e.shift_code AND attendance_date=p_date FOR UPDATE;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NULL THEN INSERT INTO mass_core.attendance_records(child_id,centre_id,shift_code,enrolment_id,attendance_date,code) VALUES(e.child_id,e.centre_id,e.shift_code,e.id,p_date,p_code) RETURNING id INTO r.id;
 ELSE UPDATE mass_core.attendance_records SET code=p_code WHERE id=r.id;END IF;
 RETURN r.id;
END;
$$;
-- One atomic attendance transaction. Existing individual RPC and RLS remain authoritative.
CREATE FUNCTION mass_api.record_attendance_batch(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE r jsonb; n integer:=0;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded attendance rows required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x GROUP BY x->>'enrolment',x->>'date' HAVING count(*)>1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='duplicate attendance context'; END IF;
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY x->>'enrolment',x->>'date' LOOP
  PERFORM mass_api.record_attendance((r->>'enrolment')::uuid,(r->>'date')::date,r->>'code',(r->>'expected')::bigint);n:=n+1;
 END LOOP;
 RETURN n;
END;
$$;
CREATE FUNCTION mass_core.guard_profile_correction() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='profile removal unsupported'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.row_version<>1 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='initial revision required'; END IF;
 ELSE
  IF NEW.row_version<>OLD.row_version OR (to_jsonb(NEW)-ARRAY['full_name','gender_code','class10_board_passed']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['full_name','gender_code','class10_board_passed']) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='profile identity immutable'; END IF;
  NEW.row_version:=OLD.row_version+1;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER guard_write ON mass_core.private_child_profiles;
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.private_child_profiles FOR EACH ROW EXECUTE FUNCTION mass_core.guard_profile_correction();
CREATE FUNCTION mass_api.correct_profile(p_child uuid,p_expected bigint,p_name text,p_gender text,p_board boolean) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.private_child_profiles;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid profile fields required';END IF;
 IF NOT mass_core.can_write_child(p_child) OR NOT mass_core.can_read_profile(p_child) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='profile correction capability required'; END IF;
 SELECT * INTO r FROM mass_core.private_child_profiles WHERE child_id=p_child FOR UPDATE;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='profile not found'; END IF;
 UPDATE mass_core.private_child_profiles SET full_name=p_name,gender_code=p_gender,class10_board_passed=p_board WHERE id=r.id RETURNING row_version INTO p_expected;
 RETURN p_expected;
END;
$$;
CREATE FUNCTION mass_api.read_profile_revision(p_child uuid) RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE n bigint;
BEGIN SELECT row_version INTO n FROM mass_core.private_child_profiles WHERE child_id=p_child;RETURN n;END;
$$;
CREATE FUNCTION mass_api.record_calendar(p_centre uuid,p_shift text,p_date date,p_scheduled boolean,p_reference text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.cac_sessions;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 IF p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar authority reference required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_centre::text||p_shift||p_date::text,0));
 SELECT * INTO r FROM mass_core.cac_sessions WHERE centre_id=p_centre AND shift_code=p_shift AND session_date=p_date;
 IF r.id IS NOT NULL THEN
  IF r.is_scheduled IS DISTINCT FROM p_scheduled OR r.confirmation_ref::text IS DISTINCT FROM p_reference THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='calendar correction requires reviewed authority'; END IF;
  RETURN r.id;
 END IF;
 INSERT INTO mass_core.cac_sessions(centre_id,shift_code,session_date,is_scheduled,confirmation_ref) VALUES(p_centre,p_shift,p_date,p_scheduled,p_reference::uuid) RETURNING id INTO r.id;
 RETURN r.id;
END;
$$;
-- Private request receipts contain identifiers only; no names or payload copies.
CREATE TABLE mass_core.registration_requests(request_id uuid PRIMARY KEY,user_id uuid NOT NULL,centre_id uuid NOT NULL REFERENCES mass_core.centres(id),child_id uuid NOT NULL REFERENCES mass_core.children(id),enrolment_id uuid NOT NULL REFERENCES mass_core.enrolments(id));
ALTER TABLE mass_core.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.registration_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.registration_requests TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER immutable_request BEFORE UPDATE OR DELETE ON mass_core.registration_requests FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_core.registration_requests FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
-- Explicit identifier capture, including duplicate names, is mandatory.
CREATE OR REPLACE FUNCTION mass_api.register_student_once(p_request uuid,p_centre uuid,p_grade text,p_shift text,p_start date,p_name text,p_gender text)
RETURNS TABLE(child_id uuid,student_id text,enrolment_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.registration_requests; c uuid; e uuid; display text;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy')) OR p_grade IS NULL OR p_grade NOT IN ('1','2','3','4','5','6','7','8','9','10') OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_start IS NULL OR p_start>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid registration fields required';END IF;
 IF p_request IS NULL OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('register.'||p_request::text,0));
 SELECT * INTO r FROM mass_core.registration_requests WHERE request_id=p_request;
 IF r.request_id IS NOT NULL THEN
  IF r.user_id IS DISTINCT FROM mass_core.request_user_id() OR r.centre_id<>p_centre THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='request not available'; END IF;
  IF NOT EXISTS(SELECT 1 FROM mass_core.enrolments e JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id WHERE e.id=r.enrolment_id AND e.child_id=r.child_id AND e.grade_label=p_grade AND e.shift_code=p_shift AND e.starts_on=p_start AND p.full_name=p_name AND p.gender_code IS NOT DISTINCT FROM p_gender) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request already recorded; reload before changing values';END IF;
  RETURN QUERY SELECT x.id,x.student_id,r.enrolment_id FROM mass_core.children x WHERE x.id=r.child_id;RETURN;
 END IF;
 SELECT x.child_id,x.student_id,x.enrolment_id INTO c,display,e FROM mass_api.register_student(p_centre,p_grade,p_shift,p_start,p_name,p_gender) x;
 INSERT INTO mass_core.registration_requests VALUES(p_request,mass_core.request_user_id(),p_centre,c,e);
 RETURN QUERY SELECT c,display,e;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.record_attendance_batch(jsonb),mass_api.correct_profile(uuid,bigint,text,text,boolean),mass_api.read_profile_revision(uuid),mass_api.record_calendar(uuid,text,date,boolean,text),mass_api.register_student_once(uuid,uuid,text,text,date,text,text) TO authenticated;
CREATE FUNCTION mass_api.record_assessment_batch(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE r jsonb;n integer:=0;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded assessment rows required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x GROUP BY x->>'enrolment',x->>'definition' HAVING count(*)>1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='duplicate assessment context'; END IF;
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY x->>'enrolment',x->>'definition' LOOP
 PERFORM mass_api.record_assessment((r->>'enrolment')::uuid,(r->>'definition')::uuid,(r->>'date')::date,(r->>'score')::numeric,(r->>'expected')::bigint);n:=n+1;END LOOP;RETURN n;
END;
$$;
CREATE FUNCTION mass_api.record_participation_batch(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE r jsonb;n integer:=0;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded participation rows required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x GROUP BY x->>'enrolment',x->>'event' HAVING count(*)>1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='duplicate participation context'; END IF;
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY x->>'enrolment',x->>'event' LOOP
 PERFORM mass_api.record_participation((r->>'enrolment')::uuid,(r->>'event')::uuid,(r->>'participated')::boolean,(r->>'expected')::bigint);n:=n+1;END LOOP;RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.record_assessment_batch(jsonb),mass_api.record_participation_batch(jsonb) TO authenticated;
CREATE FUNCTION mass_api.correct_student(p_child uuid,p_enrolment uuid,p_profile_expected bigint,p_enrolment_expected bigint,p_name text,p_gender text,p_board boolean,p_end date,p_status text) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE n bigint;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT EXISTS(SELECT 1 FROM mass_core.enrolments WHERE id=p_enrolment AND child_id=p_child) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified enrolment required'; END IF;
 n:=mass_api.correct_profile(p_child,p_profile_expected,p_name,p_gender,p_board);
 IF p_end IS NOT NULL THEN PERFORM mass_api.close_enrolment(p_enrolment,p_enrolment_expected,p_end,p_status);END IF;
 RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.correct_student(uuid,uuid,bigint,bigint,text,text,boolean,date,text) TO authenticated;
CREATE FUNCTION mass_api.get_original_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT EXISTS(SELECT 1 FROM mass_core.centres) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required'; END IF;
 RETURN jsonb_build_object('original_workflows',20,'period_assessments',true);
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.get_original_capabilities() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
