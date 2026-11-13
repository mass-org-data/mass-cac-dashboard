-- Additive reporting reads only. No activation or hosted programme changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_foundation_owner;
-- The existing application owner may inspect only assessment audit identities.
GRANT SELECT(entity_type,entity_id,operation,actor_user_id,changed_at,id) ON mass_foundation.audit_events TO mass_core_owner;
CREATE POLICY assessment_register_audit_read ON mass_foundation.audit_events FOR SELECT TO mass_core_owner USING(entity_type='core.assessment_results');
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_api.assessment_register_summary(p_centres uuid[],p_year uuid,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS TABLE(centre_id uuid,shift_code text,assessment_date date,quarter integer,students bigint,average_score numeric,created_by text,last_edited_by text,last_edited_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_year IS NULL OR NOT EXISTS(SELECT 1 FROM mass_core.academic_years WHERE id=p_year) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded assessment selection required';END IF;
 FOREACH c IN ARRAY p_centres LOOP
  IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre required';END IF;
 END LOOP;
 RETURN QUERY WITH facts AS (
 SELECT a.*,q.quarter round FROM mass_core.assessment_results a
 JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods q ON q.id=d.period_id
 JOIN mass_core.enrolments e ON e.id=a.enrolment_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=a.child_id
 WHERE a.centre_id=ANY(p_centres) AND q.academic_year_id=p_year AND d.max_score=25
 AND (p_shift IS NULL OR a.shift_code=p_shift) AND (p_grade IS NULL OR e.grade_label=p_grade)
 AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender)
 ), grouped AS (
 SELECT a.centre_id,a.shift_code,a.assessed_on,a.round,count(DISTINCT a.child_id) n,avg(a.score) mean,array_agg(a.id) ids FROM facts a GROUP BY a.centre_id,a.shift_code,a.assessed_on,a.round
 ) SELECT g.centre_id,g.shift_code,g.assessed_on,g.round::integer,g.n,g.mean,
 coalesce(first_actor.label,'Source import / not recorded'),coalesce(last_actor.label,'Source import / not recorded'),last_actor.changed_at
 FROM grouped g
 LEFT JOIN LATERAL (SELECT CASE WHEN a.actor_user_id IS NULL THEN 'Source import / not recorded' ELSE coalesce((SELECT min(s.display_name) FROM mass_core.staff_members s WHERE s.auth_user_id=a.actor_user_id),'Staff account '||left(md5(a.actor_user_id::text),8)) END label FROM mass_foundation.audit_events a WHERE a.entity_type='core.assessment_results' AND a.entity_id=ANY(g.ids) AND a.operation='INSERT' ORDER BY a.changed_at,a.id LIMIT 1) first_actor ON true
 LEFT JOIN LATERAL (SELECT CASE WHEN a.actor_user_id IS NULL THEN 'Source import / not recorded' ELSE coalesce((SELECT min(s.display_name) FROM mass_core.staff_members s WHERE s.auth_user_id=a.actor_user_id),'Staff account '||left(md5(a.actor_user_id::text),8)) END label,a.changed_at FROM mass_foundation.audit_events a WHERE a.entity_type='core.assessment_results' AND a.entity_id=ANY(g.ids) ORDER BY a.changed_at DESC,a.id DESC LIMIT 1) last_actor ON true
 ORDER BY g.assessed_on DESC NULLS LAST,g.centre_id,g.shift_code,g.round;
END;$$;
CREATE FUNCTION mass_api.attendance_register_summary_v4(p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS TABLE(centre_id uuid,shift_code text,attendance_date date,present bigint,eligible bigint,recorded bigint,percentage numeric,total bigint,created_by text,last_edited_by text,last_edited_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 RETURN QUERY SELECT o.centre_id,o.shift_code,o.attendance_date,o.present,o.eligible,o.recorded,o.percentage,o.total,o.created_by,
 CASE WHEN o.last_edited_by='Authorized staff account' THEN coalesce(actor.label,o.last_edited_by) ELSE o.last_edited_by END,actor.changed_at
 FROM mass_api.attendance_register_summary_v3(p_centres,p_from,p_until,p_shift,p_grade,p_gender) o
 LEFT JOIN LATERAL (SELECT 'Staff account '||left(md5(a.actor_user_id::text),8) label,a.changed_at FROM mass_core.attendance_register_actions a WHERE a.centre_id=o.centre_id AND a.shift_code=o.shift_code AND a.attendance_date=o.attendance_date AND a.operation='SAVE' ORDER BY a.changed_at DESC,a.request_id DESC LIMIT 1) actor ON true;
END;$$;
CREATE FUNCTION mass_api.student_profile_page_v2(p_centres uuid[],p_on date,p_query text DEFAULT '',p_sort text DEFAULT 'name',p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 10,p_id_query text DEFAULT '',p_reverse boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; n integer; start_at integer; size integer;
BEGIN
 result:=mass_api.student_profile_page(p_centres,p_on,p_query,p_sort,p_grade,p_shift,p_gender,p_offset,p_limit,p_id_query);
 IF p_reverse IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='sort direction required';END IF;
 IF NOT p_reverse THEN RETURN result;END IF;
 n:=(result->>'total')::integer;size:=greatest(0,least(p_limit,n-p_offset));
 IF size=0 THEN RETURN jsonb_build_object('total',n,'ids','[]'::jsonb);END IF;
 start_at:=greatest(0,n-p_offset-size);
 result:=mass_api.student_profile_page(p_centres,p_on,p_query,p_sort,p_grade,p_shift,p_gender,start_at,size,p_id_query);
 RETURN result||jsonb_build_object('ids',(SELECT jsonb_agg(v ORDER BY ord DESC) FROM jsonb_array_elements(result->'ids') WITH ORDINALITY AS x(v,ord)));
END;$$;
REVOKE ALL ON FUNCTION mass_api.student_profile_page_v2(uuid[],date,text,text,text,text,text,integer,integer,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.student_profile_page_v2(uuid[],date,text,text,text,text,text,integer,integer,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',5,'holiday_code',true,'profile_pages',true,'assessment_register',true,'register_timestamps',true,'profile_sort_v2',true,'enabled',coalesce((SELECT enabled FROM mass_core.attendance_register_control),false));
END;$$;
REVOKE ALL ON FUNCTION mass_api.assessment_register_summary(uuid[],uuid,text,text,text),mass_api.attendance_register_summary_v4(uuid[],date,date,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.assessment_register_summary(uuid[],uuid,text,text,text),mass_api.attendance_register_summary_v4(uuid[],date,date,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
