-- Vercel feedback round 3: editable current enrollment standard, audited
-- non-classroom student sessions, and bounded annual engagement/score metrics.
-- Installation alone does not activate student deletion. Hosted installation is
-- authorized for Preview only; Production remains unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

-- Current enrollment standards are corrected with the same optimistic version
-- boundary as every other enrollment correction. The context remains immutable.
CREATE TABLE mass_core.enrolment_grade_actions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),enrolment_id uuid NOT NULL,
 actor_user_id uuid NOT NULL,from_grade text NOT NULL,to_grade text NOT NULL,
 transaction_id bigint NOT NULL DEFAULT txid_current(),changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(from_grade ~ '^(10|[1-9])$' AND to_grade ~ '^(10|[1-9])$' AND from_grade<>to_grade)
);
ALTER TABLE mass_core.enrolment_grade_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.enrolment_grade_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY enrolment_grade_action_owner ON mass_core.enrolment_grade_actions TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER immutable_enrolment_grade_action BEFORE UPDATE OR DELETE ON mass_core.enrolment_grade_actions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate_enrolment_grade_action BEFORE TRUNCATE ON mass_core.enrolment_grade_actions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
REVOKE ALL ON mass_core.enrolment_grade_actions FROM PUBLIC,anon,authenticated,service_role;

DO $guard$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('mass_core.guard_record()'::regprocedure);
 IF position('WHEN ''enrolments'' THEN ARRAY[''ends_before'',''status_code'']' IN definition)=0 THEN
  RAISE EXCEPTION 'Unexpected enrollment guard; review before installation';
 END IF;
 EXECUTE replace(definition,
  'WHEN ''enrolments'' THEN ARRAY[''ends_before'',''status_code'']',
  'WHEN ''enrolments'' THEN ARRAY[''ends_before'',''status_code'',''grade_label'']');
 definition:=pg_get_functiondef('mass_core.guard_record()'::regprocedure);
 IF position('IF cardinality(allowed)=0 OR' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected record mutation guard';END IF;
 EXECUTE replace(definition,'IF cardinality(allowed)=0 OR',$body$
 IF TG_TABLE_NAME='enrolments' AND (to_jsonb(NEW)->>'grade_label') IS DISTINCT FROM (to_jsonb(OLD)->>'grade_label') AND NOT EXISTS(
  SELECT 1 FROM mass_core.enrolment_grade_actions a WHERE a.transaction_id=txid_current()
   AND a.actor_user_id=mass_core.request_user_id() AND a.enrolment_id=(to_jsonb(OLD)->>'id')::uuid
   AND a.from_grade=to_jsonb(OLD)->>'grade_label' AND a.to_grade=to_jsonb(NEW)->>'grade_label') THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='enrollment standard change requires an audited correction';END IF;
 IF cardinality(allowed)=0 OR
$body$);
END;$guard$;

ALTER TABLE mass_core.student_academic_revisions
 ADD COLUMN grade_label text CHECK(grade_label IS NULL OR grade_label ~ '^(10|[1-9])$');

CREATE OR REPLACE FUNCTION mass_core.guard_academic_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='academic history is retained';END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['status','grade_label','row_version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','grade_label','row_version']) OR NEW.row_version<>OLD.row_version THEN
   RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='academic identity is immutable';END IF;
  NEW.row_version:=OLD.row_version+1;
 END IF;
 RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION mass_core.audit_academic_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO mass_core.student_academic_revisions(profile_id,revision,status,grade_label,actor_user_id)
 VALUES(NEW.id,NEW.row_version,NEW.status,NEW.grade_label,mass_core.request_user_id());
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION mass_core.guard_academic_profile(),mass_core.audit_academic_profile() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mass_api.save_student_profile_year_v2(
 p_child uuid,p_enrolment uuid,p_profile_expected bigint,p_enrolment_expected bigint,
 p_name text,p_gender text,p_board boolean,p_year uuid,p_status text,p_grade text,p_year_expected bigint
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments;old mass_core.student_academic_profiles;n bigint;
BEGIN
 PERFORM mass_core.require_staff_session();
 PERFORM mass_core.require_operation_enabled('profiles');
 IF p_grade IS NULL OR p_grade !~ '^(10|[1-9])$' OR p_status NOT IN ('Active','Graduated','Dropped Out') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid current standard and status required';END IF;
 SELECT * INTO e FROM mass_core.enrolments WHERE id=p_enrolment AND child_id=p_child FOR UPDATE;
 IF e.id IS NULL OR NOT mass_core.can_write(e.centre_id) OR NOT mass_core.can_write_child(p_child) OR NOT mass_core.can_read_profile(p_child) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authorised student profile required';END IF;
 PERFORM mass_core.expected_version(e.row_version,p_enrolment_expected);
 IF NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.id=p_year AND e.starts_on>=y.starts_on AND e.starts_on<y.ends_before
  AND (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date>=y.starts_on AND (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date<y.ends_before) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='only the active enrollment year may be updated';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_child::text||p_year::text,0));
 SELECT * INTO old FROM mass_core.student_academic_profiles WHERE child_id=p_child AND academic_year_id=p_year FOR UPDATE;
 PERFORM mass_core.expected_version(coalesce(old.row_version,0),p_year_expected);
 n:=mass_api.correct_profile(p_child,p_profile_expected,p_name,p_gender,p_board);
 IF e.grade_label IS DISTINCT FROM p_grade THEN
  INSERT INTO mass_core.enrolment_grade_actions(enrolment_id,actor_user_id,from_grade,to_grade) VALUES(e.id,mass_core.request_user_id(),e.grade_label,p_grade);
  UPDATE mass_core.enrolments SET grade_label=p_grade WHERE id=e.id;
 END IF;
 IF old.id IS NULL THEN
  INSERT INTO mass_core.student_academic_profiles(child_id,academic_year_id,enrolment_id,grade_label,status)
  VALUES(p_child,p_year,e.id,p_grade,p_status);
 ELSE
  UPDATE mass_core.student_academic_profiles SET grade_label=p_grade,status=p_status WHERE id=old.id;
 END IF;
 RETURN n;
END;$$;
REVOKE ALL ON FUNCTION mass_api.save_student_profile_year_v2(uuid,uuid,bigint,bigint,text,text,boolean,uuid,text,text,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.save_student_profile_year_v2(uuid,uuid,bigint,bigint,text,text,boolean,uuid,text,text,bigint) TO authenticated;

DO $history_enrolment_version$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('mass_api.student_academic_history(uuid)'::regprocedure);
 IF position('e.id enrolment_id,e.grade_label,' IN d)=0 OR position('''version'',coalesce(a.row_version,0),''editable''' IN d)=0 THEN
  RAISE EXCEPTION 'Unexpected student academic history API';END IF;
 d:=replace(d,'e.id enrolment_id,e.grade_label,','e.id enrolment_id,e.grade_label,e.row_version enrolment_version,');
 d:=replace(d,'''version'',coalesce(a.row_version,0),''editable''','''version'',coalesce(a.row_version,0),''enrolment_version'',s.enrolment_version,''editable''');
 EXECUTE d;
END;$history_enrolment_version$;

-- All student sessions use the attendance fact table. Separate codes and an
-- explicit type keep non-classroom sessions out of P/(P+A+L) calculations.
ALTER TABLE mass_core.attendance_codes DROP CONSTRAINT attendance_codes_code_check;
ALTER TABLE mass_core.attendance_codes ADD CONSTRAINT attendance_codes_code_check CHECK(code IN ('P','A','L','WO','MM','H','MMP','MMA','ADP','ADA'));
INSERT INTO mass_core.attendance_codes(code,meaning) VALUES
 ('MMP','Monthly Meeting present'),('MMA','Monthly Meeting absent'),
 ('ADP','Activity Day present'),('ADA','Activity Day absent');
ALTER TABLE mass_core.attendance_records
 ADD COLUMN session_type text NOT NULL DEFAULT 'Classroom' CHECK(session_type IN ('Classroom','Monthly Meeting','Activity Day')),
 ADD COLUMN session_subtype text CHECK(session_subtype IS NULL OR session_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2')),
 ADD CONSTRAINT attendance_session_shape CHECK(
  (session_type='Classroom' AND session_subtype IS NULL AND code NOT IN ('MMP','MMA','ADP','ADA'))
  OR (session_type='Monthly Meeting' AND session_subtype IS NULL AND code IN ('MMP','MMA'))
  OR (session_type='Activity Day' AND session_subtype IS NOT NULL AND code IN ('ADP','ADA'))
 );
DO $drop_attendance_identity$
DECLARE constraint_name text;
BEGIN
 SELECT conname INTO constraint_name FROM pg_constraint
 WHERE conrelid='mass_core.attendance_records'::regclass AND contype='u'
  AND pg_get_constraintdef(oid)='UNIQUE (child_id, centre_id, shift_code, attendance_date)';
 IF constraint_name IS NULL THEN RAISE EXCEPTION 'Expected attendance record identity constraint not found';END IF;
 EXECUTE format('ALTER TABLE mass_core.attendance_records DROP CONSTRAINT %I',constraint_name);
END;$drop_attendance_identity$;
CREATE UNIQUE INDEX attendance_record_session_context ON mass_core.attendance_records(child_id,centre_id,shift_code,attendance_date,session_type,coalesce(session_subtype,''));

-- Existing attendance reads predate session_type. Keep every classroom report,
-- register page and annual recorded-day count isolated from student sessions.
DO $classroom_reads$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('mass_api.attendance_register_summary(uuid[],date,date,text,text,text)'::regprocedure);
 IF position('WHERE a.centre_id=ANY(p_centres) AND a.attendance_date>=p_from' IN d)=0 THEN RAISE EXCEPTION 'Unexpected attendance summary API';END IF;
 EXECUTE replace(d,'WHERE a.centre_id=ANY(p_centres) AND a.attendance_date>=p_from','WHERE a.session_type=''Classroom'' AND a.centre_id=ANY(p_centres) AND a.attendance_date>=p_from');

 d:=pg_get_functiondef('mass_api.attendance_register_page_v2(uuid[],date,date,text,text,text,integer,integer,text,boolean,text)'::regprocedure);
 IF position('AND a.attendance_date=s.session_date)' IN d)=0 THEN RAISE EXCEPTION 'Unexpected attendance register page API';END IF;
 EXECUTE replace(d,'AND a.attendance_date=s.session_date)','AND a.attendance_date=s.session_date AND a.session_type=''Classroom'')');

 d:=pg_get_functiondef('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)'::regprocedure);
 IF position('WHERE ar.centre_id=c.id AND ar.attendance_date>=yr.starts_on' IN d)=0 THEN RAISE EXCEPTION 'Unexpected annual dashboard table API';END IF;
 EXECUTE replace(d,'WHERE ar.centre_id=c.id AND ar.attendance_date>=yr.starts_on','WHERE ar.centre_id=c.id AND ar.session_type=''Classroom'' AND ar.attendance_date>=yr.starts_on');

 d:=pg_get_functiondef('mass_api.reviewed_attendance_series(uuid[],uuid,date,text,text,text)'::regprocedure);
 IF position('a.enrolment_id=p.enrolment_id AND a.attendance_date>=p.m_from' IN d)=0 THEN RAISE EXCEPTION 'Unexpected reviewed attendance series API';END IF;
 EXECUTE replace(d,'a.enrolment_id=p.enrolment_id AND a.attendance_date>=p.m_from','a.enrolment_id=p.enrolment_id AND a.session_type=''Classroom'' AND a.attendance_date>=p.m_from');

 d:=pg_get_functiondef('mass_api.reviewed_attendance_by_centre_month(uuid[],uuid,date,text,text,text)'::regprocedure);
 IF position('a.enrolment_id=p.enrolment_id AND a.attendance_date>=p.m_from' IN d)=0 THEN RAISE EXCEPTION 'Unexpected reviewed centre attendance series API';END IF;
 EXECUTE replace(d,'a.enrolment_id=p.enrolment_id AND a.attendance_date>=p.m_from','a.enrolment_id=p.enrolment_id AND a.session_type=''Classroom'' AND a.attendance_date>=p.m_from');
END;$classroom_reads$;

CREATE OR REPLACE FUNCTION mass_core.attendance_register_snapshot(p_centre uuid,p_shift text,p_date date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
 FROM mass_core.attendance_records a WHERE a.centre_id=p_centre AND a.shift_code=p_shift AND a.attendance_date=p_date AND a.session_type='Classroom'
$$;

-- The installed classroom save/delete APIs predate session_type. Patch only
-- their exact record lookups, leaving authorization, auditing and idempotency intact.
DO $classroom_apis$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('mass_api.save_attendance_register_v3(uuid,uuid,text,date,text,jsonb,text,text)'::regprocedure);
 IF position('AND attendance_date=p_date FOR UPDATE' IN d)=0 THEN RAISE EXCEPTION 'Unexpected classroom save API';END IF;
 EXECUTE replace(d,'AND attendance_date=p_date FOR UPDATE','AND attendance_date=p_date AND session_type=''Classroom'' FOR UPDATE');
 d:=pg_get_functiondef('mass_api.delete_attendance_register_v3(uuid,uuid,text,date,text,text)'::regprocedure);
 IF position('WHERE centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date;' IN d)=0 THEN RAISE EXCEPTION 'Unexpected classroom delete API';END IF;
 d:=replace(d,'WHERE centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date;','WHERE centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date AND session_type=''Classroom'';');
 EXECUTE d;
END;$classroom_apis$;

-- Overview aggregate reports accept either a bounded monthly window or the
-- complete configured academic year selected by the user.
DO $annual_overview$
DECLARE d text;old_rule text;new_rule text;
BEGIN
 IF to_regprocedure('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)') IS NULL THEN RETURN;END IF;
 d:=pg_get_functiondef('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)'::regprocedure);
 old_rule:='extract(day FROM p_from)<>1 OR p_until<>(p_from+interval ''1 month'')::date OR NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.id=p_year AND p_from>=y.starts_on AND p_until<=y.ends_before)';
 new_rule:='p_until<=p_from OR p_until-p_from>366 OR NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.id=p_year AND p_from>=y.starts_on AND p_until<=y.ends_before)';
 IF position(old_rule IN d)=0 THEN RAISE EXCEPTION 'Unexpected Overview report window validation';END IF;
 d:=replace(d,old_rule,new_rule);
 IF position('FROM mass_core.attendance_records a JOIN pop p ON p.id=a.enrolment_id WHERE a.attendance_date>=p_from' IN d)=0
  OR position('a.enrolment_id=p.id AND a.attendance_date=d::date AND a.attendance_date>=p_from' IN d)=0 THEN
  RAISE EXCEPTION 'Unexpected Overview classroom attendance calculation';END IF;
 d:=replace(d,'FROM mass_core.attendance_records a JOIN pop p ON p.id=a.enrolment_id WHERE a.attendance_date>=p_from',
  'FROM mass_core.attendance_records a JOIN pop p ON p.id=a.enrolment_id WHERE a.session_type=''Classroom'' AND a.attendance_date>=p_from');
 d:=replace(d,'a.enrolment_id=p.id AND a.attendance_date=d::date AND a.attendance_date>=p_from',
  'a.enrolment_id=p.id AND a.session_type=''Classroom'' AND a.attendance_date=d::date AND a.attendance_date>=p_from');
 EXECUTE d;
END;$annual_overview$;

CREATE TABLE mass_core.student_session_actions(
 request_id uuid PRIMARY KEY,actor_user_id uuid NOT NULL,centre_id uuid NOT NULL REFERENCES mass_core.centres(id),
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),session_date date NOT NULL,
 session_type text NOT NULL CHECK(session_type IN ('Monthly Meeting','Activity Day')),session_subtype text,
 signature text NOT NULL,before_records jsonb NOT NULL,changed_count integer NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((session_type='Monthly Meeting' AND session_subtype IS NULL) OR (session_type='Activity Day' AND session_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2')))
);
ALTER TABLE mass_core.student_session_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.student_session_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY student_session_action_owner ON mass_core.student_session_actions TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER immutable_student_session_action BEFORE UPDATE OR DELETE ON mass_core.student_session_actions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate_student_session_action BEFORE TRUNCATE ON mass_core.student_session_actions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
REVOKE ALL ON mass_core.student_session_actions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mass_core.student_session_snapshot(p_centre uuid,p_shift text,p_date date,p_type text,p_subtype text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
 FROM mass_core.attendance_records a
 WHERE a.centre_id=p_centre AND a.shift_code=p_shift AND a.attendance_date=p_date AND a.session_type=p_type AND a.session_subtype IS NOT DISTINCT FROM p_subtype
$$;
REVOKE ALL ON FUNCTION mass_core.student_session_snapshot(uuid,text,date,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mass_api.read_student_session_register(p_centre uuid,p_shift text,p_date date,p_type text,p_subtype text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE roster jsonb;marks jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centre IS NULL OR NOT mass_core.can_write(p_centre) OR p_shift NOT IN ('Morning','Evening') OR p_date IS NULL OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
  OR NOT ((p_type='Monthly Meeting' AND p_subtype IS NULL) OR (p_type='Activity Day' AND p_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2'))) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid student session context required';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'student_id',c.student_id,'name',CASE WHEN mass_core.can_read_profile(e.child_id) THEN p.full_name ELSE NULL END,'grade',e.grade_label) ORDER BY c.student_id,e.id),'[]'::jsonb) INTO roster
 FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.centre_id=p_centre AND e.shift_code=p_shift AND e.starts_on<=p_date AND (e.ends_before IS NULL OR p_date<e.ends_before);
 marks:=mass_core.student_session_snapshot(p_centre,p_shift,p_date,p_type,p_subtype);
 RETURN jsonb_build_object('roster',roster,'marks',(SELECT coalesce(jsonb_agg(jsonb_build_object('enrolment',x->>'enrolment_id','code',CASE WHEN x->>'code' IN ('MMP','ADP') THEN 'P' ELSE 'A' END)),'[]'::jsonb) FROM jsonb_array_elements(marks)x),'token',md5(marks::text),'recorded',jsonb_array_length(marks));
END;$$;

CREATE FUNCTION mass_api.save_student_session_register(
 p_request uuid,p_centre uuid,p_shift text,p_date date,p_type text,p_subtype text,p_token text,p_rows jsonb,p_reason text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE before_rows jsonb;r jsonb;e mass_core.enrolments;old mass_core.attendance_records;previous mass_core.student_session_actions;signature text;n integer:=0;expected integer;stored_code text;
BEGIN
 PERFORM mass_core.require_staff_session();
 PERFORM mass_core.require_operation_enabled('attendance_entry');
 IF p_request IS NULL OR p_centre IS NULL OR NOT mass_core.can_write(p_centre) OR p_shift NOT IN ('Morning','Evening') OR p_date IS NULL OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
  OR NOT ((p_type='Monthly Meeting' AND p_subtype IS NULL) OR (p_type='Activity Day' AND p_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2')))
  OR p_token IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows)x GROUP BY x->>'enrolment' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows)x WHERE x->>'code' NOT IN ('P','A')) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded complete student session marks required';END IF;
 signature:=md5(jsonb_build_array(p_centre,p_shift,p_date,p_type,p_subtype,p_token,p_rows,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('student-session-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.student_session_actions WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.signature<>signature THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN previous.changed_count;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('student-session.'||p_centre||'.'||p_shift||'.'||p_date||'.'||p_type||'.'||coalesce(p_subtype,''),0));
 before_rows:=mass_core.student_session_snapshot(p_centre,p_shift,p_date,p_type,p_subtype);
 IF p_token IS DISTINCT FROM md5(before_rows::text) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='student session changed; reload the register';END IF;
 SELECT count(*) INTO expected FROM mass_core.enrolments x WHERE x.centre_id=p_centre AND x.shift_code=p_shift AND x.starts_on<=p_date AND (x.ends_before IS NULL OR p_date<x.ends_before);
 IF jsonb_array_length(p_rows)<>expected THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='student roster changed; reload the register';END IF;
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows)x ORDER BY x->>'enrolment' LOOP
  e:=mass_core.writable_enrolment((r->>'enrolment')::uuid);
  IF e.centre_id<>p_centre OR e.shift_code<>p_shift OR p_date<e.starts_on OR (e.ends_before IS NOT NULL AND p_date>=e.ends_before) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='mark outside student session roster';END IF;
  stored_code:=CASE WHEN p_type='Monthly Meeting' AND r->>'code'='P' THEN 'MMP' WHEN p_type='Monthly Meeting' THEN 'MMA' WHEN r->>'code'='P' THEN 'ADP' ELSE 'ADA' END;
  SELECT * INTO old FROM mass_core.attendance_records WHERE child_id=e.child_id AND centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date AND session_type=p_type AND session_subtype IS NOT DISTINCT FROM p_subtype FOR UPDATE;
  IF old.id IS NULL THEN
   INSERT INTO mass_core.attendance_records(child_id,centre_id,shift_code,enrolment_id,attendance_date,code,session_type,session_subtype) VALUES(e.child_id,p_centre,p_shift,e.id,p_date,stored_code,p_type,p_subtype);n:=n+1;
  ELSIF old.enrolment_id<>e.id THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='student session enrollment conflict';
  ELSIF old.code IS DISTINCT FROM stored_code THEN UPDATE mass_core.attendance_records SET code=stored_code WHERE id=old.id;n:=n+1;
  END IF;
 END LOOP;
 INSERT INTO mass_core.student_session_actions(request_id,actor_user_id,centre_id,shift_code,session_date,session_type,session_subtype,signature,before_records,changed_count)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,p_type,p_subtype,signature,before_rows,n);
 RETURN n;
END;$$;

CREATE FUNCTION mass_api.annual_learning_metrics(p_centres uuid[],p_year uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE starts date;ends date;result jsonb;c uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_year IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded annual metric scope required';END IF;
 FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre scope required';END IF;END LOOP;
 SELECT starts_on,ends_before INTO starts,ends FROM mass_core.academic_years WHERE id=p_year;
 IF starts IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='configured academic year required';END IF;
 WITH centre_metrics AS MATERIALIZED(
  SELECT centre id,
   (SELECT count(*) FROM mass_core.attendance_records a WHERE a.centre_id=centre AND a.session_type='Activity Day' AND a.attendance_date>=starts AND a.attendance_date<ends AND a.code='ADP') engagement_present,
   (SELECT count(*) FROM mass_core.attendance_records a WHERE a.centre_id=centre AND a.session_type='Activity Day' AND a.attendance_date>=starts AND a.attendance_date<ends AND a.code IN ('ADP','ADA')) engagement_expected,
   (SELECT count(a.score) FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods q ON q.id=d.period_id WHERE a.centre_id=centre AND q.academic_year_id=p_year AND a.score IS NOT NULL) score_n,
   (SELECT avg(a.score) FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods q ON q.id=d.period_id WHERE a.centre_id=centre AND q.academic_year_id=p_year AND a.score IS NOT NULL) score_mean
  FROM unnest(p_centres) centre
 ), totals AS(SELECT sum(engagement_present)ep,sum(engagement_expected)ee,sum(score_n)sn,
  (SELECT avg(a.score) FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods q ON q.id=d.period_id WHERE a.centre_id=ANY(p_centres) AND q.academic_year_id=p_year AND a.score IS NOT NULL)sm FROM centre_metrics)
 SELECT jsonb_build_object('engagement_present',coalesce(ep,0),'engagement_expected',coalesce(ee,0),'engagement_rate',CASE WHEN ee>0 THEN 100.0*ep/ee END,
  'score_n',coalesce(sn,0),'score_mean',sm,'centres',(SELECT coalesce(jsonb_agg(jsonb_build_object('centre_id',id,'engagement_present',engagement_present,'engagement_expected',engagement_expected,'engagement_rate',CASE WHEN engagement_expected>0 THEN 100.0*engagement_present/engagement_expected END,'score_n',score_n,'score_mean',score_mean) ORDER BY id),'[]'::jsonb) FROM centre_metrics))
 INTO result FROM totals;
 RETURN result;
END;$$;

CREATE OR REPLACE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',7,'holiday_code',true,'profile_pages',true,'assessment_register',true,'register_timestamps',true,'profile_sort_v2',true,'register_paging',true,'present_distribution',true,'session_entry',true,'student_sessions',true,'academic_history',true,'enabled',coalesce((SELECT enabled FROM mass_core.attendance_register_control),false));
END;$$;

REVOKE ALL ON FUNCTION mass_api.read_student_session_register(uuid,text,date,text,text),mass_api.save_student_session_register(uuid,uuid,text,date,text,text,text,jsonb,text),mass_api.annual_learning_metrics(uuid[],uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.read_student_session_register(uuid,text,date,text,text),mass_api.save_student_session_register(uuid,uuid,text,date,text,text,text,jsonb,text),mass_api.annual_learning_metrics(uuid[],uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
