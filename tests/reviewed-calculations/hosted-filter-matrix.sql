-- READ ONLY. Execute with a verified authenticated account and approved scope.
-- psql parameter: month_start, e.g. -v month_start=2026-10-01.
-- Returns aggregate check counts only, never names or individual observations.
WITH dates AS (
 SELECT :'month_start'::date first_day,(:'month_start'::date+interval '1 month')::date until,
        (:'month_start'::date+interval '1 month'-interval '1 day')::date on_day
), year AS (SELECT y.id FROM mass_core.academic_years y,dates d WHERE d.first_day>=y.starts_on AND d.until<=y.ends_before),
contexts AS (
 SELECT 'all' kind,array_agg(id ORDER BY id) ids FROM mass_core.centres
 UNION ALL SELECT 'centre',ARRAY[id] FROM mass_core.centres
 UNION ALL SELECT 'donor',array_agg(id ORDER BY id) FROM mass_core.centres WHERE donor_id IS NOT NULL GROUP BY donor_id
), cases AS (
 SELECT kind,ids,NULL::text grade,NULL::text shift,NULL::text gender FROM contexts
 UNION ALL
 SELECT 'filtered',c.ids,g.grade,s.shift,x.gender FROM contexts c
 CROSS JOIN unnest(ARRAY[NULL,'5','10']::text[])g(grade)
 CROSS JOIN unnest(ARRAY[NULL,'Morning','Evening']::text[])s(shift)
 CROSS JOIN unnest(ARRAY[NULL,'Girl','Boy','Unknown']::text[])x(gender)
 WHERE c.kind='all' AND NOT(g.grade IS NULL AND s.shift IS NULL AND x.gender IS NULL)
), measured AS MATERIALIZED (
 SELECT c.*,mass_api.reviewed_chart_metrics(c.ids,d.on_day,d.first_day,d.until,y.id,c.grade,c.shift,c.gender) actual,
        p.enrolments,p.children,p.episodes,m.p,m.a,m.l,m.excluded,
        100::numeric*m.p/nullif(m.p+m.a+m.l,0) expected_percentage,q.quarters
 FROM cases c CROSS JOIN dates d CROSS JOIN year y
 CROSS JOIN LATERAL (
   SELECT count(*) enrolments,count(DISTINCT e.child_id) children,array_agg(e.id) episodes
   FROM mass_core.enrolments e LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
   WHERE e.centre_id=ANY(c.ids) AND e.starts_on<=d.on_day AND (e.ends_before IS NULL OR d.on_day<e.ends_before)
    AND(c.grade IS NULL OR e.grade_label=c.grade) AND(c.shift IS NULL OR e.shift_code=c.shift)
    AND(c.gender IS NULL OR p.gender_code=c.gender OR c.gender='Unknown' AND p.gender_code IS NULL)
 )p
 CROSS JOIN LATERAL (
   SELECT count(*) FILTER(WHERE code='P' AND NOT holiday) p,
          count(*) FILTER(WHERE code='A' AND NOT holiday) a,
          count(*) FILTER(WHERE code='L' AND NOT holiday) l,
          count(*) FILTER(WHERE code IN('WO','MM') OR holiday) excluded
   FROM(SELECT a.code,EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id
      AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled) holiday
      FROM mass_core.attendance_records a WHERE a.enrolment_id=ANY(p.episodes)
      AND a.attendance_date>=d.first_day AND a.attendance_date<d.until) observations
 )m
 CROSS JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object('quarter',quarter,'n',n,'mean',mean) ORDER BY quarter) quarters
   FROM(SELECT period.quarter,count(result.score) n,avg(result.score) mean
     FROM mass_core.assessment_periods period JOIN mass_core.assessment_definitions definition ON definition.period_id=period.id
     LEFT JOIN mass_core.assessment_results result ON result.definition_id=definition.id AND result.enrolment_id=ANY(p.episodes)
     WHERE period.academic_year_id=y.id GROUP BY period.quarter) score_groups
 )q
), checked AS (
 SELECT *,
  (actual->>'enrolments')::bigint=enrolments AND(actual->>'children')::bigint=children
  AND(actual->'attendance'->>'p')::bigint=p AND(actual->'attendance'->>'a')::bigint=a
  AND(actual->'attendance'->>'l')::bigint=l AND(actual->'attendance'->>'excluded')::bigint=excluded
  AND(CASE WHEN expected_percentage IS NULL THEN actual->'attendance'->>'percentage' IS NULL
      ELSE abs((actual->'attendance'->>'percentage')::numeric-expected_percentage)<0.000000001 END)
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(quarters)expected_quarter(value) FULL JOIN jsonb_array_elements(actual->'quarters')observed_quarter(value)
      ON expected_quarter.value->>'quarter'=observed_quarter.value->>'quarter' WHERE (expected_quarter.value->>'n')::bigint IS DISTINCT FROM(observed_quarter.value->>'n')::bigint
      OR((expected_quarter.value->>'mean') IS NULL) IS DISTINCT FROM((observed_quarter.value->>'mean') IS NULL)
      OR abs((expected_quarter.value->>'mean')::numeric-(observed_quarter.value->>'mean')::numeric)>0.000000001) passed
 FROM measured
)
SELECT jsonb_build_object('month',(SELECT first_day FROM dates),'cases',count(*),
 'passed',count(*) FILTER(WHERE passed),'failed',count(*) FILTER(WHERE passed IS DISTINCT FROM true),
 'case_types',(SELECT jsonb_object_agg(kind,n) FROM(SELECT kind,count(*) n FROM cases GROUP BY kind)counts)) AS reconciliation
FROM checked;
