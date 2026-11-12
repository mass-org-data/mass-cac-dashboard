-- Additive review workflows. Install separately; existing facts/gates are preserved.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE FUNCTION mass_api.attendance_register_page(p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL,p_offset integer DEFAULT 0,p_sort text DEFAULT 'date',p_reverse boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; column_name text; direction text; c uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 OR p_reverse IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded register page required';END IF;
 FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre required';END IF;END LOOP;
 column_name:=CASE p_sort WHEN 'centre' THEN 'centre_label' WHEN 'shift' THEN 'shift_code' WHEN 'date' THEN 'attendance_date' WHEN 'present' THEN 'present' WHEN 'percentage' THEN 'percentage' END;
 IF column_name IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='supported register sort required';END IF;
 direction:=CASE WHEN (p_sort='date')<>p_reverse THEN 'DESC' ELSE 'ASC' END;
 EXECUTE format($query$WITH all_rows AS MATERIALIZED (
 SELECT a.*,c.label centre_label,'Classroom'::text session_type FROM mass_api.attendance_register_summary_v4($1,$2,$3,$4,$5,$6) a JOIN mass_core.centres c ON c.id=a.centre_id
 UNION ALL
 SELECT s.centre_id,s.shift_code,s.session_date,0::bigint,0::bigint,0::bigint,NULL::numeric,
 (SELECT count(*) FROM mass_core.enrolments e LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id WHERE e.centre_id=s.centre_id AND e.shift_code=s.shift_code AND e.starts_on<=s.session_date AND (e.ends_before IS NULL OR s.session_date<e.ends_before) AND ($5 IS NULL OR e.grade_label=$5) AND ($6 IS NULL OR coalesce(p.gender_code,'Unknown')=$6)),
 coalesce(actor.label,'Source import / not recorded'),coalesce(actor.label,'Source import / not recorded'),actor.changed_at,c.label,'Holiday'::text
 FROM mass_core.cac_sessions s JOIN mass_core.centres c ON c.id=s.centre_id
 LEFT JOIN LATERAL (SELECT changed_at,coalesce((SELECT min(m.display_name) FROM mass_core.staff_members m WHERE m.auth_user_id=r.actor_user_id),'Staff account '||left(md5(r.actor_user_id::text),8)) label FROM mass_core.attendance_register_actions r WHERE r.centre_id=s.centre_id AND r.shift_code=s.shift_code AND r.attendance_date=s.session_date ORDER BY changed_at DESC LIMIT 1) actor ON true
 WHERE s.centre_id=ANY($1) AND NOT s.is_scheduled AND s.session_date>=$2 AND s.session_date<$3 AND ($4 IS NULL OR s.shift_code=$4)
 AND NOT EXISTS(SELECT 1 FROM mass_core.attendance_records a WHERE a.centre_id=s.centre_id AND a.shift_code=s.shift_code AND a.attendance_date=s.session_date)
 ), page AS (SELECT *,row_number() OVER(ORDER BY %I %s NULLS LAST,attendance_date DESC,centre_id,shift_code) rn FROM all_rows ORDER BY %I %s NULLS LAST,attendance_date DESC,centre_id,shift_code OFFSET $7 LIMIT 10)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM all_rows),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p)-ARRAY['centre_label','rn'] ORDER BY rn) FROM page p),'[]'::jsonb))$query$,column_name,direction,column_name,direction)
 INTO result USING p_centres,p_from,p_until,p_shift,p_grade,p_gender,p_offset;
 RETURN result;
END;$$;

CREATE FUNCTION mass_api.attendance_present_distribution(p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid; result jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>31 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded monthly distribution required';END IF;
 FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre required';END IF;END LOOP;
 WITH recorded AS (
 SELECT a.child_id,count(DISTINCT a.attendance_date) FILTER(WHERE a.code='P') present
 FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=a.child_id
 WHERE a.centre_id=ANY(p_centres) AND a.attendance_date>=p_from AND a.attendance_date<p_until AND a.code IN ('P','A','L')
 AND (p_shift IS NULL OR a.shift_code=p_shift) AND (p_grade IS NULL OR e.grade_label=p_grade) AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender)
 GROUP BY a.child_id
 ), histogram AS (SELECT present,count(*) students FROM recorded GROUP BY present)
 SELECT jsonb_build_object('recorded_students',(SELECT count(*) FROM recorded),'days',coalesce((SELECT jsonb_agg(jsonb_build_object('days',d,'students',coalesce(h.students,0)) ORDER BY d) FROM generate_series(0,p_until-p_from) d LEFT JOIN histogram h ON h.present=d),'[]'::jsonb)) INTO result;
 RETURN result;
END;$$;

CREATE FUNCTION mass_api.save_classroom_register(p_request uuid,p_centre uuid,p_shift text,p_date date,p_token text,p_rows jsonb,p_reason text DEFAULT 'Attendance entered',p_notes text DEFAULT '') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre required';END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE coalesce(r->>'code','') NOT IN ('P','A')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Present or Absent required for every eligible student';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_centre::text||p_shift||p_date::text,0));
 SELECT count(*) INTO n FROM mass_core.enrolments e WHERE e.centre_id=p_centre AND e.shift_code=p_shift AND e.starts_on<=p_date AND (e.ends_before IS NULL OR p_date<e.ends_before);
 IF n<>jsonb_array_length(p_rows) OR EXISTS(SELECT 1 FROM mass_core.enrolments e WHERE e.centre_id=p_centre AND e.shift_code=p_shift AND e.starts_on<=p_date AND (e.ends_before IS NULL OR p_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r->>'enrolment'=e.id::text)) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='complete eligible roster required';END IF;
 RETURN mass_api.save_attendance_register_v3(p_request,p_centre,p_shift,p_date,p_token,p_rows,p_reason,p_notes);
END;$$;

CREATE FUNCTION mass_api.save_centre_holiday(p_request uuid,p_centre uuid,p_shift text,p_date date,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old mass_core.cac_sessions; previous mass_core.attendance_register_actions; signature text;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT coalesce((SELECT enabled FROM mass_core.attendance_register_control),false) OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned attendance write required';END IF;
 IF p_request IS NULL OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_date IS NULL OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid holiday context and reason required';END IF;
 signature:=md5(jsonb_build_array('Holiday',p_centre,p_shift,p_date,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('attendance-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.attendance_register_actions WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL AND (previous.signature<>signature OR previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id()) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='holiday request identity conflict';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_centre::text||p_shift||p_date::text,0));
 SELECT * INTO old FROM mass_core.cac_sessions WHERE centre_id=p_centre AND shift_code=p_shift AND session_date=p_date;
 IF old.id IS NOT NULL THEN
  IF old.is_scheduled THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='scheduled session already exists; reviewed calendar correction required';END IF;
  RETURN old.id;
 END IF;
 INSERT INTO mass_core.attendance_register_actions(request_id,actor_user_id,centre_id,shift_code,attendance_date,operation,reason,signature,before_records,changed_count,notes)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,'SAVE','Holiday recorded',signature,'[]'::jsonb,0,p_reason);
 INSERT INTO mass_core.cac_sessions(centre_id,shift_code,session_date,is_scheduled,confirmation_ref) VALUES(p_centre,p_shift,p_date,false,p_request) RETURNING id INTO old.id;
 RETURN old.id;
END;$$;

CREATE TABLE mass_core.student_academic_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 child_id uuid NOT NULL REFERENCES mass_core.children(id),
 academic_year_id uuid NOT NULL REFERENCES mass_core.academic_years(id),
 enrolment_id uuid NOT NULL REFERENCES mass_core.enrolments(id),
 grade_label text NOT NULL CHECK(grade_label ~ '^(10|[1-9])$'),
 status text NOT NULL CHECK(status IN ('Active','Graduated','Dropped Out')),
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(child_id,academic_year_id)
);
ALTER TABLE mass_core.student_academic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.student_academic_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY academic_owner ON mass_core.student_academic_profiles TO mass_core_owner USING(true) WITH CHECK(true);
REVOKE ALL ON mass_core.student_academic_profiles FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mass_core.guard_academic_profile() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='academic history is retained';END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['status','row_version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','row_version']) OR NEW.row_version<>OLD.row_version THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='academic identity and grade are immutable';END IF;
  NEW.row_version:=OLD.row_version+1;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER academic_guard BEFORE INSERT OR UPDATE OR DELETE ON mass_core.student_academic_profiles FOR EACH ROW EXECUTE FUNCTION mass_core.guard_academic_profile();
CREATE TRIGGER academic_no_truncate BEFORE TRUNCATE ON mass_core.student_academic_profiles FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_academic_profile();

CREATE TABLE mass_core.student_academic_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES mass_core.student_academic_profiles(id),
 revision bigint NOT NULL,status text NOT NULL,changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),actor_user_id uuid,
 UNIQUE(profile_id,revision)
);
ALTER TABLE mass_core.student_academic_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.student_academic_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY academic_revision_owner ON mass_core.student_academic_revisions TO mass_core_owner USING(true) WITH CHECK(true);
REVOKE ALL ON mass_core.student_academic_revisions FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable_academic_revision BEFORE UPDATE OR DELETE ON mass_core.student_academic_revisions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER immutable_academic_revision_truncate BEFORE TRUNCATE ON mass_core.student_academic_revisions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE FUNCTION mass_core.audit_academic_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO mass_core.student_academic_revisions(profile_id,revision,status,actor_user_id) VALUES(NEW.id,NEW.row_version,NEW.status,mass_core.request_user_id());
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION mass_core.audit_academic_profile(),mass_core.guard_academic_profile() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER academic_audit AFTER INSERT OR UPDATE ON mass_core.student_academic_profiles FOR EACH ROW EXECUTE FUNCTION mass_core.audit_academic_profile();

CREATE FUNCTION mass_api.student_academic_history(p_child uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_write_child(p_child) OR NOT mass_core.can_read_profile(p_child) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authorised student profile required';END IF;
 WITH source AS (
 SELECT DISTINCT ON(y.id) y.id,y.starts_on,y.ends_before,e.id enrolment_id,e.grade_label,
 CASE e.status_code WHEN 'Active' THEN 'Active' WHEN 'CAC dropout' THEN 'Dropped Out' ELSE NULL END status
 FROM mass_core.enrolments e JOIN mass_core.academic_years y ON e.starts_on>=y.starts_on AND e.starts_on<y.ends_before
 WHERE e.child_id=p_child ORDER BY y.id,e.starts_on DESC,e.id
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('academic_year_id',s.id,'enrolment_id',coalesce(a.enrolment_id,s.enrolment_id),'label',extract(year FROM s.starts_on)::text||'–'||extract(year FROM s.ends_before)::text,'grade',coalesce(a.grade_label,s.grade_label),'status',coalesce(a.status,s.status),'version',coalesce(a.row_version,0),'editable',(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date>=s.starts_on AND (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date<s.ends_before) ORDER BY s.starts_on DESC),'[]'::jsonb) INTO result
 FROM source s LEFT JOIN mass_core.student_academic_profiles a ON a.child_id=p_child AND a.academic_year_id=s.id;
 RETURN result;
END;$$;

CREATE FUNCTION mass_api.save_student_academic_profile(p_child uuid,p_enrolment uuid,p_year uuid,p_status text,p_expected bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; old mass_core.student_academic_profiles; n bigint;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_write_child(p_child) OR NOT mass_core.can_read_profile(p_child) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authorised profile correction required';END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_activation.features WHERE feature='profiles' AND enabled) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='profile changes are not activated';END IF;
 IF p_status IS NULL OR p_status NOT IN ('Active','Graduated','Dropped Out') OR NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.id=p_year AND (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date>=y.starts_on AND (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date<y.ends_before) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='only the active academic year may be updated';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_child::text||p_year::text,0));
 SELECT * INTO e FROM mass_core.enrolments WHERE id=p_enrolment AND child_id=p_child;
 IF e.id IS NULL OR NOT mass_core.can_write(e.centre_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified enrolment required';END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.id=p_year AND e.starts_on>=y.starts_on AND e.starts_on<y.ends_before) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='new academic year requires a verified grade assignment; automatic rollover is deferred';END IF;
 SELECT * INTO old FROM mass_core.student_academic_profiles WHERE child_id=p_child AND academic_year_id=p_year;
 PERFORM mass_core.expected_version(coalesce(old.row_version,0),p_expected);
 IF old.id IS NULL THEN INSERT INTO mass_core.student_academic_profiles(child_id,academic_year_id,enrolment_id,grade_label,status) VALUES(p_child,p_year,e.id,e.grade_label,p_status) RETURNING row_version INTO n;
 ELSE UPDATE mass_core.student_academic_profiles SET status=p_status WHERE id=old.id RETURNING row_version INTO n;END IF;
 RETURN n;
END;$$;

CREATE FUNCTION mass_api.save_student_profile_year(p_child uuid,p_enrolment uuid,p_profile_expected bigint,p_name text,p_gender text,p_board boolean,p_year uuid,p_status text,p_year_expected bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n bigint;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_write_child(p_child) OR NOT mass_core.can_read_profile(p_child) OR NOT EXISTS(SELECT 1 FROM mass_core.enrolments e WHERE e.id=p_enrolment AND e.child_id=p_child AND mass_core.can_write(e.centre_id)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authorised student profile required';END IF;
 PERFORM mass_core.require_operation_enabled('profiles');
 n:=mass_api.correct_profile(p_child,p_profile_expected,p_name,p_gender,p_board);
 PERFORM mass_api.save_student_academic_profile(p_child,p_enrolment,p_year,p_status,p_year_expected);
 RETURN n;
END;$$;

CREATE OR REPLACE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',6,'holiday_code',true,'profile_pages',true,'assessment_register',true,'register_timestamps',true,'profile_sort_v2',true,'register_paging',true,'present_distribution',true,'session_entry',true,'academic_history',true,'enabled',coalesce((SELECT enabled FROM mass_core.attendance_register_control),false));
END;$$;

REVOKE ALL ON FUNCTION mass_api.attendance_register_page(uuid[],date,date,text,text,text,integer,text,boolean),mass_api.attendance_present_distribution(uuid[],date,date,text,text,text),mass_api.save_classroom_register(uuid,uuid,text,date,text,jsonb,text,text),mass_api.save_centre_holiday(uuid,uuid,text,date,text),mass_api.student_academic_history(uuid),mass_api.save_student_academic_profile(uuid,uuid,uuid,text,bigint),mass_api.save_student_profile_year(uuid,uuid,bigint,text,text,boolean,uuid,text,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.attendance_register_page(uuid[],date,date,text,text,text,integer,text,boolean),mass_api.attendance_present_distribution(uuid[],date,date,text,text,text),mass_api.save_classroom_register(uuid,uuid,text,date,text,jsonb,text,text),mass_api.save_centre_holiday(uuid,uuid,text,date,text),mass_api.student_academic_history(uuid),mass_api.save_student_academic_profile(uuid,uuid,uuid,text,bigint),mass_api.save_student_profile_year(uuid,uuid,bigint,text,text,boolean,uuid,text,bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
