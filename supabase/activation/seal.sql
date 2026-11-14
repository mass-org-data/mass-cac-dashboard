-- Executed INSIDE each installation transaction, before the canonical COMMIT.
-- Guards the original body without changing owner, signature, ACL, volatility,
-- search_path or SECURITY mode. Frozen source migrations are not rewritten.
SET LOCAL ROLE mass_core_owner;
DO $seal$
DECLARE p record; definition text; guarded text; expression text;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='mass_api'::regnamespace GROUP BY proname HAVING count(*)>1) THEN RAISE EXCEPTION 'Unreviewed API overload; installation held';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc proc WHERE proc.pronamespace='mass_api'::regnamespace AND proc.proname NOT IN (
 'attendance_register_page','attendance_present_distribution','save_classroom_register','save_centre_holiday','student_academic_history','save_student_academic_profile','save_student_profile_year','get_centre_event_capabilities','record_centre_event','centre_event_summary','assessment_register_summary','attendance_register_summary_v4','student_profile_page_v2','student_profile_page','get_attendance_register_capabilities','delete_attendance_register_v3','attendance_register_summary_v3','read_attendance_register_v3','save_attendance_register_v3','attendance_register_summary','attendance_register_summary_v2','read_attendance_register','save_attendance_register','delete_attendance_register','attendance_summary','get_centre_directory','get_centre_staff','get_context','get_original_capabilities','get_references','get_visit_assignments','list_students','programme_aggregate','read_activities','read_activity_details','read_assessments','read_attendance','read_calendar','read_delivery','read_enrolment_basis','read_morarji','read_participation','read_profile_revision','read_record_revisions','read_students','read_visit_history','read_visits','visit_officer_summary','visit_summary',
 'record_attendance','record_attendance_batch','record_assessment','record_assessment_batch','record_visit','transfer_student','correct_profile','correct_student','add_enrolment','close_enrolment','register_student','register_student_once','record_calendar','create_activity','record_activity_detail','record_participation','record_participation_batch','record_cac_delivery','add_morarji_member','record_morarji','reviewed_chart_metrics','reviewed_attendance_series')) THEN RAISE EXCEPTION 'Unclassified API function; installation held';END IF;
 FOR p IN SELECT proc.*,n.nspname,l.lanname FROM pg_proc proc JOIN pg_namespace n ON n.oid=proc.pronamespace JOIN pg_language l ON l.oid=proc.prolang
 WHERE n.nspname='mass_api' AND proc.proname IN
 ('record_attendance','record_attendance_batch','record_assessment','record_assessment_batch','record_visit','transfer_student','correct_profile','correct_student','add_enrolment','close_enrolment','register_student','register_student_once','record_calendar','create_activity','record_activity_detail','record_participation','record_participation_batch','record_cac_delivery','add_morarji_member','record_morarji','reviewed_chart_metrics','reviewed_attendance_series')
 LOOP
 IF p.lanname<>'plpgsql' OR p.proowner<>'mass_core_owner'::regrole THEN RAISE EXCEPTION 'Unexpected gated function language/owner';END IF;
 expression:=CASE p.proname
 WHEN 'record_attendance' THEN 'CASE WHEN p_expected=0 THEN ''attendance_entry'' ELSE ''attendance_corrections'' END'
 WHEN 'record_attendance_batch' THEN '''attendance_entry'''
 WHEN 'record_assessment' THEN 'CASE WHEN p_expected=0 THEN ''assessment_entry'' ELSE ''assessment_corrections'' END'
 WHEN 'record_assessment_batch' THEN '''assessment_entry'''
 WHEN 'record_visit' THEN 'CASE WHEN p_expected=0 THEN ''visit_entry'' ELSE ''visit_corrections'' END'
 WHEN 'transfer_student' THEN '''transfers'''
 WHEN 'correct_profile' THEN '''profiles'''
 WHEN 'correct_student' THEN '''profiles'''
 WHEN 'add_enrolment' THEN '''enrolments'''
 WHEN 'close_enrolment' THEN '''enrolments'''
 WHEN 'register_student' THEN '''registration'''
 WHEN 'register_student_once' THEN '''registration'''
 WHEN 'record_calendar' THEN '''calendar'''
 WHEN 'add_morarji_member' THEN '''morarji'''
 WHEN 'record_morarji' THEN '''morarji'''
 WHEN 'reviewed_chart_metrics' THEN '''reviewed_reads'''
 WHEN 'reviewed_attendance_series' THEN '''reviewed_reads'''
 ELSE '''activities''' END;
 IF position('-- MASS_ACTIVATION_GUARD_V1' IN p.prosrc)>0 THEN
  IF position(E'BEGIN\n -- MASS_ACTIVATION_GUARD_V1\n PERFORM mass_core.require_operation_enabled('||expression||');' IN p.prosrc)=0 THEN RAISE EXCEPTION 'Unexpected activation guard';END IF;
  CONTINUE;
 END IF;
 guarded:=regexp_replace(p.prosrc,'\mBEGIN\M',E'BEGIN\n -- MASS_ACTIVATION_GUARD_V1\n PERFORM mass_core.require_operation_enabled('||expression||');');
 IF guarded=p.prosrc THEN RAISE EXCEPTION 'Missing function entry block';END IF;
 definition:=pg_get_functiondef(p.oid);
 IF position(p.prosrc IN definition)=0 THEN RAISE EXCEPTION 'Cannot locate original function body';END IF;
 EXECUTE replace(definition,p.prosrc,guarded);
 END LOOP;
END;
$seal$;
-- Reads remain scoped; installed read support is distinct from authorized writes.
CREATE OR REPLACE FUNCTION mass_api.get_original_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE result jsonb;w jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT EXISTS(SELECT 1 FROM mass_core.centres) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned scope required';END IF;
 SELECT jsonb_object_agg(f,mass_core.operation_enabled(f)) INTO w FROM unnest(ARRAY['attendance_entry','attendance_corrections','assessment_entry','assessment_corrections','visit_entry','visit_corrections','transfers','profiles','enrolments','registration','calendar','activities','morarji']) f;
 result:=jsonb_build_object('activation_control',1,'writes',w,'original_workflows',20,'period_assessments',true);
 IF to_regprocedure('mass_api.read_delivery(uuid,date,date,integer,integer)') IS NOT NULL THEN result:=result||jsonb_build_object('operational_details',22);END IF;
 IF to_regprocedure('mass_api.programme_aggregate(uuid,date,date,date,uuid,text,text,text)') IS NOT NULL THEN result:=result||jsonb_build_object('aggregate_api',23);END IF;
 IF to_regprocedure('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)') IS NOT NULL AND mass_core.operation_enabled('reviewed_reads') THEN result:=result||jsonb_build_object('reviewed_charts',24);END IF;
 IF to_regprocedure('mass_api.reviewed_attendance_series(uuid[],uuid,date,text,text,text)') IS NOT NULL AND mass_core.operation_enabled('reviewed_reads') THEN result:=result||jsonb_build_object('reviewed_attendance_series',1);END IF;
 RETURN result;
END;$$;
NOTIFY pgrst,'reload schema';
