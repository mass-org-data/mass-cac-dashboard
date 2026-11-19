-- Phase 5: reviewed, scoped destructive workflows. Direct table deletion stays
-- unavailable. Every accepted deletion has an immutable, non-PII receipt and
-- must pass the same active-role, active-assignment and release controls as its
-- corresponding create/update workflow.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE TABLE mass_core.deletion_receipts (
 request_id uuid PRIMARY KEY,
 actor_user_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation IN ('STUDENT','ATTENDANCE','ASSESSMENT','ASSESSMENT_REGISTER','VISIT')),
 target_id uuid NOT NULL,
 centre_id uuid,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 300),
 confirmation_token text NOT NULL,
 signature text NOT NULL,
 impact_counts jsonb NOT NULL CHECK(jsonb_typeof(impact_counts)='object'),
 target_context jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(target_context)='object'),
 transaction_id bigint NOT NULL DEFAULT txid_current(),
 deleted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mass_core.deletion_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.deletion_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.deletion_receipts FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_append ON mass_core.deletion_receipts FOR INSERT TO mass_core_owner WITH CHECK(true);
CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE ON mass_core.deletion_receipts FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_core.deletion_receipts FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
REVOKE ALL ON mass_core.deletion_receipts FROM PUBLIC,anon,authenticated,service_role;

-- A row guard may permit deletion only when the current transaction already
-- contains the matching reviewed receipt. The receipt contains identifiers and
-- counts, never names, notes, scores, attendance marks or visit text.
CREATE FUNCTION mass_core.reviewed_deletion_allowed(p_table text,p_old jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.deletion_receipts;
BEGIN
 FOR r IN SELECT * FROM mass_core.deletion_receipts d
  WHERE d.transaction_id=txid_current() AND d.actor_user_id=mass_core.request_user_id()
 LOOP
  IF r.operation='STUDENT' AND (
   (p_table='children' AND (p_old->>'id')::uuid=r.target_id) OR
   (p_table IN ('private_child_profiles','enrolments','attendance_records','assessment_results','activity_participation','cohort_memberships','student_academic_profiles','registration_requests') AND (p_old->>'child_id')::uuid=r.target_id) OR
   (p_table='morarji_outcomes' AND EXISTS(SELECT 1 FROM mass_core.cohort_memberships m WHERE m.id=(p_old->>'membership_id')::uuid AND m.child_id=r.target_id)) OR
   (p_table='student_academic_revisions' AND EXISTS(SELECT 1 FROM mass_core.student_academic_profiles p WHERE p.id=(p_old->>'profile_id')::uuid AND p.child_id=r.target_id))
  ) THEN RETURN true; END IF;
  IF r.operation='ATTENDANCE' AND p_table='attendance_records' AND (p_old->>'id')::uuid=r.target_id THEN RETURN true; END IF;
  IF r.operation='ASSESSMENT' AND p_table='assessment_results' AND (p_old->>'id')::uuid=r.target_id THEN RETURN true; END IF;
  IF r.operation='ASSESSMENT_REGISTER' AND p_table='assessment_results'
   AND (p_old->>'centre_id')::uuid=r.centre_id AND p_old->>'shift_code'=r.target_context->>'shift'
   AND (p_old->>'definition_id')::uuid=r.target_id
   AND (CASE WHEN r.target_context->>'date_known'='true' THEN (p_old->>'assessed_on')::date=(r.target_context->>'assessed_on')::date ELSE p_old->>'assessed_on' IS NULL END)
   THEN RETURN true; END IF;
  IF r.operation='VISIT' AND ((p_table='cluster_officer_visits' AND (p_old->>'id')::uuid=r.target_id)
   OR (p_table='visit_revisions' AND (p_old->>'visit_id')::uuid=r.target_id)) THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END;$$;
REVOKE ALL ON FUNCTION mass_core.reviewed_deletion_allowed(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Forced RLS remains active for the function owner. These permissive policies
-- open only the exact rows covered by the same-transaction reviewed receipt.
CREATE POLICY reviewed_delete ON mass_core.enrolments FOR DELETE TO mass_core_owner USING(mass_core.reviewed_deletion_allowed('enrolments',to_jsonb(enrolments)));
CREATE POLICY reviewed_delete ON mass_core.attendance_records FOR DELETE TO mass_core_owner USING(mass_core.reviewed_deletion_allowed('attendance_records',to_jsonb(attendance_records)));
CREATE POLICY reviewed_delete ON mass_core.assessment_results FOR DELETE TO mass_core_owner USING(mass_core.reviewed_deletion_allowed('assessment_results',to_jsonb(assessment_results)));
CREATE POLICY reviewed_delete ON mass_core.activity_participation FOR DELETE TO mass_core_owner USING(mass_core.reviewed_deletion_allowed('activity_participation',to_jsonb(activity_participation)));
CREATE POLICY reviewed_delete ON mass_core.cohort_memberships FOR DELETE TO mass_core_owner USING(mass_core.reviewed_deletion_allowed('cohort_memberships',to_jsonb(cohort_memberships)));
CREATE POLICY reviewed_delete ON mass_core.morarji_outcomes FOR DELETE TO mass_core_owner USING(mass_core.reviewed_deletion_allowed('morarji_outcomes',to_jsonb(morarji_outcomes)));

-- Preserve every existing insert/update rule; only add the reviewed deletion
-- escape hatch ahead of each installed immutable guard.
DO $guards$
DECLARE fn regprocedure;definition text;updated text;
BEGIN
 FOREACH fn IN ARRAY ARRAY[
  'mass_core.guard_record()'::regprocedure,
  'mass_core.guard_attendance_register()'::regprocedure,
  'mass_core.guard_profile_correction()'::regprocedure,
  'mass_core.guard_academic_profile()'::regprocedure,
  'mass_core.guard_directory_immutable()'::regprocedure,
  'mass_core.guard_visit()'::regprocedure
 ] LOOP
  definition:=pg_get_functiondef(fn);
  IF position('reviewed_deletion_allowed' IN definition)>0 THEN CONTINUE; END IF;
  updated:=regexp_replace(definition,'BEGIN',E'BEGIN\n IF TG_OP=''DELETE'' AND mass_core.reviewed_deletion_allowed(TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF;',1,1);
  IF updated=definition THEN RAISE EXCEPTION 'Could not extend deletion guard %',fn;END IF;
  EXECUTE updated;
 END LOOP;
END;$guards$;

CREATE FUNCTION mass_core.student_deletion_snapshot(p_child uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE counts jsonb;state text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM mass_core.children WHERE id=p_child) THEN RETURN NULL;END IF;
 SELECT jsonb_build_object(
  'student_profiles',(SELECT count(*) FROM mass_core.private_child_profiles WHERE child_id=p_child),
  'enrolments',(SELECT count(*) FROM mass_core.enrolments WHERE child_id=p_child),
  'attendance',(SELECT count(*) FROM mass_core.attendance_records WHERE child_id=p_child),
  'assessments',(SELECT count(*) FROM mass_core.assessment_results WHERE child_id=p_child),
  'activity_participation',(SELECT count(*) FROM mass_core.activity_participation WHERE child_id=p_child),
  'cohort_memberships',(SELECT count(*) FROM mass_core.cohort_memberships WHERE child_id=p_child),
  'morarji_outcomes',(SELECT count(*) FROM mass_core.morarji_outcomes o JOIN mass_core.cohort_memberships m ON m.id=o.membership_id WHERE m.child_id=p_child),
  'academic_profiles',(SELECT count(*) FROM mass_core.student_academic_profiles WHERE child_id=p_child),
  'academic_revisions',(SELECT count(*) FROM mass_core.student_academic_revisions r JOIN mass_core.student_academic_profiles p ON p.id=r.profile_id WHERE p.child_id=p_child),
  'registration_receipts',(SELECT count(*) FROM mass_core.registration_requests WHERE child_id=p_child),
  'shared_activity_events_retained',(SELECT count(DISTINCT event_id) FROM mass_core.activity_participation WHERE child_id=p_child),
  'shared_cohorts_retained',(SELECT count(DISTINCT cohort_id) FROM mass_core.cohort_memberships WHERE child_id=p_child)
 ) INTO counts;
 SELECT string_agg(v,'|' ORDER BY v) INTO state FROM (
  SELECT 'child:'||id||':'||row_version v FROM mass_core.children WHERE id=p_child
  UNION ALL SELECT 'profile:'||id||':'||row_version FROM mass_core.private_child_profiles WHERE child_id=p_child
  UNION ALL SELECT 'enrolment:'||id||':'||row_version FROM mass_core.enrolments WHERE child_id=p_child
  UNION ALL SELECT 'attendance:'||id||':'||row_version FROM mass_core.attendance_records WHERE child_id=p_child
  UNION ALL SELECT 'assessment:'||id||':'||row_version FROM mass_core.assessment_results WHERE child_id=p_child
  UNION ALL SELECT 'participation:'||id||':'||row_version FROM mass_core.activity_participation WHERE child_id=p_child
  UNION ALL SELECT 'membership:'||id||':'||row_version FROM mass_core.cohort_memberships WHERE child_id=p_child
  UNION ALL SELECT 'outcome:'||o.id||':'||o.row_version FROM mass_core.morarji_outcomes o JOIN mass_core.cohort_memberships m ON m.id=o.membership_id WHERE m.child_id=p_child
  UNION ALL SELECT 'academic:'||id||':'||row_version FROM mass_core.student_academic_profiles WHERE child_id=p_child
  UNION ALL SELECT 'academic-revision:'||r.id||':'||r.revision FROM mass_core.student_academic_revisions r JOIN mass_core.student_academic_profiles p ON p.id=r.profile_id WHERE p.child_id=p_child
  UNION ALL SELECT 'registration:'||request_id FROM mass_core.registration_requests WHERE child_id=p_child
 ) s;
 RETURN jsonb_build_object('child_id',p_child,'counts',counts,'token',md5(coalesce(state,'')));
END;$$;
REVOKE ALL ON FUNCTION mass_core.student_deletion_snapshot(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mass_core.assert_student_deletion_dependencies() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE unexpected text;
BEGIN
 SELECT string_agg(conrelid::regclass::text,', ' ORDER BY conrelid::regclass::text) INTO unexpected
 FROM pg_constraint WHERE contype='f' AND confrelid=ANY(ARRAY[
  'mass_core.children'::regclass,'mass_core.enrolments'::regclass,'mass_core.cohort_memberships'::regclass,'mass_core.student_academic_profiles'::regclass
 ]) AND conrelid<>ALL(ARRAY[
  'mass_core.private_child_profiles'::regclass,'mass_core.enrolments'::regclass,'mass_core.attendance_records'::regclass,
  'mass_core.assessment_results'::regclass,'mass_core.activity_participation'::regclass,'mass_core.cohort_memberships'::regclass,
  'mass_core.morarji_outcomes'::regclass,'mass_core.student_academic_profiles'::regclass,'mass_core.student_academic_revisions'::regclass,
  'mass_core.registration_requests'::regclass
 ]);
 IF unexpected IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='unreviewed student dependency prevents deletion',DETAIL=unexpected;END IF;
END;$$;
REVOKE ALL ON FUNCTION mass_core.assert_student_deletion_dependencies() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mass_api.preview_student_deletion(p_child uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE value jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF mass_core.application_role()<>'Leadership' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Leadership role required';END IF;
 PERFORM mass_core.assert_student_deletion_dependencies();
 value:=mass_core.student_deletion_snapshot(p_child);
 IF value IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='student not found';END IF;
 RETURN value;
END;$$;

CREATE FUNCTION mass_api.delete_student_cascade(p_request uuid,p_child uuid,p_token text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE value jsonb;previous mass_core.deletion_receipts;signature text;
BEGIN
 -- MASS_ACTIVATION_GUARD_V1
 PERFORM mass_core.require_operation_enabled('student_deletion');
 PERFORM mass_core.require_staff_session();
 IF mass_core.application_role()<>'Leadership' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Leadership role required';END IF;
 IF p_request IS NULL OR p_child IS NULL OR p_token IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='confirmation token and deletion reason required';END IF;
 signature:=md5(jsonb_build_array(p_child,p_token,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('deletion-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.deletion_receipts WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.operation<>'STUDENT' OR previous.signature<>signature THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN jsonb_build_object('request_id',p_request,'counts',previous.impact_counts,'deleted_at',previous.deleted_at);
 END IF;
 PERFORM mass_core.assert_student_deletion_dependencies();
 PERFORM pg_advisory_xact_lock(hashtextextended('student-delete.'||p_child::text,0));
 PERFORM 1 FROM mass_core.children WHERE id=p_child FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='student not found';END IF;
 PERFORM 1 FROM mass_core.enrolments WHERE child_id=p_child ORDER BY id FOR UPDATE;
 PERFORM 1 FROM mass_core.private_child_profiles WHERE child_id=p_child FOR UPDATE;
 value:=mass_core.student_deletion_snapshot(p_child);
 IF value->>'token' IS DISTINCT FROM p_token THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='student records changed; review deletion impact again';END IF;
 INSERT INTO mass_core.deletion_receipts(request_id,actor_user_id,operation,target_id,reason,confirmation_token,signature,impact_counts)
 VALUES(p_request,mass_core.request_user_id(),'STUDENT',p_child,p_reason,p_token,signature,value->'counts');
 DELETE FROM mass_core.registration_requests WHERE child_id=p_child;
 DELETE FROM mass_core.student_academic_revisions r USING mass_core.student_academic_profiles p WHERE r.profile_id=p.id AND p.child_id=p_child;
 DELETE FROM mass_core.student_academic_profiles WHERE child_id=p_child;
 DELETE FROM mass_core.morarji_outcomes o USING mass_core.cohort_memberships m WHERE o.membership_id=m.id AND m.child_id=p_child;
 DELETE FROM mass_core.cohort_memberships WHERE child_id=p_child;
 DELETE FROM mass_core.activity_participation WHERE child_id=p_child;
 DELETE FROM mass_core.assessment_results WHERE child_id=p_child;
 DELETE FROM mass_core.attendance_records WHERE child_id=p_child;
 DELETE FROM mass_core.private_child_profiles WHERE child_id=p_child;
 DELETE FROM mass_core.enrolments WHERE child_id=p_child;
 DELETE FROM mass_core.children WHERE id=p_child;
 IF EXISTS(SELECT 1 FROM mass_core.children WHERE id=p_child) THEN RAISE EXCEPTION 'student deletion incomplete';END IF;
 RETURN jsonb_build_object('request_id',p_request,'counts',value->'counts','deleted_at',(SELECT deleted_at FROM mass_core.deletion_receipts WHERE request_id=p_request));
END;$$;

CREATE FUNCTION mass_api.delete_attendance_record(p_request uuid,p_record uuid,p_expected bigint,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old mass_core.attendance_records;previous mass_core.deletion_receipts;signature text;
BEGIN
 -- MASS_ACTIVATION_GUARD_V1
 PERFORM mass_core.require_operation_enabled('attendance_entry');
 PERFORM mass_core.require_staff_session();
 IF p_request IS NULL OR p_record IS NULL OR p_expected IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='record version and deletion reason required';END IF;
 signature:=md5(jsonb_build_array(p_record,p_expected,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('deletion-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.deletion_receipts WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.operation<>'ATTENDANCE' OR previous.signature<>signature THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN jsonb_build_object('request_id',p_request,'deleted_at',previous.deleted_at);
 END IF;
 SELECT * INTO old FROM mass_core.attendance_records WHERE id=p_record FOR UPDATE;
 IF old.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='attendance record not found';END IF;
 IF NOT mass_core.can_write(old.centre_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required';END IF;
 IF old.row_version<>p_expected THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance changed; reload the record';END IF;
 INSERT INTO mass_core.deletion_receipts(request_id,actor_user_id,operation,target_id,centre_id,reason,confirmation_token,signature,impact_counts)
 VALUES(p_request,mass_core.request_user_id(),'ATTENDANCE',old.id,old.centre_id,p_reason,p_expected::text,signature,'{"attendance":1}'::jsonb);
 DELETE FROM mass_core.attendance_records WHERE id=old.id;
 RETURN jsonb_build_object('request_id',p_request,'deleted_at',(SELECT deleted_at FROM mass_core.deletion_receipts WHERE request_id=p_request));
END;$$;

CREATE FUNCTION mass_api.preview_assessment_register_deletion(p_centre uuid,p_shift text,p_definition uuid,p_assessed_on date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;token text;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centre IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_definition IS NULL OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned assessment register required';END IF;
 SELECT count(*),md5(coalesce(string_agg(id::text||':'||row_version::text,'|' ORDER BY id),'')) INTO n,token FROM mass_core.assessment_results
 WHERE centre_id=p_centre AND shift_code=p_shift AND definition_id=p_definition AND assessed_on IS NOT DISTINCT FROM p_assessed_on;
 RETURN jsonb_build_object('count',n,'token',token,'date_known',p_assessed_on IS NOT NULL,'assessed_on',p_assessed_on);
END;$$;

CREATE FUNCTION mass_api.delete_assessment_record(p_request uuid,p_record uuid,p_expected bigint,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old mass_core.assessment_results;previous mass_core.deletion_receipts;signature text;
BEGIN
 -- MASS_ACTIVATION_GUARD_V1
 PERFORM mass_core.require_operation_enabled('assessment_entry');
 PERFORM mass_core.require_staff_session();
 IF p_request IS NULL OR p_record IS NULL OR p_expected IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='record version and deletion reason required';END IF;
 signature:=md5(jsonb_build_array(p_record,p_expected,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('deletion-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.deletion_receipts WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.operation<>'ASSESSMENT' OR previous.signature<>signature THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN jsonb_build_object('request_id',p_request,'deleted_at',previous.deleted_at);
 END IF;
 SELECT * INTO old FROM mass_core.assessment_results WHERE id=p_record FOR UPDATE;
 IF old.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='assessment result not found';END IF;
 IF NOT mass_core.can_write(old.centre_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required';END IF;
 IF old.row_version<>p_expected THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='assessment changed; reload the record';END IF;
 INSERT INTO mass_core.deletion_receipts(request_id,actor_user_id,operation,target_id,centre_id,reason,confirmation_token,signature,impact_counts)
 VALUES(p_request,mass_core.request_user_id(),'ASSESSMENT',old.id,old.centre_id,p_reason,p_expected::text,signature,'{"assessments":1}'::jsonb);
 DELETE FROM mass_core.assessment_results WHERE id=old.id;
 RETURN jsonb_build_object('request_id',p_request,'deleted_at',(SELECT deleted_at FROM mass_core.deletion_receipts WHERE request_id=p_request));
END;$$;

CREATE FUNCTION mass_api.delete_assessment_register(p_request uuid,p_centre uuid,p_shift text,p_definition uuid,p_assessed_on date,p_token text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;token text;previous mass_core.deletion_receipts;signature text;context jsonb;
BEGIN
 -- MASS_ACTIVATION_GUARD_V1
 PERFORM mass_core.require_operation_enabled('assessment_entry');
 PERFORM mass_core.require_staff_session();
 IF p_request IS NULL OR p_centre IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_definition IS NULL OR p_token IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned register, token and deletion reason required';END IF;
 context:=jsonb_build_object('shift',p_shift,'date_known',p_assessed_on IS NOT NULL,'assessed_on',p_assessed_on);
 signature:=md5(jsonb_build_array(p_centre,p_shift,p_definition,p_assessed_on,p_token,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('deletion-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.deletion_receipts WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.operation<>'ASSESSMENT_REGISTER' OR previous.signature<>signature THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN jsonb_build_object('request_id',p_request,'count',(previous.impact_counts->>'assessments')::integer,'deleted_at',previous.deleted_at);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('assessment-register.'||p_centre||'.'||p_shift||'.'||p_definition||'.'||coalesce(p_assessed_on::text,'unknown'),0));
 PERFORM 1 FROM mass_core.assessment_results WHERE centre_id=p_centre AND shift_code=p_shift AND definition_id=p_definition AND assessed_on IS NOT DISTINCT FROM p_assessed_on ORDER BY id FOR UPDATE;
 SELECT count(*),md5(coalesce(string_agg(id::text||':'||row_version::text,'|' ORDER BY id),'')) INTO n,token FROM mass_core.assessment_results WHERE centre_id=p_centre AND shift_code=p_shift AND definition_id=p_definition AND assessed_on IS NOT DISTINCT FROM p_assessed_on;
 IF n=0 OR token IS DISTINCT FROM p_token THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='assessment register changed; review deletion impact again';END IF;
 INSERT INTO mass_core.deletion_receipts(request_id,actor_user_id,operation,target_id,centre_id,reason,confirmation_token,signature,impact_counts,target_context)
 VALUES(p_request,mass_core.request_user_id(),'ASSESSMENT_REGISTER',p_definition,p_centre,p_reason,p_token,signature,jsonb_build_object('assessments',n),context);
 DELETE FROM mass_core.assessment_results WHERE centre_id=p_centre AND shift_code=p_shift AND definition_id=p_definition AND assessed_on IS NOT DISTINCT FROM p_assessed_on;
 RETURN jsonb_build_object('request_id',p_request,'count',n,'deleted_at',(SELECT deleted_at FROM mass_core.deletion_receipts WHERE request_id=p_request));
END;$$;

CREATE FUNCTION mass_api.delete_visit(p_request uuid,p_visit uuid,p_expected bigint,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old mass_core.cluster_officer_visits;previous mass_core.deletion_receipts;signature text;revisions integer;
BEGIN
 -- MASS_ACTIVATION_GUARD_V1
 PERFORM mass_core.require_operation_enabled('visit_entry');
 PERFORM mass_core.require_staff_session();
 IF p_request IS NULL OR p_visit IS NULL OR p_expected IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='visit version and deletion reason required';END IF;
 signature:=md5(jsonb_build_array(p_visit,p_expected,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('deletion-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.deletion_receipts WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.operation<>'VISIT' OR previous.signature<>signature THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN jsonb_build_object('request_id',p_request,'deleted_at',previous.deleted_at);
 END IF;
 SELECT * INTO old FROM mass_core.cluster_officer_visits WHERE id=p_visit FOR UPDATE;
 IF old.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='visit not found';END IF;
 IF NOT mass_core.can_record_visit(old.centre_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cluster Officer or Leadership centre authority required';END IF;
 IF old.row_version<>p_expected THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='visit changed; reload the record';END IF;
 SELECT count(*) INTO revisions FROM mass_core.visit_revisions WHERE visit_id=old.id;
 INSERT INTO mass_core.deletion_receipts(request_id,actor_user_id,operation,target_id,centre_id,reason,confirmation_token,signature,impact_counts)
 VALUES(p_request,mass_core.request_user_id(),'VISIT',old.id,old.centre_id,p_reason,p_expected::text,signature,jsonb_build_object('visits',1,'visit_revisions',revisions));
 DELETE FROM mass_core.visit_revisions WHERE visit_id=old.id;
 DELETE FROM mass_core.cluster_officer_visits WHERE id=old.id;
 RETURN jsonb_build_object('request_id',p_request,'deleted_at',(SELECT deleted_at FROM mass_core.deletion_receipts WHERE request_id=p_request));
END;$$;

DO $activation$
DECLARE c record;
BEGIN
 IF to_regclass('mass_activation.features') IS NOT NULL THEN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='mass_activation.features'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%feature%attendance_entry%' LOOP
   EXECUTE format('ALTER TABLE mass_activation.features DROP CONSTRAINT %I',c.conname);
  END LOOP;
  ALTER TABLE mass_activation.features ADD CONSTRAINT features_feature_check CHECK(feature IN ('attendance_entry','attendance_corrections','assessment_entry','assessment_corrections','visit_entry','visit_corrections','transfers','profiles','enrolments','registration','calendar','activities','morarji','reviewed_reads','student_deletion'));
  INSERT INTO mass_activation.features(feature) VALUES('student_deletion') ON CONFLICT DO NOTHING;
 END IF;
END;$activation$;

REVOKE ALL ON FUNCTION mass_api.preview_student_deletion(uuid),mass_api.delete_student_cascade(uuid,uuid,text,text),mass_api.delete_attendance_record(uuid,uuid,bigint,text),mass_api.preview_assessment_register_deletion(uuid,text,uuid,date),mass_api.delete_assessment_record(uuid,uuid,bigint,text),mass_api.delete_assessment_register(uuid,uuid,text,uuid,date,text,text),mass_api.delete_visit(uuid,uuid,bigint,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.preview_student_deletion(uuid),mass_api.delete_student_cascade(uuid,uuid,text,text),mass_api.delete_attendance_record(uuid,uuid,bigint,text),mass_api.preview_assessment_register_deletion(uuid,text,uuid,date),mass_api.delete_assessment_record(uuid,uuid,bigint,text),mass_api.delete_assessment_register(uuid,uuid,text,uuid,date,text,text),mass_api.delete_visit(uuid,uuid,bigint,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
