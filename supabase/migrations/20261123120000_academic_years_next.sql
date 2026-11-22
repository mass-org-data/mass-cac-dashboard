-- Configure the next academic years (2027-28 to 2029-30) with their four quarters so that
-- mass_api.promote_student can open next-year enrolments. Additive and idempotent.
-- Run supabase/activation/seal.sql in the same transaction. Rollback: delete the rows added here if unused.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_admin;
INSERT INTO mass_core.academic_years(starts_on)
SELECT d::date FROM unnest(ARRAY['2027-04-01','2028-04-01','2029-04-01']) AS d
ON CONFLICT (starts_on) DO NOTHING;
INSERT INTO mass_core.assessment_periods(academic_year_id,quarter)
SELECT y.id,q FROM mass_core.academic_years y CROSS JOIN generate_series(1,4) q
WHERE y.starts_on IN ('2027-04-01','2028-04-01','2029-04-01')
ON CONFLICT (academic_year_id,quarter) DO NOTHING;
RESET ROLE;
COMMIT;
