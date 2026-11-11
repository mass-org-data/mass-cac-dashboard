-- Authorized by Aashini on 11 November: registration and activity/MM entry.
-- Apply only after the metadata and centre-wide-event migrations pass hosted checks.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $ready$
DECLARE c record;
BEGIN
 IF to_regprocedure('mass_api.save_attendance_register_v3(uuid,uuid,text,date,text,jsonb,text,text)') IS NULL OR to_regprocedure('mass_api.record_centre_event(uuid,uuid,date,text,text,text,text,bigint)') IS NULL THEN RAISE EXCEPTION 'Required workflow migrations are missing';END IF;
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='mass_activation.features'::regclass AND contype='c' AND position('attendance_corrections' IN pg_get_constraintdef(oid))>0 AND position('activities' IN pg_get_constraintdef(oid))>0 LOOP
  EXECUTE format('ALTER TABLE mass_activation.features DROP CONSTRAINT %I',c.conname);
 END LOOP;
 -- Lift only the activity hard-off boundary; all unrelated restrictions remain.
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mass_activation.features'::regclass AND conname='preserved_hard_off_controls') THEN
  ALTER TABLE mass_activation.features ADD CONSTRAINT preserved_hard_off_controls CHECK(NOT enabled OR feature NOT IN ('attendance_corrections','assessment_corrections','visit_corrections','transfers','profiles','enrolments','calendar','morarji'));
 END IF;
END;$ready$;
UPDATE mass_activation.features SET enabled=true,approval_reference='Aashini 2026-11-11: registration and centre activity/MM entry' WHERE feature IN ('registration','activities') AND NOT enabled;
NOTIFY pgrst,'reload schema';
COMMIT;
