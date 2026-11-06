-- Metadata-only readiness report for 016; run only in an approved inspection window.
-- No object creation, grants, accounts, row contents or migration execution.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT current_database(),session_user,current_user,version();
SELECT pg_has_role(current_user,'mass_core_owner','SET') AS can_set_owner,
 pg_has_role(current_user,'mass_core_owner','USAGE') AS inherits_owner;
SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,n.nspacl::text
 FROM pg_namespace n WHERE n.nspname IN ('mass_foundation','mass_core','mass_api');
SELECT 'baseline_tables' AS check_name,23 AS expected,count(*) AS actual FROM pg_class
 WHERE relnamespace IN ('mass_foundation'::regnamespace,'mass_core'::regnamespace) AND relkind='r'
UNION ALL SELECT 'baseline_policies',71,count(*) FROM pg_policy WHERE polrelid IN
 (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_foundation'::regnamespace,'mass_core'::regnamespace) AND relkind='r')
UNION ALL SELECT 'baseline_api_functions',11,count(*) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace;
SELECT n.nspname,p.oid::regprocedure AS unexpected_existing_016_function
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='mass_api' AND p.proname IN ('get_context','get_references','read_students','read_attendance','read_calendar','read_assessments','read_activities','read_participation','read_morarji'))
 OR (n.nspname='mass_core' AND p.proname='require_read_scope');
SELECT polname AS unexpected_existing_016_policy FROM pg_policy
 WHERE polrelid='mass_core.user_scope_grants'::regclass AND polname='self_scope_discovery';
SELECT has_any_column_privilege('authenticated','mass_core.user_scope_grants','SELECT') AS unexpected_preexisting_scope_read;
SELECT pg_get_userbyid(d.defaclrole) AS creator,n.nspname,d.defaclobjtype,d.defaclacl::text
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclrole='mass_core_owner'::regrole;
-- Inspect the migration ledger using the actual deployment runner: exactly original
-- 15 successful versions, 016 absent, no additional pending/unreviewed migration.
-- Do not repair history automatically. Inspect mass_api exposure in provider config.
COMMIT;
