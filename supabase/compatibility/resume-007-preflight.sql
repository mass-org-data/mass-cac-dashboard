-- PREPARED ONLY. Not run on production by this correction.
-- Authorized administrator: read-only diagnostics before a separately approved resume.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT session_user AS connection_principal,current_user AS execution_principal,
 has_database_privilege(current_user,current_database(),'CREATE') AS database_create;
SELECT rolname,rolcreaterole,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user;
SELECT has_schema_privilege(current_user,'auth','USAGE') AS direct_auth_usage,
 has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION') AS delegable_auth_usage,
 has_function_privilege(current_user,'auth.uid()','EXECUTE') AS direct_uid_execute,
 has_function_privilege(current_user,'auth.uid()','EXECUTE WITH GRANT OPTION') AS delegable_uid_execute,
 has_column_privilege(current_user,'auth.users','id','REFERENCES') AS direct_id_references,
 has_column_privilege(current_user,'auth.users','id','REFERENCES WITH GRANT OPTION') AS delegable_id_references;
-- The corrected files require direct rights, not these delegation options.
SELECT pg_get_userbyid(p.proowner) AS managed_uid_owner,p.proacl::text AS managed_uid_acl,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS existing_public_uid_execute
 FROM pg_proc p WHERE p.oid='auth.uid()'::regprocedure;
-- New owner must already be allowed to execute managed uid(), normally by its
-- existing function PUBLIC ACL. If not, stop for narrow provider authorization;
-- never broaden PUBLIC grants or add elevated wrappers to force a pass.
SELECT nspname AS unexpected_core_schema FROM pg_namespace WHERE nspname IN ('mass_core','mass_api');
SELECT rolname AS unexpected_core_role FROM pg_roles WHERE rolname IN ('mass_core_owner','mass_core_admin');
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
 FROM pg_class c WHERE c.relnamespace='mass_foundation'::regnamespace AND c.relkind='r' ORDER BY c.relname;
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- Require the six approved 001-006 ledger versions only and six foundation
-- tables; unknown versions or leftovers stop resume. Never repair history here.
COMMIT;
