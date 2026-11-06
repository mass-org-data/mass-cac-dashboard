-- psql script, READ ONLY. Never connects, creates objects, changes roles or repairs history.
-- Run as the intended migration principal only after separately authorized read-only access.
-- Store actual output privately: role identifiers are administrative metadata.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database() AS database_name,current_user AS principal,
 current_setting('server_version') AS version,
 current_setting('createrole_self_grant',true) AS creator_membership_setting,
 has_database_privilege(current_user,current_database(),'CREATE') AS database_create;
SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin,rolinherit,rolbypassrls
 FROM pg_roles WHERE rolname IN (current_user,'anon','authenticated','service_role','authenticator',
 'mass_foundation_owner','mass_foundation_ingestor','mass_foundation_reviewer',
 'mass_foundation_auditor','mass_core_owner','mass_core_admin') ORDER BY rolname;
SELECT to_regclass('auth.users') AS managed_users,to_regprocedure('auth.uid()') AS managed_uid;
SELECT has_schema_privilege(current_user,n.oid,'USAGE') AS auth_usage,
 has_schema_privilege(current_user,n.oid,'USAGE WITH GRANT OPTION') AS auth_usage_delegation
 FROM pg_namespace n WHERE n.nspname='auth';
SELECT CASE WHEN to_regclass('auth.users') IS NOT NULL THEN
 has_column_privilege(current_user,to_regclass('auth.users'),'id','REFERENCES WITH GRANT OPTION') END AS auth_id_reference_delegation,
 CASE WHEN to_regprocedure('auth.uid()') IS NOT NULL THEN
 has_function_privilege(current_user,to_regprocedure('auth.uid()'),'EXECUTE WITH GRANT OPTION') END AS auth_uid_execute_delegation;
SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,n.nspacl::text AS schema_acl
 FROM pg_namespace n WHERE n.nspname IN ('auth','mass_foundation','mass_core','mass_api') ORDER BY n.nspname;
SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('mass_foundation','mass_core','mass_api') ORDER BY n.nspname,c.relname;
SELECT n.nspname,p.oid::regprocedure AS function_name,pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef,p.proconfig,p.proacl::text AS acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('mass_foundation','mass_core','mass_api') ORDER BY n.nspname,p.oid::regprocedure::text;
-- Any pre-existing MASS role/schema/object on a fresh install requires reconciliation.
SELECT r.rolname,pg_has_role(current_user,r.oid,'USAGE') AS inherits_privileges,
 CASE WHEN current_setting('server_version_num')::integer>=160000
 THEN pg_has_role(current_user,r.oid,'SET') ELSE pg_has_role(current_user,r.oid,'MEMBER') END AS can_set_role
 FROM pg_roles r WHERE r.rolname IN ('mass_foundation_owner','mass_foundation_ingestor',
 'mass_foundation_reviewer','mass_foundation_auditor','mass_core_owner','mass_core_admin');
-- PostgreSQL 15 has fixed membership semantics; 16+ has separate SET/INHERIT options.
SELECT parent.rolname AS granted_role,member.rolname AS member_role,m.admin_option,
 to_jsonb(m)->>'inherit_option' AS inherit_option,to_jsonb(m)->>'set_option' AS set_option
 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
 WHERE parent.rolname IN ('anon','authenticated','service_role','authenticator')
 OR member.rolname=current_user
 OR parent.rolname LIKE 'mass\_core\_%' ESCAPE '\' OR parent.rolname LIKE 'mass\_foundation\_%' ESCAPE '\'
 OR member.rolname LIKE 'mass\_core\_%' ESCAPE '\' OR member.rolname LIKE 'mass\_foundation\_%' ESCAPE '\'
 ORDER BY parent.rolname,member.rolname;
SELECT pg_get_userbyid(d.defaclrole) AS creator,n.nspname AS schema_name,d.defaclobjtype,d.defaclacl::text
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR pg_get_userbyid(d.defaclrole) IN ('mass_foundation_owner','mass_core_owner')
 OR n.nspname IN ('mass_foundation','mass_core','mass_api') ORDER BY creator,schema_name,d.defaclobjtype;
-- Hints only; Dashboard/Data API/gateway configuration must also be inspected.
SELECT current_setting('pgrst.db_schemas',true) AS session_api_schema_hint,
 current_setting('pgrst.db_extra_search_path',true) AS session_extra_path_hint;
SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS ledger_exists \gset
\if :ledger_exists
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
\else
SELECT 'No migration ledger exists: verify staging runner initialization before approval' AS ledger_review;
\endif
COMMIT;
-- CREATE ROLE/SET ROLE/ownership success for roles not yet created cannot be proven
-- by read-only queries. Rehearse the exact files with the intended principal in staging.
