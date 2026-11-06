-- READ-ONLY ADMINISTRATIVE AUDIT QUERIES. Never expose private schemas to a browser.
-- Fixed audit scope: 29 October 2026; October reporting month unless stated.

-- C001 Unique enrolled students
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT count(distinct child_id) value FROM scoped;

-- C002 Recorded attendance percentage
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT 100.0*count(*) FILTER(WHERE code='P')/nullif(count(*) FILTER(WHERE code IN ('P','A','L')),0) value FROM marks;

-- C003 Recorded P marks
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT count(*) value FROM marks WHERE code='P';

-- C004 Recorded A marks
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT count(*) value FROM marks WHERE code='A';

-- C005 Recorded L marks
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT count(*) value FROM marks WHERE code='L';

-- C006 Recorded WO marks
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT count(*) value FROM marks WHERE code='WO';

-- C007 Recorded MM marks
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT count(*) value FROM marks WHERE code='MM';

-- C008 Enrolled students by centre
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT c.label dimension,count(distinct s.child_id) value FROM mass_core.centres c LEFT JOIN scoped s ON s.centre_id=c.id GROUP BY c.id,c.label ORDER BY c.label,c.id;

-- C009 Enrolled students by grade
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT grade_label dimension,count(distinct child_id) value FROM scoped GROUP BY grade_label ORDER BY grade_label;

-- C010 Enrolled students by gender
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT coalesce(p.gender_code,'Unknown') dimension,count(distinct e.child_id) value FROM scoped e LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id GROUP BY p.gender_code ORDER BY p.gender_code;

-- C011 Recorded attendance percentage by centre
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT c.label dimension,100.0*count(*) FILTER(WHERE a.code='P')/nullif(count(*) FILTER(WHERE a.code IN ('P','A','L')),0) value FROM mass_core.centres c LEFT JOIN marks a ON a.centre_id=c.id GROUP BY c.id,c.label ORDER BY c.label,c.id;

-- C012 Low-attendance children
SELECT NULL::numeric value, 'No complete authoritative expected-day/held-session population; observed dates alone do not establish completeness.'::text unavailable_reason;

-- C013 Unmarked attendance entries
SELECT NULL::numeric value, 'Need authorized expected child-session calendar and verified held status; observed-centre dates cannot prove missing days.'::text unavailable_reason;

-- C014 Monthly CAC dropout
SELECT NULL::numeric value, 'No recorded delivery calendar; P/A/L/WO/MM completeness and the original H convention need reconciliation. No dropout rate denominator is approved.'::text unavailable_reason;

-- C015 Good-engagement students
SELECT NULL::numeric value, 'No named held/category-approved activity coverage; absence of events is unknown, not zero participation.'::text unavailable_reason;

-- C016 Engagement distribution by centre
SELECT NULL::numeric value, 'Good/review/low/incomplete definitions depend on complete attendance and approved activity eligibility.'::text unavailable_reason;

-- C017 Attendance bands
SELECT NULL::numeric value, 'Thresholds count present days, but eligibility requires an approved completeness/calendar rule.'::text unavailable_reason;

-- C018 Held/planned/cancelled CAC sessions
SELECT NULL::numeric value, 'is_scheduled is not delivery status; no observed held/planned/cancelled delivery dataset/API exists.'::text unavailable_reason;

-- C019 Activity held/planned totals
SELECT NULL::numeric value, 'Named event table lacks delivery status; historical monthly responses cannot supply exact event names/dates.'::text unavailable_reason;

-- C020 Students participating in 2+ activities
SELECT NULL::numeric value, 'Current category/delivery eligibility cannot be established; monthly response slots are preserved separately.'::text unavailable_reason;

-- C021 Missing activity records
SELECT NULL::numeric value, 'Need eligible child-event opportunities and known held events; zero event rows cannot prove complete participation.'::text unavailable_reason;

-- C022 Activity participation distribution
SELECT NULL::numeric value, 'Need named dated event identity and approved eligible categories/status; no invented Saturday events.'::text unavailable_reason;

-- C023 Participation by centre
SELECT NULL::numeric value, 'Need scoped verified child-event records and event eligibility, not monthly slot-name inference.'::text unavailable_reason;

-- C024 School-performance comparison
SELECT NULL::numeric value, 'No school-report dataset, schema, scales, comparability or matched baseline is supplied.'::text unavailable_reason;

-- C025 Completed officer visits
SELECT NULL::numeric value, 'Source visit logs exist but are not reconciled/imported; visit operational relation and API are absent.'::text unavailable_reason;

-- C026 Morning officer visits
SELECT NULL::numeric value, 'Need verified dated officer-centre-shift visits and applicable assignments.'::text unavailable_reason;

-- C027 Evening officer visits
SELECT NULL::numeric value, 'Need verified dated officer-centre-shift visits and applicable assignments.'::text unavailable_reason;

-- C028 Centres meeting visit target
SELECT NULL::numeric value, 'Target four/two-per-shift is a prototype expectation requiring source-backed approval and validity dates.'::text unavailable_reason;

-- C029 Visits by officer
SELECT NULL::numeric value, 'No operational visit relation/API; staff directory alone is not a visit.'::text unavailable_reason;

-- C030 Visit centre coverage
SELECT NULL::numeric value, 'No verified monthly visit observations or approved target policy in the backend.'::text unavailable_reason;

-- C031 Morarji year-on-year pass counts
SELECT NULL::numeric value, '548 source rows lack approved centre/grade identity/cohort linkage; outcome API exists, but review adapter ignores returned Morarji rows.'::text unavailable_reason;

-- C032 Morarji cohort/training/exam/pending comparison
SELECT NULL::numeric value, 'No imported cohort/membership/outcome rows; pending is not implied by a nullable passed flag.'::text unavailable_reason;

-- C033 Morarji selection/admission/scholarship outcomes
SELECT NULL::numeric value, 'Only applied/attended/passed/school fields are approved; selection/admission/scholarship source and schema require separate approval.'::text unavailable_reason;

-- C034 Career guidance participants
SELECT NULL::numeric value, 'No source-backed session/cohort/participant dataset or operational module supplied.'::text unavailable_reason;

-- C035 Guidance participants contacted
SELECT NULL::numeric value, 'No source-backed follow-up contacts; do not invent contact outcomes.'::text unavailable_reason;

-- C036 Guidance destinations recorded
SELECT NULL::numeric value, 'No verified destination observation or source; unknown is not a successful transition.'::text unavailable_reason;

-- C037 Guidance verified admissions
SELECT NULL::numeric value, 'Needs explicit evidence reference, verification identity/date and approved restricted handling.'::text unavailable_reason;

-- C038 Guidance subject/course chosen
SELECT NULL::numeric value, 'Original controlled choices are demonstrative; actual programme catalogue and destination observations are not supplied.'::text unavailable_reason;

-- C039 Matched-round average score improvement
SELECT NULL::numeric value, 'Require matched child UUID, explicit year/quarter mapping, comparable papers and equal approved scales; NULL/zero baseline handling differs from unmatched round averages.'::text unavailable_reason;

-- C040 Matched-round improved/unchanged/declined
SELECT NULL::numeric value, 'Need approved F-to-quarter/year mapping and comparable papers; never treat missing scores as unchanged.'::text unavailable_reason;

-- C041 Quarter 2 scored students
SELECT count(distinct a.child_id) value FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id WHERE y.starts_on='2026-04-01' AND p.quarter=2 AND d.max_score=25;

-- C042 Quarter 2 mean score
SELECT avg(a.score) value FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id WHERE y.starts_on='2026-04-01' AND p.quarter=2 AND d.max_score=25;

-- C043 Quarter 2 eligible students without a score
WITH scoped AS (SELECT e.* FROM mass_core.enrolments e WHERE e.starts_on<='2026-10-29'::date AND (e.ends_before IS NULL OR e.ends_before>'2026-10-29'::date)), marks AS (SELECT a.* FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id WHERE a.attendance_date>='2026-10-01'::date AND a.attendance_date<'2026-11-01'::date AND a.attendance_date>=e.starts_on AND (e.ends_before IS NULL OR a.attendance_date<e.ends_before) AND NOT EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND NOT s.is_scheduled)) SELECT count(distinct s.child_id) value FROM scoped s WHERE NOT EXISTS(SELECT 1 FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id WHERE y.starts_on='2026-04-01' AND p.quarter=2 AND d.max_score=25 AND a.child_id=s.child_id);

-- C044 Quarter 2 scores above 20
SELECT count(distinct a.child_id) value FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id WHERE y.starts_on='2026-04-01' AND p.quarter=2 AND d.max_score=25 AND a.score>20;

-- C045 Quarter 2 score distribution
SELECT CASE WHEN a.score<=8 THEN '0–8' WHEN a.score<=15 THEN '9–15' WHEN a.score<=20 THEN '16–20' ELSE '21–25' END dimension,count(*) value FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id WHERE y.starts_on='2026-04-01' AND p.quarter=2 AND d.max_score=25 GROUP BY 1 ORDER BY 1;

-- C046 Quarter 2 means by centre
SELECT c.label dimension,avg(a.score) value FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id JOIN mass_core.centres c ON c.id=a.centre_id WHERE y.starts_on='2026-04-01' AND p.quarter=2 AND d.max_score=25 GROUP BY c.id,c.label ORDER BY c.label,c.id;

-- C047 Quarter means and coverage
SELECT p.quarter dimension,count(*) result_count,avg(a.score) value FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id WHERE y.starts_on='2026-04-01' AND d.max_score=25 GROUP BY p.quarter ORDER BY p.quarter;

-- C048 Morarji recorded applied/attended/passed
SELECT count(*) FILTER(WHERE o.applied IS TRUE) applied,count(*) FILTER(WHERE o.attended IS TRUE) attended,count(*) FILTER(WHERE o.passed IS TRUE) passed,count(*) source_outcome_rows FROM mass_core.morarji_outcomes o;

-- C049 Attendance by month
SELECT to_char(attendance_date,'YYYY-MM') dimension,count(*) marks,count(*) FILTER(WHERE code='P') p,count(*) FILTER(WHERE code='A') a,count(*) FILTER(WHERE code='L') l,count(*) FILTER(WHERE code='WO') wo,count(*) FILTER(WHERE code='MM') mm,100.0*count(*) FILTER(WHERE code='P')/nullif(count(*) FILTER(WHERE code IN ('P','A','L')),0) value FROM mass_core.attendance_records GROUP BY 1 ORDER BY 1;