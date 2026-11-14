-- reviewed_chart_metrics: reviewed source in the migration history, with the Production-installed H (Holiday) exclusion, and faster.
-- Until now this function existed only as supabase/proposals/202611030024_reviewed_chart_metrics.sql, installed by a sealed payload.
-- It is replaced here ONLY where it is already installed (Production, Preview); a fresh database installs the reviewed proposal and then
-- re-applies this file (tests/release/portable-sql.mjs does so). Results are unchanged for the same data:
--   * the 20261110120000 holiday patch is part of this body (code IN ('WO','MM','H')) so replacing it cannot drop that patch;
--   * the quarter-pair join no longer compares every score row with every other (one quadratic self-join, about 0.7 s on 92 centres);
--   * per-centre attendance and quarter statistics are grouped once instead of scanning the month's marks once per centre;
--   * the attendance-band join is restricted to the reporting month.
-- Measured on Preview (92 centres, one month): about 1.06 s to about 0.17 s; 540 month, filter and centre-subset results compared equal.
-- No index is added: the measurements did not show a benefit. The activation guard is re-applied by supabase/activation/seal.sql, so run
-- seal.sql in the same transaction (the installation procedure always does).
-- Rollback: re-create the previous body from supabase/proposals/202611030024_reviewed_chart_metrics.sql with the H patch, then re-run seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $upgrade$
BEGIN
 IF to_regprocedure('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)') IS NULL THEN
  RAISE NOTICE 'reviewed_chart_metrics is not installed; nothing to upgrade';
  RETURN;
 END IF;
 EXECUTE $def$
CREATE OR REPLACE FUNCTION mass_api.reviewed_chart_metrics(p_centres uuid[],p_on date,p_from date,p_until date,p_year uuid,p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL,p_earlier integer DEFAULT 1,p_later integer DEFAULT 2)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog SET jit=off AS $$
DECLARE result jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='bounded readable centre scope required';END IF;
 IF p_on IS NULL OR p_from IS NULL OR p_until IS NULL OR p_on<p_from OR p_on>=p_until OR extract(day FROM p_from)<>1 OR p_until<>(p_from+interval '1 month')::date OR NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.id=p_year AND p_from>=y.starts_on AND p_until<=y.ends_before) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='configured academic year and calendar month required';END IF;
 IF (p_grade IS NOT NULL AND p_grade NOT IN ('1','2','3','4','5','6','7','8','9','10')) OR (p_shift IS NOT NULL AND p_shift NOT IN ('Morning','Evening')) OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy','Unknown')) OR p_earlier IS NULL OR p_later IS NULL OR p_earlier NOT BETWEEN 1 AND 4 OR p_later NOT BETWEEN 1 AND 4 OR p_earlier=p_later THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid reviewed filter or exam pair';END IF;
 -- BEGIN INDEPENDENT READ-ONLY CALCULATION BODY
 WITH scope AS MATERIALIZED(SELECT DISTINCT unnest(p_centres) id),
 base AS MATERIALIZED(
 SELECT e.*,p.gender_code FROM mass_core.enrolments e JOIN scope c ON c.id=e.centre_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.starts_on<=p_on AND (e.ends_before IS NULL OR p_on<e.ends_before)
 AND (p_shift IS NULL OR e.shift_code=p_shift) AND (p_gender IS NULL OR p.gender_code=p_gender OR p_gender='Unknown' AND p.gender_code IS NULL)
 ),pop AS MATERIALIZED(SELECT * FROM base WHERE p_grade IS NULL OR grade_label=p_grade),
 children AS MATERIALIZED(SELECT DISTINCT child_id FROM pop),
 grade_children AS(SELECT b.child_id,min(b.grade_label) grade,count(DISTINCT b.grade_label) n FROM base b JOIN children c USING(child_id) GROUP BY b.child_id),
 raw_marks AS MATERIALIZED(SELECT a.*,EXISTS(SELECT 1 FROM mass_core.cac_sessions c WHERE c.centre_id=a.centre_id AND c.shift_code=a.shift_code AND c.session_date=a.attendance_date AND NOT c.is_scheduled) holiday FROM mass_core.attendance_records a JOIN pop p ON p.id=a.enrolment_id WHERE a.attendance_date>=p_from AND a.attendance_date<p_until),
 eligible_marks AS(SELECT * FROM raw_marks WHERE NOT holiday),
 events AS MATERIALIZED(SELECT e.* FROM mass_core.activity_events e JOIN scope c ON c.id=e.centre_id WHERE e.activity_date>=p_from AND e.activity_date<p_until AND e.delivery_status='Held' AND (p_shift IS NULL OR e.shift_code=p_shift)),
 observations AS MATERIALIZED(SELECT a.*,coalesce(e.category,'Uncategorised') category FROM mass_core.activity_participation a JOIN events e ON e.id=a.event_id JOIN pop p ON p.id=a.enrolment_id WHERE a.participated IS NOT NULL AND p.centre_id=e.centre_id AND p.shift_code=e.shift_code AND e.activity_date>=p.starts_on AND (p.ends_before IS NULL OR e.activity_date<p.ends_before)),
 configured AS MATERIALIZED(SELECT d.id,q.quarter,count(*) OVER(PARTITION BY q.quarter) definitions FROM mass_core.assessment_definitions d JOIN mass_core.assessment_periods q ON q.id=d.period_id WHERE q.academic_year_id=p_year AND d.max_score=25),
 historical_scores AS MATERIALIZED(
 SELECT a.id,a.enrolment_id,a.child_id,a.centre_id,a.score,d.quarter,d.definitions FROM mass_core.assessment_results a JOIN mass_core.enrolments e ON e.id=a.enrolment_id JOIN children c ON c.child_id=a.child_id JOIN scope s ON s.id=a.centre_id JOIN configured d ON d.id=a.definition_id
 WHERE (p_grade IS NULL OR e.grade_label=p_grade) AND (p_shift IS NULL OR e.shift_code=p_shift)
 ),active_scores AS MATERIALIZED(SELECT a.* FROM historical_scores a JOIN pop p ON p.id=a.enrolment_id WHERE a.definitions=1),
 valid_pairs AS(
 SELECT g.child_id,ea.score earlier,lb.score later,lb.score-ea.score delta
 FROM (SELECT child_id,array_agg(score) FILTER(WHERE quarter=p_earlier) es,array_agg(score) FILTER(WHERE quarter=p_later) ls FROM historical_scores WHERE definitions=1 GROUP BY child_id) g
 CROSS JOIN LATERAL unnest(g.es) ea(score) CROSS JOIN LATERAL unnest(g.ls) lb(score)
 ),quarter_stats AS(
 SELECT d.quarter,count(s.score) n,avg(s.score) mean,
 count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score<=8) low,count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score BETWEEN 9 AND 15) developing,count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score BETWEEN 16 AND 20) good,count(*) FILTER(WHERE s.score=trunc(s.score) AND s.score BETWEEN 21 AND 25) strong,count(*) FILTER(WHERE s.score<>trunc(s.score)) precision_review,count(*) FILTER(WHERE s.score>20) above20
 FROM (SELECT DISTINCT quarter FROM configured WHERE definitions=1)d LEFT JOIN active_scores s ON s.quarter=d.quarter GROUP BY d.quarter
 ),delivery AS MATERIALIZED(SELECT d.* FROM mass_core.cac_delivery_records d JOIN scope c ON c.id=d.centre_id WHERE d.session_date>=p_from AND d.session_date<p_until AND (p_shift IS NULL OR d.shift_code=p_shift)),
 centre_quarters AS MATERIALIZED(SELECT x.centre_id,jsonb_agg(jsonb_build_object('quarter',x.quarter,'n',x.n,'mean',x.mean) ORDER BY x.quarter) quarters FROM (SELECT c.id centre_id,d.quarter,count(s.score) n,avg(s.score) mean FROM scope c CROSS JOIN (SELECT DISTINCT quarter FROM configured WHERE definitions=1)d LEFT JOIN active_scores s ON s.quarter=d.quarter AND s.centre_id=c.id GROUP BY c.id,d.quarter)x GROUP BY x.centre_id),
 centre_marks AS MATERIALIZED(SELECT m.centre_id,jsonb_build_object('p',count(*) FILTER(WHERE code='P' AND NOT holiday),'a',count(*) FILTER(WHERE code='A' AND NOT holiday),'l',count(*) FILTER(WHERE code='L' AND NOT holiday),'excluded',count(*) FILTER(WHERE holiday OR code IN ('WO','MM','H')),'percentage',100.0*count(*) FILTER(WHERE code='P' AND NOT holiday)/nullif(count(*) FILTER(WHERE code IN ('P','A','L') AND NOT holiday),0)) attendance FROM raw_marks m GROUP BY m.centre_id),
 per_centre AS(
 SELECT c.id,
 (SELECT count(*) FROM pop p WHERE p.centre_id=c.id) enrolments,
 (SELECT count(DISTINCT child_id) FROM pop p WHERE p.centre_id=c.id) children,
 coalesce((SELECT cm.attendance FROM centre_marks cm WHERE cm.centre_id=c.id),jsonb_build_object('p',0,'a',0,'l',0,'excluded',0,'percentage',NULL::numeric)) attendance,
 jsonb_build_object('eligible',(SELECT count(DISTINCT child_id) FROM pop p WHERE p.centre_id=c.id),'available',EXISTS(SELECT 1 FROM observations o WHERE o.centre_id=c.id),'participants',CASE WHEN EXISTS(SELECT 1 FROM observations o WHERE o.centre_id=c.id) THEN (SELECT count(DISTINCT child_id) FROM observations o WHERE o.centre_id=c.id AND participated) END,'rate',CASE WHEN EXISTS(SELECT 1 FROM observations o WHERE o.centre_id=c.id) THEN (SELECT 100.0*count(DISTINCT child_id) FROM observations o WHERE o.centre_id=c.id AND participated)/nullif((SELECT count(DISTINCT child_id) FROM pop p WHERE p.centre_id=c.id),0) END) activity,
 coalesce((SELECT cq.quarters FROM centre_quarters cq WHERE cq.centre_id=c.id),'[]'::jsonb) quarters
 FROM scope c
 ),daily_coverage AS(
 SELECT p.id,count(*) FILTER(WHERE c.is_scheduled AND a.code IN ('P','A','L')) scheduled,
 count(*) FILTER(WHERE c.is_scheduled AND a.code='P') present,
 bool_and(coalesce(c.is_scheduled=false OR a.code IN ('WO','MM','H') OR c.is_scheduled AND a.code IN ('P','A','L'),false)) IS TRUE complete
 FROM pop p CROSS JOIN LATERAL generate_series(greatest(p.starts_on,p_from),least(coalesce(p.ends_before-1,p_until-1),p_until-1,p_on),interval '1 day') d
 LEFT JOIN mass_core.cac_sessions c ON c.centre_id=p.centre_id AND c.shift_code=p.shift_code AND c.session_date=d::date
 LEFT JOIN mass_core.attendance_records a ON a.enrolment_id=p.id AND a.attendance_date=d::date AND a.attendance_date>=p_from AND a.attendance_date<p_until GROUP BY p.id
 ),cohort_records AS(
 SELECT c.id cohort_id,c.academic_year_id,c.label cohort,m.child_id,o.applied,o.attended,o.passed FROM mass_core.cohort_memberships m JOIN mass_core.enrolments e ON e.id=m.enrolment_id JOIN mass_core.programme_cohorts c ON c.id=m.cohort_id LEFT JOIN mass_core.morarji_outcomes o ON o.membership_id=m.id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=m.child_id
 WHERE e.centre_id=ANY(p_centres) AND e.grade_label='5' AND (p_grade IS NULL OR e.grade_label=p_grade) AND (p_shift IS NULL OR e.shift_code=p_shift) AND (p_gender IS NULL OR p.gender_code=p_gender OR p_gender='Unknown' AND p.gender_code IS NULL)
 )
 SELECT jsonb_build_object(
 'enrolments',(SELECT count(*) FROM pop),'children',(SELECT count(*) FROM children),
 'grades',coalesce((SELECT jsonb_object_agg(grade,n) FROM (SELECT grade,count(*) n FROM grade_children WHERE n=1 AND (p_grade IS NULL OR grade=p_grade) GROUP BY grade)x),'{}'::jsonb),
 'ambiguousGrades',(SELECT count(*) FROM grade_children WHERE n>1),
 'genders',coalesce((SELECT jsonb_object_agg(gender,n) FROM (SELECT coalesce(gender_code,'Unknown') gender,count(DISTINCT child_id) n FROM pop GROUP BY gender_code)x),'{}'::jsonb),
 'attendance',(SELECT jsonb_build_object('p',count(*) FILTER(WHERE code='P' AND NOT holiday),'a',count(*) FILTER(WHERE code='A' AND NOT holiday),'l',count(*) FILTER(WHERE code='L' AND NOT holiday),'excluded',count(*) FILTER(WHERE holiday OR code IN ('WO','MM','H')),'percentage',100.0*count(*) FILTER(WHERE code='P' AND NOT holiday)/nullif(count(*) FILTER(WHERE code IN ('P','A','L') AND NOT holiday),0)) FROM raw_marks),
 'activity',jsonb_build_object('eligible',(SELECT count(*) FROM children),'available',EXISTS(SELECT 1 FROM observations),'participants',CASE WHEN EXISTS(SELECT 1 FROM observations) THEN (SELECT count(DISTINCT child_id) FROM observations WHERE participated) END,'rate',CASE WHEN EXISTS(SELECT 1 FROM observations) THEN (SELECT 100.0*count(DISTINCT child_id) FROM observations WHERE participated)/nullif((SELECT count(*) FROM children),0) END,'respondents',(SELECT count(DISTINCT child_id) FROM observations),'withoutResponse',(SELECT count(*) FROM children)-(SELECT count(DISTINCT child_id) FROM observations),'categories',coalesce((SELECT jsonb_object_agg(category,n) FROM (SELECT category,count(DISTINCT child_id) n FROM observations WHERE participated GROUP BY category)x),'{}'::jsonb),'heldEvents',(SELECT count(*) FROM events)),
 'quarters',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY quarter),'[]'::jsonb) FROM quarter_stats q),
 'changes',(SELECT jsonb_build_object('n',count(*),'meanChange',avg(delta),'earlierMean',avg(earlier),'laterMean',avg(later),'improved',count(*) FILTER(WHERE delta>0),'unchanged',count(*) FILTER(WHERE delta=0),'declined',count(*) FILTER(WHERE delta<0),'ambiguous',0) FROM valid_pairs),
 'centres',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY id),'[]'::jsonb) FROM per_centre c),
 'delivery',(SELECT jsonb_build_object('available',count(*)>0,'held',count(*) FILTER(WHERE status='Held'),'planned',count(*) FILTER(WHERE status='Planned'),'cancelled',count(*) FILTER(WHERE status='Cancelled')) FROM delivery),
 'bands',(SELECT jsonb_build_object('available',count(*) FILTER(WHERE complete AND scheduled>0)>0,'classified',count(*) FILTER(WHERE complete AND scheduled>0),'unclassified',(SELECT count(*) FROM pop)-count(*) FILTER(WHERE complete AND scheduled>0),'counts',jsonb_build_object('below15',count(*) FILTER(WHERE complete AND scheduled>0 AND present<15),'exactly15',count(*) FILTER(WHERE complete AND scheduled>0 AND present=15),'days16to20',count(*) FILTER(WHERE complete AND scheduled>0 AND present BETWEEN 16 AND 20),'days21to25',count(*) FILTER(WHERE complete AND scheduled>0 AND present BETWEEN 21 AND 25),'above25',count(*) FILTER(WHERE complete AND scheduled>0 AND present>25))) FROM daily_coverage),
 'morarji',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY cohort),'[]'::jsonb) FROM (SELECT cohort_id "cohortId",academic_year_id "academicYear",cohort,count(DISTINCT child_id) members,CASE WHEN count(passed)>0 THEN count(DISTINCT child_id) FILTER(WHERE passed) END passed,count(DISTINCT child_id) FILTER(WHERE passed IS NOT NULL) "knownPassed",CASE WHEN count(applied)>0 THEN count(DISTINCT child_id) FILTER(WHERE applied) END applied,CASE WHEN count(attended)>0 THEN count(DISTINCT child_id) FILTER(WHERE attended) END attended FROM cohort_records GROUP BY cohort_id,academic_year_id,cohort)c),
 'morarjiYears',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY "academicYear"),'[]'::jsonb) FROM (SELECT academic_year_id "academicYear",count(DISTINCT child_id) members,CASE WHEN count(passed)>0 THEN count(DISTINCT child_id) FILTER(WHERE passed) END passed,count(DISTINCT child_id) FILTER(WHERE passed IS NOT NULL) "knownPassed" FROM cohort_records WHERE academic_year_id IS NOT NULL GROUP BY academic_year_id)c),
 'coverage','Recorded observations only; missing is unknown. Calendar/category/source completeness is not inferred.'
 ) INTO result;
 -- END INDEPENDENT READ-ONLY CALCULATION BODY
 RETURN result;
END;
$$;
 $def$;
END;
$upgrade$;
COMMIT;
