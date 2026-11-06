-- READ ONLY. Run before the FIRST 020 deployment. No schema/data changes.
SELECT current_database() database_name,current_user execution_principal,current_setting('server_version') postgres_version,current_setting('transaction_read_only') read_only;
SELECT r,pg_has_role('postgres',r,'SET') postgres_can_set,pg_has_role('postgres',r,'USAGE') postgres_inherits FROM unnest(ARRAY['mass_core_owner','mass_foundation_owner'])r;
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('mass_core','mass_foundation','mass_import') AND c.relkind='r' ORDER BY 1,2;
SELECT to_regclass('mass_core.registration_requests') registration_requests,to_regclass('mass_core.officer_assignments') officer_assignments,to_regclass('mass_core.cluster_officer_visits') visits,to_regclass('mass_core.visit_revisions') revisions,to_regclass('mass_core.cac_delivery_records') delivery;
SELECT rolname,rolconfig FROM pg_roles WHERE rolname IN ('authenticator','authenticated','anon','postgres');
SELECT setconfig FROM pg_db_role_setting WHERE setrole IN (0,'authenticator'::regrole);
-- Fresh baseline must have 19 recorded versions,27 MASS tables, no new objects.
-- If any020–023 version/object is present, STOP and reconcile the exact ledger,
-- manifest and object definitions; do not rerun applied files or drop objects.
