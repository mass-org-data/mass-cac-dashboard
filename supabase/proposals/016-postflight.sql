-- Prepared read-only acceptance for a separately authorized proposal-016 release.
-- Not a migration, not run on production. Metadata only; no personal row contents.
BEGIN READ ONLY;
WITH relations AS (
 SELECT c.* FROM pg_class c WHERE c.relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND c.relkind='r'
), checks AS (
 SELECT 'tables' AS name,23::bigint AS expected,count(*) AS actual FROM relations
 UNION ALL SELECT 'columns',155,count(*) FROM pg_attribute WHERE attrelid IN (SELECT oid FROM relations) AND attnum>0 AND NOT attisdropped
 UNION ALL SELECT 'foreign_keys',27,count(*) FROM pg_constraint WHERE conrelid IN (SELECT oid FROM relations) AND contype='f'
 UNION ALL SELECT 'policies',72,count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM relations)
 UNION ALL SELECT 'baseline_policies',71,count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM relations)
  AND NOT (polrelid='mass_core.user_scope_grants'::regclass AND polname='self_scope_discovery')
 UNION ALL SELECT 'forced_rls',23,count(*) FROM relations WHERE relrowsecurity AND relforcerowsecurity
 UNION ALL SELECT 'api_functions',20,count(*) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace
 UNION ALL SELECT 'new_invoker_reads',9,count(*) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND NOT prosecdef
  AND proname IN ('get_context','get_references','read_students','read_attendance','read_calendar','read_assessments','read_activities','read_participation','read_morarji')
 UNION ALL SELECT 'definers_unchanged',19,count(*) FROM pg_proc WHERE prosecdef AND pronamespace IN
  ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_api'::regnamespace)
)
SELECT name,expected,actual,expected=actual AS passed FROM checks ORDER BY name;
SELECT attname,attacl::text FROM pg_attribute
 WHERE attrelid='mass_core.user_scope_grants'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum;
SELECT NOT has_table_privilege('authenticated','mass_core.user_scope_grants','SELECT') AS no_full_scope_table_select,
 NOT has_table_privilege('authenticated','mass_core.user_scope_grants','INSERT,UPDATE,DELETE,TRUNCATE') AS no_scope_mutations;
SELECT p.oid::regprocedure AS function_name,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl::text
 FROM pg_proc p WHERE pronamespace='mass_api'::regnamespace ORDER BY p.oid::regprocedure::text;
-- Confirm normal ledger has the original 15 versions plus exactly 202610280016
-- through the actual approved runner. Inspect API exposure separately: private
-- schemas must remain unexposed. This report alone does not prove Auth or RLS.
COMMIT;
