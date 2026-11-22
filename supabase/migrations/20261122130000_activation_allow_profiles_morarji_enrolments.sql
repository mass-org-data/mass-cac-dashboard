-- Owner decision (22 November 2026): the hard-off boundary on the `profiles`, `morarji` and `enrolments` activation features is lifted
-- so they can be switched on through the normal approved, logged change (UPDATE with an approval reference). This migration does NOT
-- enable anything. attendance_corrections, assessment_corrections, visit_corrections, transfers, calendar and activities stay hard-off.
-- Installed databases only: a fresh install gets the same constraint from supabase/activation/control.sql.
-- Rollback: re-create the previous CHECK listing the three features again (only possible while they are all disabled).
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $boundary$
DECLARE c record;
BEGIN
 IF to_regclass('mass_activation.features') IS NULL THEN
  RAISE NOTICE 'mass_activation.features is not installed; nothing to change';
  RETURN;
 END IF;
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='mass_activation.features'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%attendance_corrections%' AND pg_get_constraintdef(oid) LIKE '%profiles%' LOOP
  EXECUTE format('ALTER TABLE mass_activation.features DROP CONSTRAINT %I',c.conname);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mass_activation.features'::regclass AND conname='features_preservation_boundary') THEN
  ALTER TABLE mass_activation.features ADD CONSTRAINT features_preservation_boundary
   CHECK(NOT enabled OR feature NOT IN ('attendance_corrections','assessment_corrections','visit_corrections','transfers','calendar','activities'));
 END IF;
END;$boundary$;
COMMIT;
