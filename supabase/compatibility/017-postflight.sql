-- Read-only metadata acceptance after a separately authorized 017 application.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
WITH relations AS (SELECT * FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r'), checks AS (
 SELECT 'tables' AS name,26::bigint AS expected,count(*) AS actual FROM relations
 UNION ALL SELECT 'columns',174,count(*) FROM pg_attribute WHERE attrelid IN (SELECT oid FROM relations) AND attnum>0 AND NOT attisdropped
 UNION ALL SELECT 'foreign_keys',34,count(*) FROM pg_constraint WHERE conrelid IN (SELECT oid FROM relations) AND contype='f'
 UNION ALL SELECT 'policies',78,count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM relations)
 UNION ALL SELECT 'forced_rls',26,count(*) FROM relations WHERE relrowsecurity AND relforcerowsecurity
 UNION ALL SELECT 'api_functions',22,count(*) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace
 UNION ALL SELECT 'definers_unchanged',19,count(*) FROM pg_proc WHERE prosecdef AND pronamespace IN ('mass_api'::regnamespace,'mass_core'::regnamespace,'mass_foundation'::regnamespace)
 UNION ALL SELECT 'directory_invoker_apis',2,count(*) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND proname IN ('get_centre_directory','get_centre_staff') AND NOT prosecdef
) SELECT name,expected,actual,expected=actual AS passed FROM checks ORDER BY name;
SELECT p.oid::regprocedure,pg_get_userbyid(p.proowner),p.proconfig,p.proacl::text FROM pg_proc p WHERE pronamespace='mass_api'::regnamespace AND proname IN ('get_centre_directory','get_centre_staff');
SELECT attrelid::regclass,attname,attacl::text FROM pg_attribute WHERE attrelid IN ('mass_core.donors'::regclass,'mass_core.staff_members'::regclass,'mass_core.centre_staff_assignments'::regclass,'mass_core.centres'::regclass) AND attnum>0 AND NOT attisdropped ORDER BY attrelid::regclass::text,attnum;
SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='mass_core.centres'::regclass AND tgname IN ('guard_write','audit_write','guard_truncate');
-- Reconcile exact policies/functions/ACLs with generated catalog; counts alone do
-- not prove security. Do not expose mass_core/mass_foundation through Data API.
COMMIT;
