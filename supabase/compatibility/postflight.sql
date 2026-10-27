-- READ-ONLY closed-install checks. Run only after separately authorized apply.
-- Does not connect, create objects, modify grants, query personal rows or repair history.
-- Requires an approved metadata-reading administrator; provider API configuration,
-- actual Auth sessions and backup/restore evidence are separate checks.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH tables AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('mass_foundation','mass_core') AND c.relkind='r'
), checks AS (
 SELECT 'foundation_tables' AS check_name,6::bigint AS expected,
  count(*) FILTER (WHERE relnamespace='mass_foundation'::regnamespace) AS actual FROM tables
 UNION ALL SELECT 'core_tables',17,count(*) FILTER (WHERE relnamespace='mass_core'::regnamespace) FROM tables
 UNION ALL SELECT 'enabled_and_forced_rls',23,count(*) FILTER (WHERE relrowsecurity AND relforcerowsecurity) FROM tables
 UNION ALL SELECT 'columns',155,count(*) FROM pg_attribute WHERE attrelid IN (SELECT oid FROM tables) AND attnum>0 AND NOT attisdropped
 UNION ALL SELECT 'foreign_keys',27,count(*) FROM pg_constraint WHERE conrelid IN (SELECT oid FROM tables) AND contype='f'
 UNION ALL SELECT 'unvalidated_constraints',0,count(*) FROM pg_constraint WHERE conrelid IN (SELECT oid FROM tables) AND NOT convalidated
 UNION ALL SELECT 'policies',71,count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM tables)
 UNION ALL SELECT 'api_functions',11,count(*) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace
 UNION ALL SELECT 'api_relations',0,count(*) FROM pg_class WHERE relnamespace='mass_api'::regnamespace
 UNION ALL SELECT 'disabled_user_triggers',0,count(*) FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM tables) AND NOT tgisinternal AND tgenabled<>'O'
 UNION ALL SELECT 'invalid_indexes',0,count(*) FROM pg_index WHERE indrelid IN (SELECT oid FROM tables) AND (NOT indisvalid OR NOT indisready)
 UNION ALL SELECT 'unsafe_definer_search_paths',0,count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('mass_foundation','mass_core','mass_api') AND p.prosecdef
  AND NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog'],false)
 UNION ALL SELECT 'public_function_execute',0,count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
  LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE n.nspname IN ('mass_foundation','mass_core','mass_api') AND a.grantee=0 AND a.privilege_type='EXECUTE'
 UNION ALL SELECT 'unsafe_technical_roles',0,count(*) FROM pg_roles WHERE rolname IN
  ('mass_foundation_owner','mass_foundation_ingestor','mass_foundation_reviewer','mass_foundation_auditor','mass_core_owner','mass_core_admin')
  AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit)
 UNION ALL SELECT 'technical_roles',6,count(*) FROM pg_roles WHERE rolname IN
  ('mass_foundation_owner','mass_foundation_ingestor','mass_foundation_reviewer','mass_foundation_auditor','mass_core_owner','mass_core_admin')
)
SELECT check_name,expected,actual,actual=expected AS passed FROM checks ORDER BY check_name;

-- Counts alone cannot establish exact definitions: also export tests/schema/catalog.sql
-- and reconcile against the frozen DATABASE-SCHEMA-INVENTORY.json. Review any drift.
SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) AS owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('mass_foundation','mass_core','mass_api') AND c.relkind='r'
 ORDER BY n.nspname,c.relname;

-- Full effective EXECUTE matrix, not just literal ACLs, for every definer.
SELECT n.nspname,p.oid::regprocedure AS function_name,
 pg_get_userbyid(p.proowner) AS owner,r.rolname,
 has_function_privilege(r.oid,p.oid,'EXECUTE') AS effective_execute,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS effective_schema_usage
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
 WHERE p.prosecdef AND n.nspname IN ('mass_foundation','mass_core','mass_api')
 AND r.rolname IN ('anon','authenticated','service_role','mass_foundation_owner',
 'mass_foundation_ingestor','mass_foundation_reviewer','mass_foundation_auditor','mass_core_owner','mass_core_admin')
 ORDER BY n.nspname,p.oid::regprocedure::text,r.rolname;

-- Effective ACL violations. Expected: zero rows. Includes inherited/column grants.
-- An administrative service role with broader privileges is a gate to reconcile,
-- never something this query revokes automatically.
SELECT r.rolname,n.nspname,c.relname AS object_name,'table_or_column_access' AS violation
 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE r.rolname IN ('anon','authenticated','service_role') AND c.relkind='r'
 AND n.nspname IN ('mass_foundation','mass_core')
 AND ((n.nspname='mass_foundation' OR r.rolname<>'authenticated') AND
  (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
 OR n.nspname='mass_core' AND r.rolname='authenticated' AND
  (has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES')))
 UNION ALL
 SELECT r.rolname,n.nspname,p.proname,'unexpected_function_execute'
 FROM pg_roles r CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE r.rolname IN ('anon','service_role') AND n.nspname IN ('mass_foundation','mass_core','mass_api')
 AND has_function_privilege(r.oid,p.oid,'EXECUTE')
 UNION ALL
 SELECT r.rolname,n.nspname,n.nspname,'unexpected_schema_usage'
 FROM pg_roles r CROSS JOIN pg_namespace n
 WHERE r.rolname IN ('anon','authenticated','service_role') AND
 (n.nspname='mass_foundation' OR n.nspname IN ('mass_core','mass_api') AND r.rolname<>'authenticated')
 AND has_schema_privilege(r.oid,n.oid,'USAGE');

-- Review every membership touching these roles, including ADMIN/SET/INHERIT options.
-- A creator membership may be provider-required; approve explicitly, do not erase it.
SELECT parent.rolname AS granted_role,member.rolname AS member_role,
 m.admin_option,to_jsonb(m)->>'inherit_option' AS inherit_option,to_jsonb(m)->>'set_option' AS set_option
 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
 WHERE parent.rolname LIKE 'mass\_core\_%' ESCAPE '\' OR parent.rolname LIKE 'mass\_foundation\_%' ESCAPE '\'
 OR member.rolname LIKE 'mass\_core\_%' ESCAPE '\' OR member.rolname LIKE 'mass\_foundation\_%' ESCAPE '\'
 ORDER BY parent.rolname,member.rolname;
-- On PostgreSQL 15 the two option fields are NULL: review that version's fixed
-- membership semantics rather than treating NULL as permission denied.

-- All 22 non-reference tables in a closed initial installation must be empty.
-- No row values are emitted; the 23rd table has the five reference codes below.
SELECT 'children' AS relation,count(*) AS row_count FROM mass_core.children
 UNION ALL SELECT 'private_child_profiles',count(*) FROM mass_core.private_child_profiles
 UNION ALL SELECT 'user_scope_grants',count(*) FROM mass_core.user_scope_grants
 UNION ALL SELECT 'source_files',count(*) FROM mass_foundation.source_files
 UNION ALL SELECT 'source_sheets',count(*) FROM mass_foundation.source_sheets
 UNION ALL SELECT 'source_rows',count(*) FROM mass_foundation.source_rows
 UNION ALL SELECT 'import_batches',count(*) FROM mass_foundation.import_batches
 UNION ALL SELECT 'import_exceptions',count(*) FROM mass_foundation.import_exceptions
 UNION ALL SELECT 'audit_events',count(*) FROM mass_foundation.audit_events
 UNION ALL SELECT 'centres',count(*) FROM mass_core.centres
 UNION ALL SELECT 'enrolments',count(*) FROM mass_core.enrolments
 UNION ALL SELECT 'academic_years',count(*) FROM mass_core.academic_years
 UNION ALL SELECT 'assessment_periods',count(*) FROM mass_core.assessment_periods
 UNION ALL SELECT 'cac_sessions',count(*) FROM mass_core.cac_sessions
 UNION ALL SELECT 'attendance_records',count(*) FROM mass_core.attendance_records
 UNION ALL SELECT 'assessment_definitions',count(*) FROM mass_core.assessment_definitions
 UNION ALL SELECT 'assessment_results',count(*) FROM mass_core.assessment_results
 UNION ALL SELECT 'activity_events',count(*) FROM mass_core.activity_events
 UNION ALL SELECT 'activity_participation',count(*) FROM mass_core.activity_participation
 UNION ALL SELECT 'programme_cohorts',count(*) FROM mass_core.programme_cohorts
 UNION ALL SELECT 'cohort_memberships',count(*) FROM mass_core.cohort_memberships
 UNION ALL SELECT 'morarji_outcomes',count(*) FROM mass_core.morarji_outcomes;
SELECT code,meaning FROM mass_core.attendance_codes ORDER BY code;
-- Expected five confirmed definitions only: A/Absent,L/Leave,MM/Monthly Meeting,
-- P/Present,WO/Sunday. No source data, business grants or synthetic fixtures apply.
COMMIT;
