-- Metadata-only, prepared locally; never run on hosted MASS by this phase.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT current_database(),session_user,current_user,version();
SELECT pg_has_role(current_user,'mass_foundation_owner','SET') AS can_set_foundation_owner,
 pg_has_role(current_user,'mass_core_owner','SET') AS can_set_core_owner;
SELECT 23 AS expected,count(*) AS baseline_tables FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r';
SELECT 72 AS expected,count(*) AS baseline_policies FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace));
SELECT 20 AS expected,count(*) AS baseline_api_functions FROM pg_proc WHERE pronamespace='mass_api'::regnamespace;
SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='mass_core' AND c.relname IN ('donors','staff_members','centre_staff_assignments');
SELECT attname AS unexpected_existing_column FROM pg_attribute WHERE attrelid='mass_core.centres'::regclass AND attname IN ('donor_id','donor_source_row_id') AND NOT attisdropped;
SELECT pg_get_triggerdef(oid) AS existing_centre_guard FROM pg_trigger WHERE tgrelid='mass_core.centres'::regclass AND tgname='guard_write';
SELECT n.nspname,p.oid::regprocedure AS unexpected_existing_function FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('mass_core','mass_api') AND p.proname IN ('guard_centre_directory','guard_directory_immutable','get_centre_directory','get_centre_staff');
-- Inspect actual runner ledger separately: original 16 recorded, only 202610280017 pending.
COMMIT;
