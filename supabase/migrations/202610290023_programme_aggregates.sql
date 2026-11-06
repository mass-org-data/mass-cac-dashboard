-- Minimized aggregate analytics for readable centres; never returns profile rows.
BEGIN;
SET LOCAL ROLE mass_foundation_owner;
GRANT SELECT(entity_type,entity_id,operation,changed_at,change_metadata) ON mass_foundation.audit_events TO mass_core_owner;
CREATE POLICY core_revision_read ON mass_foundation.audit_events FOR SELECT TO mass_core_owner USING(entity_type LIKE 'core.%');
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_api.programme_aggregate(p_centre uuid,p_on date,p_from date,p_until date,p_year uuid,p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_read(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required';END IF;
 IF p_on IS NULL OR p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>366 OR p_year IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded report and academic year required';END IF;
 IF (p_grade IS NOT NULL AND p_grade NOT IN ('1','2','3','4','5','6','7','8','9','10')) OR (p_shift IS NOT NULL AND p_shift NOT IN ('Morning','Evening')) OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid controlled filter';END IF;
 WITH pop AS MATERIALIZED (
 SELECT e.*,p.gender_code FROM mass_core.enrolments e LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.centre_id=p_centre AND e.starts_on<=p_on AND (e.ends_before IS NULL OR p_on<e.ends_before)
 AND (p_grade IS NULL OR e.grade_label=p_grade) AND (p_shift IS NULL OR e.shift_code=p_shift) AND (p_gender IS NULL OR p.gender_code=p_gender)
 ), marks AS (
 SELECT a.* FROM mass_core.attendance_records a JOIN pop e ON e.id=a.enrolment_id WHERE a.attendance_date>=p_from AND a.attendance_date<p_until AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before)
 AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)
 ), scores AS MATERIALIZED (
 SELECT a.child_id,a.score,q.quarter,d.id definition_id FROM mass_core.assessment_results a JOIN pop e ON e.id=a.enrolment_id
 JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods q ON q.id=d.period_id WHERE q.academic_year_id=p_year
 ), quarters AS (
 SELECT d.id definition_id,q.quarter,count(s.score) n,avg(s.score) mean,
 count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score<=8) low,count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score>=9 AND s.score<=15) developing,
 count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score>=16 AND s.score<=20) good,count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score>=21 AND s.score<=25) strong,
 count(*) FILTER(WHERE s.score<>trunc(s.score)) precision_review,count(*) FILTER(WHERE s.score>20) above20
 FROM mass_core.assessment_definitions d JOIN mass_core.assessment_periods q ON q.id=d.period_id LEFT JOIN scores s ON s.definition_id=d.id WHERE q.academic_year_id=p_year GROUP BY d.id,q.quarter
 ), changes AS (
 SELECT a.quarter earlier,b.quarter later,count(*) n,avg(a.score) earlier_mean,avg(b.score) later_mean,
 count(*) FILTER(WHERE b.score>a.score) improved,count(*) FILTER(WHERE b.score=a.score) unchanged,count(*) FILTER(WHERE b.score<a.score) declined
 FROM scores a JOIN scores b ON a.child_id=b.child_id AND a.quarter<b.quarter GROUP BY a.quarter,b.quarter
 ) SELECT jsonb_build_object('centre_id',p_centre,'students',(SELECT count(DISTINCT child_id) FROM pop),
 'grades',coalesce((SELECT jsonb_object_agg(grade_label,n) FROM (SELECT grade_label,count(DISTINCT child_id) n FROM pop GROUP BY grade_label)x),'{}'::jsonb),
 'genders',coalesce((SELECT jsonb_object_agg(gender,n) FROM (SELECT coalesce(gender_code,'Unknown') gender,count(DISTINCT child_id) n FROM pop GROUP BY gender_code)x),'{}'::jsonb),
 'attendance',(SELECT jsonb_build_object('p',count(*) FILTER(WHERE code='P'),'a',count(*) FILTER(WHERE code='A'),'l',count(*) FILTER(WHERE code='L'),'excluded',count(*) FILTER(WHERE code IN ('WO','MM'))) FROM marks),
 'quarters',coalesce((SELECT jsonb_agg(to_jsonb(quarters)) FROM quarters),'[]'::jsonb),
 'changes',coalesce((SELECT jsonb_agg(to_jsonb(changes)) FROM changes),'[]'::jsonb),
 'coverage',jsonb_build_object('attendance_completeness','unverified','activity_completeness','unverified')) INTO result;
 RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.programme_aggregate(uuid,date,date,date,uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION mass_api.get_original_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN PERFORM mass_core.require_staff_session();IF NOT EXISTS(SELECT 1 FROM mass_core.centres) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned scope required';END IF;
 RETURN jsonb_build_object('original_workflows',20,'period_assessments',true,'operational_details',22,'aggregate_api',23);END;
$$;
CREATE FUNCTION mass_api.read_enrolment_basis(p_centre uuid,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(enrolment_id uuid,date_basis text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_read(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required';END IF;
 IF p_limit IS NULL OR p_offset IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded pagination required';END IF;
 RETURN QUERY SELECT e.id,CASE WHEN r.assumed_enrolment_dates THEN 'assumed' WHEN EXISTS(SELECT 1 FROM mass_core.registration_requests q WHERE q.enrolment_id=e.id) THEN 'staff-entered' ELSE 'not documented' END
 FROM mass_core.enrolments e LEFT JOIN mass_import.receipts r ON r.target_table='enrolments' AND r.target_id=e.id WHERE e.centre_id=p_centre ORDER BY e.id LIMIT p_limit OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.read_enrolment_basis(uuid,integer,integer) TO authenticated;
CREATE FUNCTION mass_api.read_record_revisions(p_centre uuid,p_entity text,p_id uuid,p_limit integer DEFAULT 100)
RETURNS TABLE(revision bigint,operation text,changed_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE allowed boolean:=false;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_read(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded revision limit required';END IF;
 CASE p_entity
 WHEN 'attendance_records' THEN SELECT EXISTS(SELECT 1 FROM mass_core.attendance_records WHERE id=p_id AND centre_id=p_centre) INTO allowed;
 WHEN 'assessment_results' THEN SELECT EXISTS(SELECT 1 FROM mass_core.assessment_results WHERE id=p_id AND centre_id=p_centre) INTO allowed;
 WHEN 'activity_events' THEN SELECT EXISTS(SELECT 1 FROM mass_core.activity_events WHERE id=p_id AND centre_id=p_centre) INTO allowed;
 WHEN 'activity_participation' THEN SELECT EXISTS(SELECT 1 FROM mass_core.activity_participation WHERE id=p_id AND centre_id=p_centre) INTO allowed;
 WHEN 'enrolments' THEN SELECT EXISTS(SELECT 1 FROM mass_core.enrolments WHERE id=p_id AND centre_id=p_centre) INTO allowed;
 WHEN 'cac_delivery_records' THEN SELECT EXISTS(SELECT 1 FROM mass_core.cac_delivery_records WHERE id=p_id AND centre_id=p_centre) INTO allowed;
 ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported revision entity';END CASE;
 IF NOT allowed THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='record outside assigned centre';END IF;
 RETURN QUERY SELECT (a.change_metadata->>'revision')::bigint,a.operation,a.changed_at FROM mass_foundation.audit_events a WHERE a.entity_type='core.'||p_entity AND a.entity_id=p_id ORDER BY a.changed_at DESC LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.read_record_revisions(uuid,text,uuid,integer) TO authenticated;
CREATE FUNCTION mass_api.transfer_student(p_child uuid,p_enrolment uuid,p_profile_expected bigint,p_enrolment_expected bigint,p_name text,p_gender text,p_board boolean,p_old_end date,p_centre uuid,p_grade text,p_shift text,p_new_start date) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE result uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_old_end IS NULL OR p_new_start IS NULL OR p_new_start<p_old_end OR p_new_start>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='explicit verified transfer dates required';END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_core.enrolments WHERE id=p_enrolment AND child_id=p_child) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified source assignment required';END IF;
 PERFORM mass_api.correct_profile(p_child,p_profile_expected,p_name,p_gender,p_board);
 PERFORM mass_api.close_enrolment(p_enrolment,p_enrolment_expected,p_old_end,'Active');
 result:=mass_api.add_enrolment(p_child,p_centre,p_grade,p_shift,p_new_start,'Active');
 RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.transfer_student(uuid,uuid,bigint,bigint,text,text,boolean,date,uuid,text,text,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
