-- Approved configuration, not imported assessment observations.
-- Existing 2026–27 year only. No new year, exam date, score or student is inferred.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE mass_core.assessment_periods,mass_core.assessment_definitions IN SHARE ROW EXCLUSIVE MODE;
-- Run as the reviewed administrative connection. Do not grant or assume a new
-- role: hosted postgres already has the required INSERT rights and BYPASSRLS.
DO $year$
BEGIN
 IF (SELECT count(*) FROM mass_core.academic_years WHERE starts_on='2026-04-01')<>1 THEN
  RAISE EXCEPTION 'Expected one existing approved April 2026 academic year';
 END IF;
END;$year$;
INSERT INTO mass_core.assessment_periods(academic_year_id,quarter)
SELECT y.id,q FROM mass_core.academic_years y CROSS JOIN generate_series(1,4)q
WHERE y.starts_on='2026-04-01'
ON CONFLICT(academic_year_id,quarter) DO NOTHING;
INSERT INTO mass_core.assessment_definitions(period_id,max_score)
SELECT p.id,25 FROM mass_core.assessment_periods p
JOIN mass_core.academic_years y ON y.id=p.academic_year_id
WHERE y.starts_on='2026-04-01'
ON CONFLICT(period_id) DO NOTHING;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM mass_core.assessment_periods p
     JOIN mass_core.academic_years y ON y.id=p.academic_year_id
     JOIN mass_core.assessment_definitions d ON d.period_id=p.id
     WHERE y.starts_on='2026-04-01' AND p.quarter BETWEEN 1 AND 4 AND d.max_score=25)<>4 THEN
  RAISE EXCEPTION 'Four approved 25-mark definitions required';
 END IF;
END;$verify$;
RESET ROLE;
COMMIT;
