-- Review separately after installing the Swapneel workflow migration.
-- Enable profile corrections only; preserve every unrelated hard-off control.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $configure$
DECLARE c record; definition text;
BEGIN
 IF to_regprocedure('mass_api.save_student_profile_year(uuid,uuid,bigint,text,text,boolean,uuid,text,bigint)') IS NULL THEN RAISE EXCEPTION 'Academic-year profile update is not installed';END IF;
 FOR c IN SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='mass_activation.features'::regclass AND contype='c' AND position('enabled' IN pg_get_constraintdef(oid))>0 AND position('profiles' IN pg_get_constraintdef(oid))>0 LOOP
  definition:=replace(replace(c.definition,$remove$'profiles'::text, $remove$,''),$remove$, 'profiles'::text$remove$,'');
  IF position('profiles' IN definition)>0 THEN RAISE EXCEPTION 'Unrecognised profile hard-off boundary; configuration held';END IF;
  EXECUTE format('ALTER TABLE mass_activation.features DROP CONSTRAINT %I',c.conname);
  EXECUTE format('ALTER TABLE mass_activation.features ADD CONSTRAINT %I %s',c.conname,definition);
 END LOOP;
END;$configure$;
UPDATE mass_activation.features SET enabled=true,approval_reference='Aashini 2026-11-12: authorised student profile and academic-year status editing' WHERE feature='profiles' AND NOT enabled;
NOTIFY pgrst,'reload schema';
COMMIT;
