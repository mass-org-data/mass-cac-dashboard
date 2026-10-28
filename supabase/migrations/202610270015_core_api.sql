BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_api.register_student(p_centre uuid,p_grade text,p_shift text,p_start date,p_name text,p_gender text)
RETURNS TABLE(child_id uuid,student_id text,enrolment_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid; e uuid; display text;
BEGIN
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 INSERT INTO mass_core.children DEFAULT VALUES RETURNING id,mass_core.children.student_id INTO c,display;
 INSERT INTO mass_core.private_child_profiles(child_id,full_name,gender_code) VALUES(c,p_name,p_gender);
 INSERT INTO mass_core.enrolments(child_id,centre_id,grade_label,shift_code,starts_on,status_code)
 VALUES(c,p_centre,p_grade,p_shift,p_start,'Active') RETURNING id INTO e;
 RETURN QUERY SELECT c,display,e;
END;
$$;
CREATE FUNCTION mass_api.add_enrolment(p_child uuid,p_centre uuid,p_grade text,p_shift text,p_start date,p_status text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result uuid;
BEGIN
 IF NOT mass_core.can_write_child(p_child) OR NOT mass_core.can_write(p_centre) THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified source and destination scope required'; END IF;
 INSERT INTO mass_core.enrolments(child_id,centre_id,grade_label,shift_code,starts_on,status_code)
 VALUES(p_child,p_centre,p_grade,p_shift,p_start,p_status) RETURNING id INTO result;
 RETURN result;
END;
$$;
CREATE FUNCTION mass_api.close_enrolment(p_id uuid,p_expected bigint,p_ends_before date,p_status text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; revision bigint;
BEGIN
 SELECT * INTO e FROM mass_core.enrolments WHERE id=p_id FOR UPDATE;
 IF e.id IS NULL OR NOT mass_core.can_write(e.centre_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 PERFORM mass_core.expected_version(e.row_version,p_expected);
 IF e.ends_before IS NOT NULL OR p_ends_before IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='explicit first closure only'; END IF;
 UPDATE mass_core.enrolments SET ends_before=p_ends_before,status_code=p_status WHERE id=p_id RETURNING row_version INTO revision;
 RETURN revision;
END;
$$;
CREATE FUNCTION mass_api.create_activity(p_id uuid,p_centre uuid,p_shift text,p_date date,p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 INSERT INTO mass_core.activity_events(id,centre_id,shift_code,activity_date,name) VALUES(p_id,p_centre,p_shift,p_date,p_name);
 RETURN p_id;
END;
$$;
CREATE FUNCTION mass_api.record_attendance(p_enrolment uuid,p_date date,p_code text,p_expected bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; old_id uuid; version bigint;
BEGIN
 e:=mass_core.writable_enrolment(p_enrolment);
 SELECT id,row_version INTO old_id,version FROM mass_core.attendance_records WHERE child_id=e.child_id AND centre_id=e.centre_id AND shift_code=e.shift_code AND attendance_date=p_date FOR UPDATE;
 PERFORM mass_core.expected_version(version,p_expected);

 IF old_id IS NULL THEN
 INSERT INTO mass_core.attendance_records(child_id,centre_id,shift_code,enrolment_id,attendance_date,code) VALUES(e.child_id,e.centre_id,e.shift_code,e.id,p_date,p_code) RETURNING id INTO old_id;
 ELSE UPDATE mass_core.attendance_records SET code=p_code WHERE id=old_id; END IF;
 RETURN old_id;
END;
$$;
CREATE FUNCTION mass_api.record_assessment(p_enrolment uuid,p_definition uuid,p_date date,p_score numeric,p_expected bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; old_id uuid; version bigint;
BEGIN
 e:=mass_core.writable_enrolment(p_enrolment);
 SELECT id,row_version INTO old_id,version FROM mass_core.assessment_results WHERE child_id=e.child_id AND definition_id=p_definition FOR UPDATE;
 PERFORM mass_core.expected_version(version,p_expected);
 IF old_id IS NOT NULL AND EXISTS(SELECT 1 FROM mass_core.assessment_results WHERE id=old_id AND (enrolment_id<>e.id OR assessed_on<>p_date)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='assessment context is immutable'; END IF;
 IF old_id IS NULL THEN
 INSERT INTO mass_core.assessment_results(child_id,centre_id,shift_code,enrolment_id,definition_id,assessed_on,score) VALUES(e.child_id,e.centre_id,e.shift_code,e.id,p_definition,p_date,p_score) RETURNING id INTO old_id;
 ELSE UPDATE mass_core.assessment_results SET score=p_score WHERE id=old_id; END IF;
 RETURN old_id;
END;
$$;
CREATE FUNCTION mass_api.record_participation(p_enrolment uuid,p_event uuid,p_participated boolean,p_expected bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; old_id uuid; version bigint;
BEGIN
 e:=mass_core.writable_enrolment(p_enrolment);
 SELECT id,row_version INTO old_id,version FROM mass_core.activity_participation WHERE event_id=p_event AND child_id=e.child_id FOR UPDATE;
 PERFORM mass_core.expected_version(version,p_expected);
 IF NOT EXISTS(SELECT 1 FROM mass_core.activity_events WHERE id=p_event AND centre_id=e.centre_id AND shift_code=e.shift_code) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='event outside assigned enrolment'; END IF;
 IF old_id IS NULL THEN
 INSERT INTO mass_core.activity_participation(event_id,child_id,centre_id,shift_code,enrolment_id,participated) VALUES(p_event,e.child_id,e.centre_id,e.shift_code,e.id,p_participated) RETURNING id INTO old_id;
 ELSE UPDATE mass_core.activity_participation SET participated=p_participated WHERE id=old_id; END IF;
 RETURN old_id;
END;
$$;
CREATE FUNCTION mass_api.add_morarji_member(p_enrolment uuid,p_cohort uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; result uuid;
BEGIN
 e:=mass_core.writable_enrolment(p_enrolment);
 INSERT INTO mass_core.cohort_memberships(cohort_id,child_id,centre_id,shift_code,enrolment_id)
 VALUES(p_cohort,e.child_id,e.centre_id,e.shift_code,e.id) RETURNING id INTO result;
 RETURN result;
END;
$$;
CREATE FUNCTION mass_api.record_morarji(p_member uuid,p_applied boolean,p_attended boolean,p_passed boolean,p_school text,p_expected bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid; result uuid; version bigint;
BEGIN
 SELECT centre_id INTO c FROM mass_core.cohort_memberships WHERE id=p_member;
 IF c IS NULL OR NOT mass_core.can_write(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 SELECT id,row_version INTO result,version FROM mass_core.morarji_outcomes WHERE membership_id=p_member FOR UPDATE;
 PERFORM mass_core.expected_version(version,p_expected);
 IF result IS NULL THEN
 INSERT INTO mass_core.morarji_outcomes(membership_id,centre_id,applied,attended,passed,school_name)
 VALUES(p_member,c,p_applied,p_attended,p_passed,p_school) RETURNING id INTO result;
 ELSE UPDATE mass_core.morarji_outcomes SET applied=p_applied,attended=p_attended,passed=p_passed,school_name=p_school WHERE id=result; END IF;
 RETURN result;
END;
$$;
CREATE FUNCTION mass_api.attendance_summary(p_centre uuid,p_from date,p_until date)
RETURNS TABLE(present_count bigint,absent_count bigint,leave_count bigint,excluded_count bigint,percentage numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 WITH counts AS (
 SELECT count(*) FILTER(WHERE code='P' AND NOT holiday) p,
 count(*) FILTER(WHERE code='A' AND NOT holiday) a,
 count(*) FILTER(WHERE code='L' AND NOT holiday) l,
 count(*) FILTER(WHERE code IN ('WO','MM') OR holiday) excluded
 FROM (SELECT a.code,EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id
 AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled) holiday
 FROM mass_core.attendance_records a WHERE a.centre_id=p_centre AND a.attendance_date>=p_from AND a.attendance_date<p_until) x)
 SELECT p,a,l,excluded,100::numeric*p/nullif(p+a+l,0) FROM counts
$$;
CREATE FUNCTION mass_api.list_students(p_centre uuid,p_on date)
RETURNS TABLE(child_id uuid,student_id text,enrolment_id uuid,grade_label text,shift_code text,full_name text,row_version bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT c.id,c.student_id,e.id,e.grade_label,e.shift_code,p.full_name,e.row_version
 FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id
 LEFT JOIN mass_core.private_child_profiles p ON p.child_id=c.id
 WHERE e.centre_id=p_centre AND p_on>=e.starts_on AND (e.ends_before IS NULL OR p_on<e.ends_before)
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mass_api TO authenticated;
-- No privileges to anon or service_role; no private schema added to exposed schemas.
NOTIFY pgrst, 'reload schema';

COMMIT;
