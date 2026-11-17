-- Bounded server pages for every React DataTable. The existing reviewed calculations and scope predicates remain authoritative.
-- No write gate, role grant, RLS policy or programme fact is changed.
-- Initial pages use p_limit=10; an explicit CSV action may request pages up to 500 and never runs during normal page load.
-- Rollback: DROP FUNCTION mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer),
--   mass_api.attendance_register_page_v2(uuid[],date,date,text,text,text,integer,integer,text,boolean,text);
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE FUNCTION mass_api.attendance_register_page_v2(
 p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL,
 p_offset integer DEFAULT 0,p_limit integer DEFAULT 10,p_sort text DEFAULT 'date',p_reverse boolean DEFAULT true,p_query text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;c uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>31
  OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_reverse IS NULL
  OR p_query IS NULL OR length(p_query)>160 OR p_sort NOT IN ('centre','shift','date','present','percentage','last_edited_at') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded register page required';END IF;
 FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre required';END IF;END LOOP;
 WITH all_rows AS MATERIALIZED(
  SELECT a.*,c.label centre_label,'Classroom'::text session_type FROM mass_api.attendance_register_summary_v4(p_centres,p_from,p_until,p_shift,p_grade,p_gender)a JOIN mass_core.centres c ON c.id=a.centre_id
  UNION ALL
  SELECT s.centre_id,s.shift_code,s.session_date,0::bigint,0::bigint,0::bigint,NULL::numeric,
   (SELECT count(*) FROM mass_core.enrolments e LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id WHERE e.centre_id=s.centre_id AND e.shift_code=s.shift_code AND e.starts_on<=s.session_date AND (e.ends_before IS NULL OR s.session_date<e.ends_before) AND (p_grade IS NULL OR e.grade_label=p_grade) AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender)),
   coalesce(actor.label,'Source import / not recorded'),coalesce(actor.label,'Source import / not recorded'),actor.changed_at,c.label,'Holiday'::text
  FROM mass_core.cac_sessions s JOIN mass_core.centres c ON c.id=s.centre_id
  LEFT JOIN LATERAL(SELECT changed_at,coalesce((SELECT min(m.display_name) FROM mass_core.staff_members m WHERE m.auth_user_id=r.actor_user_id),'Staff account '||left(md5(r.actor_user_id::text),8))label FROM mass_core.attendance_register_actions r WHERE r.centre_id=s.centre_id AND r.shift_code=s.shift_code AND r.attendance_date=s.session_date ORDER BY changed_at DESC LIMIT 1)actor ON true
  WHERE s.centre_id=ANY(p_centres) AND NOT s.is_scheduled AND s.session_date>=p_from AND s.session_date<p_until AND (p_shift IS NULL OR s.shift_code=p_shift)
   AND NOT EXISTS(SELECT 1 FROM mass_core.attendance_records a WHERE a.centre_id=s.centre_id AND a.shift_code=s.shift_code AND a.attendance_date=s.session_date)
 ),filtered AS MATERIALIZED(SELECT * FROM all_rows WHERE p_query='' OR centre_label ILIKE '%'||p_query||'%' OR shift_code ILIKE '%'||p_query||'%' OR attendance_date::text ILIKE '%'||p_query||'%'),
 page AS(SELECT * FROM filtered ORDER BY
  CASE WHEN p_sort='centre' AND NOT p_reverse THEN lower(centre_label) END ASC NULLS LAST,CASE WHEN p_sort='centre' AND p_reverse THEN lower(centre_label) END DESC NULLS LAST,
  CASE WHEN p_sort='shift' AND NOT p_reverse THEN shift_code END ASC NULLS LAST,CASE WHEN p_sort='shift' AND p_reverse THEN shift_code END DESC NULLS LAST,
  CASE WHEN p_sort='date' AND NOT p_reverse THEN attendance_date END ASC NULLS LAST,CASE WHEN p_sort='date' AND p_reverse THEN attendance_date END DESC NULLS LAST,
  CASE WHEN p_sort='present' AND NOT p_reverse THEN present END ASC NULLS LAST,CASE WHEN p_sort='present' AND p_reverse THEN present END DESC NULLS LAST,
  CASE WHEN p_sort='percentage' AND NOT p_reverse THEN percentage END ASC NULLS LAST,CASE WHEN p_sort='percentage' AND p_reverse THEN percentage END DESC NULLS LAST,
  CASE WHEN p_sort='last_edited_at' AND NOT p_reverse THEN last_edited_at END ASC NULLS LAST,CASE WHEN p_sort='last_edited_at' AND p_reverse THEN last_edited_at END DESC NULLS LAST,
  attendance_date DESC,centre_id,shift_code OFFSET p_offset LIMIT p_limit)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)-'centre_label') FROM page x),'[]'::jsonb)) INTO result;
 RETURN result;
END;$$;

CREATE FUNCTION mass_api.dashboard_table_page(
 p_source text,p_centres uuid[],p_context jsonb DEFAULT '{}'::jsonb,p_query text DEFAULT '',p_sort text DEFAULT 'centre',p_reverse boolean DEFAULT false,p_offset integer DEFAULT 0,p_limit integer DEFAULT 10
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog SET jit=off AS $$
DECLARE result jsonb;report jsonb;coverage jsonb;c uuid;from_date date;until_date date;cohort_filter uuid;officer uuid;shift_filter text;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_source IS NULL OR p_source NOT IN ('reviewed_centres','assessment_register','visit_centres','visit_officers','visit_log','morarji_cohorts','morarji_centres','morarji_followup','annual_centres')
  OR p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_context IS NULL OR jsonb_typeof(p_context)<>'object'
  OR p_query IS NULL OR length(p_query)>160 OR p_sort IS NULL OR length(p_sort)>40 OR p_reverse IS NULL
  OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded table page required';END IF;
 FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required';END IF;END LOOP;

 IF p_source='reviewed_centres' THEN
  IF p_sort NOT IN ('centre','students','attendance','present','score') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported centre sort';END IF;
  report:=mass_api.reviewed_chart_metrics(p_centres,(p_context->>'on')::date,(p_context->>'from')::date,(p_context->>'until')::date,(p_context->>'year')::uuid,
   nullif(p_context->>'grade',''),nullif(p_context->>'shift',''),nullif(p_context->>'gender',''),coalesce((p_context->>'earlier')::integer,1),coalesce((p_context->>'later')::integer,2));
  WITH raw AS MATERIALIZED(
   SELECT c.id centre_id,c.label centre_label,(x->>'children')::integer children,x->'attendance' attendance,x->'quarters' quarters,
    (x->'attendance'->>'p')::bigint present,(x->'attendance'->>'percentage')::numeric percentage,
    (SELECT (q->>'n')::bigint FROM jsonb_array_elements(x->'quarters')q WHERE (q->>'quarter')::integer=coalesce((p_context->>'quarter')::integer,2))score_n,
    (SELECT (q->>'mean')::numeric FROM jsonb_array_elements(x->'quarters')q WHERE (q->>'quarter')::integer=coalesce((p_context->>'quarter')::integer,2))score_mean
   FROM jsonb_array_elements(report->'centres')x JOIN mass_core.centres c ON c.id=(x->>'id')::uuid),
  filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR centre_label ILIKE '%'||p_query||'%'),
  page AS(SELECT * FROM filtered ORDER BY
   CASE WHEN p_sort='centre' AND NOT p_reverse THEN lower(centre_label) END ASC NULLS LAST,CASE WHEN p_sort='centre' AND p_reverse THEN lower(centre_label) END DESC NULLS LAST,
   CASE WHEN p_sort='students' AND NOT p_reverse THEN children END ASC NULLS LAST,CASE WHEN p_sort='students' AND p_reverse THEN children END DESC NULLS LAST,
   CASE WHEN p_sort='attendance' AND NOT p_reverse THEN percentage END ASC NULLS LAST,CASE WHEN p_sort='attendance' AND p_reverse THEN percentage END DESC NULLS LAST,
   CASE WHEN p_sort='present' AND NOT p_reverse THEN present END ASC NULLS LAST,CASE WHEN p_sort='present' AND p_reverse THEN present END DESC NULLS LAST,
   CASE WHEN p_sort='score' AND NOT p_reverse THEN score_mean END ASC NULLS LAST,CASE WHEN p_sort='score' AND p_reverse THEN score_mean END DESC NULLS LAST,
   lower(centre_label),centre_id OFFSET p_offset LIMIT p_limit)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM page x),'[]'::jsonb)) INTO result;

 ELSIF p_source='assessment_register' THEN
  IF p_sort NOT IN ('centre','shift','date','round','students','average','created','edited','at') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported assessment sort';END IF;
  WITH raw AS MATERIALIZED(SELECT a.*,c.label centre_label FROM mass_api.assessment_register_summary(p_centres,(p_context->>'year')::uuid,nullif(p_context->>'shift',''),nullif(p_context->>'grade',''),nullif(p_context->>'gender',''))a JOIN mass_core.centres c ON c.id=a.centre_id),
  filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR centre_label ILIKE '%'||p_query||'%' OR shift_code ILIKE '%'||p_query||'%' OR coalesce(assessment_date::text,'Unknown') ILIKE '%'||p_query||'%' OR ('F'||quarter) ILIKE '%'||p_query||'%'),
  page AS(SELECT * FROM filtered ORDER BY
   CASE WHEN p_sort='centre' AND NOT p_reverse THEN lower(centre_label) END ASC NULLS LAST,CASE WHEN p_sort='centre' AND p_reverse THEN lower(centre_label) END DESC NULLS LAST,
   CASE WHEN p_sort='shift' AND NOT p_reverse THEN shift_code END ASC NULLS LAST,CASE WHEN p_sort='shift' AND p_reverse THEN shift_code END DESC NULLS LAST,
   CASE WHEN p_sort='date' AND NOT p_reverse THEN assessment_date END ASC NULLS LAST,CASE WHEN p_sort='date' AND p_reverse THEN assessment_date END DESC NULLS LAST,
   CASE WHEN p_sort='round' AND NOT p_reverse THEN quarter END ASC NULLS LAST,CASE WHEN p_sort='round' AND p_reverse THEN quarter END DESC NULLS LAST,
   CASE WHEN p_sort='students' AND NOT p_reverse THEN students END ASC NULLS LAST,CASE WHEN p_sort='students' AND p_reverse THEN students END DESC NULLS LAST,
   CASE WHEN p_sort='average' AND NOT p_reverse THEN average_score END ASC NULLS LAST,CASE WHEN p_sort='average' AND p_reverse THEN average_score END DESC NULLS LAST,
   CASE WHEN p_sort='created' AND NOT p_reverse THEN lower(created_by) END ASC NULLS LAST,CASE WHEN p_sort='created' AND p_reverse THEN lower(created_by) END DESC NULLS LAST,
   CASE WHEN p_sort='edited' AND NOT p_reverse THEN lower(last_edited_by) END ASC NULLS LAST,CASE WHEN p_sort='edited' AND p_reverse THEN lower(last_edited_by) END DESC NULLS LAST,
   CASE WHEN p_sort='at' AND NOT p_reverse THEN last_edited_at END ASC NULLS LAST,CASE WHEN p_sort='at' AND p_reverse THEN last_edited_at END DESC NULLS LAST,
   assessment_date DESC NULLS LAST,centre_id,shift_code,quarter OFFSET p_offset LIMIT p_limit)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)-'centre_label') FROM page x),'[]'::jsonb)) INTO result;

 ELSIF p_source IN ('visit_centres','visit_officers') THEN
  from_date:=(p_context->>'from')::date;until_date:=(p_context->>'until')::date;officer:=nullif(p_context->>'officer','')::uuid;shift_filter:=nullif(p_context->>'shift','');
  coverage:=mass_api.visit_coverage(p_centres,from_date,until_date,officer);
  IF p_source='visit_centres' THEN
   IF p_sort NOT IN ('centre','morning','evening','status') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported visit sort';END IF;
   WITH raw AS MATERIALIZED(SELECT c.id centre_id,c.label centre_label,(x->>'morning')::integer morning,(x->>'evening')::integer evening,(x->>'recorded_count')::integer recorded_count,(x->>'achieved')::boolean achieved FROM jsonb_array_elements(coverage->'summary')x JOIN mass_core.centres c ON c.id=(x->>'centre_id')::uuid),
   filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR centre_label ILIKE '%'||p_query||'%'),page AS(SELECT * FROM filtered ORDER BY
    CASE WHEN p_sort='centre' AND NOT p_reverse THEN lower(centre_label) END ASC NULLS LAST,CASE WHEN p_sort='centre' AND p_reverse THEN lower(centre_label) END DESC NULLS LAST,
    CASE WHEN p_sort='morning' AND NOT p_reverse THEN morning END ASC NULLS LAST,CASE WHEN p_sort='morning' AND p_reverse THEN morning END DESC NULLS LAST,
    CASE WHEN p_sort='evening' AND NOT p_reverse THEN evening END ASC NULLS LAST,CASE WHEN p_sort='evening' AND p_reverse THEN evening END DESC NULLS LAST,
    CASE WHEN p_sort='status' AND NOT p_reverse THEN achieved END ASC NULLS LAST,CASE WHEN p_sort='status' AND p_reverse THEN achieved END DESC NULLS LAST,lower(centre_label) OFFSET p_offset LIMIT p_limit)
   SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM page x),'[]'::jsonb)) INTO result;
  ELSE
   IF p_sort NOT IN ('label','completed','target') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported officer sort';END IF;
   WITH raw AS MATERIALIZED(SELECT (x->>'officer_id')::uuid officer_id,min(x->>'label')label,sum(CASE shift_filter WHEN 'Morning' THEN (x->>'morning')::integer WHEN 'Evening' THEN (x->>'evening')::integer ELSE (x->>'morning')::integer+(x->>'evening')::integer END)completed,count(*)*(CASE WHEN shift_filter IS NULL THEN 4 ELSE 2 END)target,sum((x->>'recorded_count')::integer)records FROM jsonb_array_elements(coverage->'officers')x GROUP BY (x->>'officer_id')::uuid),
   filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR label ILIKE '%'||p_query||'%'),page AS(SELECT * FROM filtered ORDER BY
    CASE WHEN p_sort='label' AND NOT p_reverse THEN lower(label) END ASC NULLS LAST,CASE WHEN p_sort='label' AND p_reverse THEN lower(label) END DESC NULLS LAST,
    CASE WHEN p_sort='completed' AND NOT p_reverse THEN completed END ASC NULLS LAST,CASE WHEN p_sort='completed' AND p_reverse THEN completed END DESC NULLS LAST,
    CASE WHEN p_sort='target' AND NOT p_reverse THEN target END ASC NULLS LAST,CASE WHEN p_sort='target' AND p_reverse THEN target END DESC NULLS LAST,lower(label),officer_id OFFSET p_offset LIMIT p_limit)
   SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',officer_id,'label',label,'completed',completed,'target',target,'records',records)) FROM page),'[]'::jsonb)) INTO result;
  END IF;

 ELSIF p_source='visit_log' THEN
  IF p_sort NOT IN ('date','centre','shift','status','feedback','next') OR EXISTS(SELECT 1 FROM unnest(p_centres)x WHERE NOT mass_core.can_record_visit(x)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer detail scope required';END IF;
  from_date:=(p_context->>'from')::date;until_date:=(p_context->>'until')::date;
  WITH raw AS MATERIALIZED(SELECT v.*,c.label centre_label FROM mass_core.cluster_officer_visits v JOIN mass_core.centres c ON c.id=v.centre_id WHERE v.centre_id=ANY(p_centres) AND v.created_by=mass_core.request_user_id() AND v.visit_date>=from_date AND v.visit_date<until_date),
  filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR centre_label ILIKE '%'||p_query||'%' OR status ILIKE '%'||p_query||'%' OR feedback ILIKE '%'||p_query||'%' OR next_action ILIKE '%'||p_query||'%'),page AS(SELECT * FROM filtered ORDER BY
   CASE WHEN p_sort='date' AND NOT p_reverse THEN visit_date END ASC NULLS LAST,CASE WHEN p_sort='date' AND p_reverse THEN visit_date END DESC NULLS LAST,
   CASE WHEN p_sort='centre' AND NOT p_reverse THEN lower(centre_label) END ASC NULLS LAST,CASE WHEN p_sort='centre' AND p_reverse THEN lower(centre_label) END DESC NULLS LAST,
   CASE WHEN p_sort='shift' AND NOT p_reverse THEN shift_code END ASC NULLS LAST,CASE WHEN p_sort='shift' AND p_reverse THEN shift_code END DESC NULLS LAST,
   CASE WHEN p_sort='status' AND NOT p_reverse THEN status END ASC NULLS LAST,CASE WHEN p_sort='status' AND p_reverse THEN status END DESC NULLS LAST,
   CASE WHEN p_sort='feedback' AND NOT p_reverse THEN lower(feedback) END ASC NULLS LAST,CASE WHEN p_sort='feedback' AND p_reverse THEN lower(feedback) END DESC NULLS LAST,
   CASE WHEN p_sort='next' AND NOT p_reverse THEN lower(next_action) END ASC NULLS LAST,CASE WHEN p_sort='next' AND p_reverse THEN lower(next_action) END DESC NULLS LAST,visit_date DESC,id OFFSET p_offset LIMIT p_limit)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)-'centre_label') FROM page x),'[]'::jsonb)) INTO result;

 ELSIF p_source IN ('morarji_cohorts','morarji_centres','morarji_followup') THEN
  cohort_filter:=nullif(p_context->>'cohort','')::uuid;
  IF p_source='morarji_cohorts' THEN
   IF p_sort NOT IN ('cohort','members','applied','attended','passed') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported cohort sort';END IF;
   WITH raw AS MATERIALIZED(SELECT pc.id cohort_id,pc.label cohort,pc.academic_year_id,count(DISTINCT m.child_id)members,CASE WHEN count(o.applied)>0 THEN count(DISTINCT m.child_id)FILTER(WHERE o.applied)END applied,CASE WHEN count(o.attended)>0 THEN count(DISTINCT m.child_id)FILTER(WHERE o.attended)END attended,CASE WHEN count(o.passed)>0 THEN count(DISTINCT m.child_id)FILTER(WHERE o.passed)END passed,count(DISTINCT m.child_id)FILTER(WHERE o.passed IS NOT NULL)known_passed FROM mass_core.cohort_memberships m JOIN mass_core.enrolments e ON e.id=m.enrolment_id JOIN mass_core.programme_cohorts pc ON pc.id=m.cohort_id LEFT JOIN mass_core.morarji_outcomes o ON o.membership_id=m.id WHERE m.centre_id=ANY(p_centres) AND e.grade_label='5' GROUP BY pc.id,pc.label,pc.academic_year_id),filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR cohort ILIKE '%'||p_query||'%'),page AS(SELECT * FROM filtered ORDER BY
    CASE WHEN p_sort='cohort' AND NOT p_reverse THEN lower(cohort) END ASC NULLS LAST,CASE WHEN p_sort='cohort' AND p_reverse THEN lower(cohort) END DESC NULLS LAST,
    CASE WHEN p_sort='members' AND NOT p_reverse THEN members END ASC NULLS LAST,CASE WHEN p_sort='members' AND p_reverse THEN members END DESC NULLS LAST,
    CASE WHEN p_sort='applied' AND NOT p_reverse THEN applied END ASC NULLS LAST,CASE WHEN p_sort='applied' AND p_reverse THEN applied END DESC NULLS LAST,
    CASE WHEN p_sort='attended' AND NOT p_reverse THEN attended END ASC NULLS LAST,CASE WHEN p_sort='attended' AND p_reverse THEN attended END DESC NULLS LAST,
    CASE WHEN p_sort='passed' AND NOT p_reverse THEN passed END ASC NULLS LAST,CASE WHEN p_sort='passed' AND p_reverse THEN passed END DESC NULLS LAST,lower(cohort),cohort_id OFFSET p_offset LIMIT p_limit)
   SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('cohortId',cohort_id,'cohort',cohort,'academicYear',academic_year_id,'members',members,'applied',applied,'attended',attended,'passed',passed,'knownPassed',known_passed)) FROM page),'[]'::jsonb)) INTO result;
  ELSIF p_source='morarji_centres' THEN
   IF cohort_filter IS NULL OR p_sort NOT IN ('name','members','applied','attended','passed') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='cohort and supported centre sort required';END IF;
   WITH raw AS MATERIALIZED(SELECT c.id,c.label name,count(*)members,count(*)FILTER(WHERE o.applied)applied,count(*)FILTER(WHERE o.attended)attended,count(*)FILTER(WHERE o.passed)passed FROM mass_core.cohort_memberships m JOIN mass_core.centres c ON c.id=m.centre_id LEFT JOIN mass_core.morarji_outcomes o ON o.membership_id=m.id WHERE m.centre_id=ANY(p_centres) AND m.cohort_id=cohort_filter GROUP BY c.id,c.label),filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR name ILIKE '%'||p_query||'%'),page AS(SELECT * FROM filtered ORDER BY
    CASE WHEN p_sort='name' AND NOT p_reverse THEN lower(name) END ASC NULLS LAST,CASE WHEN p_sort='name' AND p_reverse THEN lower(name) END DESC NULLS LAST,
    CASE WHEN p_sort='members' AND NOT p_reverse THEN members END ASC NULLS LAST,CASE WHEN p_sort='members' AND p_reverse THEN members END DESC NULLS LAST,
    CASE WHEN p_sort='applied' AND NOT p_reverse THEN applied END ASC NULLS LAST,CASE WHEN p_sort='applied' AND p_reverse THEN applied END DESC NULLS LAST,
    CASE WHEN p_sort='attended' AND NOT p_reverse THEN attended END ASC NULLS LAST,CASE WHEN p_sort='attended' AND p_reverse THEN attended END DESC NULLS LAST,
    CASE WHEN p_sort='passed' AND NOT p_reverse THEN passed END ASC NULLS LAST,CASE WHEN p_sort='passed' AND p_reverse THEN passed END DESC NULLS LAST,lower(name),id OFFSET p_offset LIMIT p_limit)
   SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM page x),'[]'::jsonb)) INTO result;
  ELSE
   IF cohort_filter IS NULL OR p_sort NOT IN ('student','centre','applied','attended','result','school') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='cohort and supported follow-up sort required';END IF;
   WITH raw AS MATERIALIZED(SELECT m.id,m.cohort_id cohort,c.student_id student_id,p.full_name name,m.centre_id centre,ct.label centre_label,o.applied,o.attended,CASE WHEN o.passed THEN 'Passed' WHEN o.passed=false THEN 'Not passed' ELSE 'Pending' END result,o.school_name school FROM mass_core.cohort_memberships m JOIN mass_core.children c ON c.id=m.child_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=m.child_id JOIN mass_core.centres ct ON ct.id=m.centre_id LEFT JOIN mass_core.morarji_outcomes o ON o.membership_id=m.id WHERE m.centre_id=ANY(p_centres) AND m.cohort_id=cohort_filter),filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR coalesce(name,'Name not recorded') ILIKE '%'||p_query||'%' OR student_id ILIKE '%'||p_query||'%' OR centre_label ILIKE '%'||p_query||'%' OR coalesce(school,'') ILIKE '%'||p_query||'%'),page AS(SELECT * FROM filtered ORDER BY
    CASE WHEN p_sort='student' AND NOT p_reverse THEN lower(coalesce(name,'Name not recorded')) END ASC NULLS LAST,CASE WHEN p_sort='student' AND p_reverse THEN lower(coalesce(name,'Name not recorded')) END DESC NULLS LAST,
    CASE WHEN p_sort='centre' AND NOT p_reverse THEN lower(centre_label) END ASC NULLS LAST,CASE WHEN p_sort='centre' AND p_reverse THEN lower(centre_label) END DESC NULLS LAST,
    CASE WHEN p_sort='applied' AND NOT p_reverse THEN applied END ASC NULLS LAST,CASE WHEN p_sort='applied' AND p_reverse THEN applied END DESC NULLS LAST,
    CASE WHEN p_sort='attended' AND NOT p_reverse THEN attended END ASC NULLS LAST,CASE WHEN p_sort='attended' AND p_reverse THEN attended END DESC NULLS LAST,
    CASE WHEN p_sort='result' AND NOT p_reverse THEN result END ASC NULLS LAST,CASE WHEN p_sort='result' AND p_reverse THEN result END DESC NULLS LAST,
    CASE WHEN p_sort='school' AND NOT p_reverse THEN lower(school) END ASC NULLS LAST,CASE WHEN p_sort='school' AND p_reverse THEN lower(school) END DESC NULLS LAST,lower(coalesce(name,'Name not recorded')),student_id,id OFFSET p_offset LIMIT p_limit)
   SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'cohort',cohort,'name',name,'studentId',student_id,'centre',centre,'applied',applied,'attended',attended,'result',result,'school',school)) FROM page),'[]'::jsonb)) INTO result;
  END IF;

 ELSE -- annual_centres
  IF p_sort NOT IN ('name','donor','students','p','a','l','percentage','loaded') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported annual sort';END IF;
  report:=mass_api.reviewed_attendance_by_centre_month(p_centres,(p_context->>'year')::uuid,(p_context->>'today')::date,NULL,NULL,NULL);
  WITH monthly AS MATERIALIZED(SELECT (x->>'month') AS month_key,(x->>'centre_id')::uuid centre_id,(x->>'children')::integer children,(x->>'p')::bigint p,(x->>'a')::bigint a,(x->>'l')::bigint l FROM jsonb_array_elements(report)x),raw AS MATERIALIZED(SELECT c.id,c.label name,coalesce(d.label,'Not associated')donor,(array_agg(m.children ORDER BY m.month_key DESC))[1]students,sum(m.p)p,sum(m.a)a,sum(m.l)l,100.0*sum(m.p)/nullif(sum(m.p)+sum(m.a)+sum(m.l),0)percentage,count(DISTINCT m.month_key)loaded FROM mass_core.centres c LEFT JOIN mass_core.donors d ON d.id=c.donor_id JOIN monthly m ON m.centre_id=c.id GROUP BY c.id,c.label,d.label),filtered AS MATERIALIZED(SELECT * FROM raw WHERE p_query='' OR name ILIKE '%'||p_query||'%' OR donor ILIKE '%'||p_query||'%'),page AS(SELECT * FROM filtered ORDER BY
   CASE WHEN p_sort='name' AND NOT p_reverse THEN lower(name) END ASC NULLS LAST,CASE WHEN p_sort='name' AND p_reverse THEN lower(name) END DESC NULLS LAST,
   CASE WHEN p_sort='donor' AND NOT p_reverse THEN lower(donor) END ASC NULLS LAST,CASE WHEN p_sort='donor' AND p_reverse THEN lower(donor) END DESC NULLS LAST,
   CASE WHEN p_sort='students' AND NOT p_reverse THEN students END ASC NULLS LAST,CASE WHEN p_sort='students' AND p_reverse THEN students END DESC NULLS LAST,
   CASE WHEN p_sort='p' AND NOT p_reverse THEN p END ASC NULLS LAST,CASE WHEN p_sort='p' AND p_reverse THEN p END DESC NULLS LAST,
   CASE WHEN p_sort='a' AND NOT p_reverse THEN a END ASC NULLS LAST,CASE WHEN p_sort='a' AND p_reverse THEN a END DESC NULLS LAST,
   CASE WHEN p_sort='l' AND NOT p_reverse THEN l END ASC NULLS LAST,CASE WHEN p_sort='l' AND p_reverse THEN l END DESC NULLS LAST,
   CASE WHEN p_sort='percentage' AND NOT p_reverse THEN percentage END ASC NULLS LAST,CASE WHEN p_sort='percentage' AND p_reverse THEN percentage END DESC NULLS LAST,
   CASE WHEN p_sort='loaded' AND NOT p_reverse THEN loaded END ASC NULLS LAST,CASE WHEN p_sort='loaded' AND p_reverse THEN loaded END DESC NULLS LAST,lower(name),id OFFSET p_offset LIMIT p_limit)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM page x),'[]'::jsonb)) INTO result;
 END IF;
 RETURN result;
END;$$;

REVOKE ALL ON FUNCTION mass_api.attendance_register_page_v2(uuid[],date,date,text,text,text,integer,integer,text,boolean,text),mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.attendance_register_page_v2(uuid[],date,date,text,text,text,integer,integer,text,boolean,text),mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
