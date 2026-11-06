-- Read-only reference for the deployed 001–019 schema. No role/DDL/claims changes.
-- Caller substitutes a validated private JSON case array. No names are queried.
WITH requested AS (SELECT * FROM jsonb_to_recordset(__CASES__::jsonb) AS x(case_id int,centres uuid[],on_date date,from_date date,until_date date,year_id uuid,grade text,shift text,gender text,earlier int,later int))
SELECT r.case_id, calculated.result FROM requested r CROSS JOIN LATERAL (
 WITH base AS MATERIALIZED (
 SELECT e.*,p.gender_code FROM mass_core.enrolments e LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.centre_id=ANY(r.centres) AND e.starts_on<=r.on_date AND (e.ends_before IS NULL OR r.on_date<e.ends_before)
 AND (r.shift IS NULL OR e.shift_code=r.shift) AND (r.gender IS NULL OR p.gender_code=r.gender OR r.gender='Unknown' AND p.gender_code IS NULL)
 ), pop AS MATERIALIZED(SELECT * FROM base WHERE r.grade IS NULL OR grade_label=r.grade),
 children AS MATERIALIZED(SELECT DISTINCT child_id FROM pop),
 grades AS(SELECT b.child_id,min(grade_label) grade,count(DISTINCT grade_label) n FROM base b JOIN children c USING(child_id) GROUP BY b.child_id),
 marks AS MATERIALIZED(SELECT a.code,EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled) holiday FROM mass_core.attendance_records a JOIN pop p ON p.id=a.enrolment_id WHERE a.attendance_date>=r.from_date AND a.attendance_date<r.until_date),
 defs AS MATERIALIZED(SELECT d.id,q.quarter FROM mass_core.assessment_definitions d JOIN mass_core.assessment_periods q ON q.id=d.period_id WHERE q.academic_year_id=r.year_id AND d.max_score=25),
 scores AS MATERIALIZED(SELECT a.child_id,a.enrolment_id,a.score,d.quarter FROM mass_core.assessment_results a JOIN mass_core.enrolments e ON e.id=a.enrolment_id JOIN children c ON c.child_id=a.child_id JOIN defs d ON d.id=a.definition_id WHERE e.centre_id=ANY(r.centres) AND (r.grade IS NULL OR e.grade_label=r.grade) AND (r.shift IS NULL OR e.shift_code=r.shift)),
 pairs AS(SELECT b.score-a.score delta FROM scores a JOIN scores b ON b.child_id=a.child_id AND a.quarter=r.earlier AND b.quarter=r.later),
 quarters AS(SELECT d.quarter,count(a.score) n,avg(a.score) mean,count(*) FILTER(WHERE a.score=trunc(a.score) AND a.score<=8) low,count(*) FILTER(WHERE a.score=trunc(a.score) AND a.score BETWEEN 9 AND 15) developing,count(*) FILTER(WHERE a.score=trunc(a.score) AND a.score BETWEEN 16 AND 20) good,count(*) FILTER(WHERE a.score=trunc(a.score) AND a.score BETWEEN 21 AND 25) strong,count(*) FILTER(WHERE a.score<>trunc(a.score)) precision_review,count(*) FILTER(WHERE a.score>20) above20 FROM (SELECT DISTINCT quarter FROM defs)d LEFT JOIN (SELECT a.* FROM scores a JOIN pop p ON p.id=a.enrolment_id)a ON a.quarter=d.quarter GROUP BY d.quarter)
 SELECT jsonb_build_object('enrolments',(SELECT count(*) FROM pop),'children',(SELECT count(*) FROM children),
 'grades',coalesce((SELECT jsonb_object_agg(grade,n) FROM (SELECT grade,count(*) n FROM grades WHERE n=1 AND (r.grade IS NULL OR grade=r.grade) GROUP BY grade)x),'{}'::jsonb),
 'ambiguousGrades',(SELECT count(*) FROM grades WHERE n>1),
 'genders',coalesce((SELECT jsonb_object_agg(gender,n) FROM (SELECT coalesce(gender_code,'Unknown') gender,count(DISTINCT child_id) n FROM pop GROUP BY gender_code)x),'{}'::jsonb),
 'attendance',(SELECT jsonb_build_object('p',count(*) FILTER(WHERE code='P' AND NOT holiday),'a',count(*) FILTER(WHERE code='A' AND NOT holiday),'l',count(*) FILTER(WHERE code='L' AND NOT holiday),'excluded',count(*) FILTER(WHERE holiday OR code IN ('WO','MM')),'percentage',100.0*count(*) FILTER(WHERE code='P' AND NOT holiday)/nullif(count(*) FILTER(WHERE code IN ('P','A','L') AND NOT holiday),0)) FROM marks),
 'quarters',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY quarter),'[]'::jsonb) FROM quarters q),
 'changes',(SELECT jsonb_build_object('n',count(*),'meanChange',avg(delta),'improved',count(*) FILTER(WHERE delta>0),'unchanged',count(*) FILTER(WHERE delta=0),'declined',count(*) FILTER(WHERE delta<0)) FROM pairs)) result
 ) calculated;
