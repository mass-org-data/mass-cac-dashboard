-- READ-ONLY metadata report for a later authorized target inspection.
-- This file neither connects to a project nor applies any migration or grant.
BEGIN READ ONLY;
SELECT current_database() AS database_name,current_user AS migration_principal,
 current_setting('server_version') AS postgres_version;
SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls
 FROM pg_roles WHERE rolname IN (current_user,'anon','authenticated','service_role') ORDER BY rolname;
SELECT nspname AS existing_schema FROM pg_namespace
 WHERE nspname IN ('auth','mass_foundation','mass_core','mass_api') ORDER BY nspname;
SELECT to_regclass('auth.users') AS auth_users,
 to_regprocedure('auth.uid()') AS auth_uid;
SELECT has_database_privilege(current_user,current_database(),'CREATE') AS can_create_schema,
 has_table_privilege(current_user,to_regclass('auth.users'),'REFERENCES WITH GRANT OPTION') AS can_delegate_auth_references;
SELECT rolname AS role_collision_requires_review FROM pg_roles
 WHERE rolname LIKE 'mass_foundation_%' OR rolname LIKE 'mass_core_%' ORDER BY rolname;
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('mass_foundation','mass_core') AND c.relkind='r'
 ORDER BY n.nspname,c.relname;
-- Does not inspect auth users, JWTs, secrets, child data or API credentials.
-- API exposure, trusted Auth issuance, role membership/default grants, storage,
-- migration-role ownership/SET ROLE capability and backups still require review.
COMMIT;
