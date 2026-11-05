-- READ ONLY: baseline inspection, not authorization or an installation runner.
-- Target: MASS pbkwpfdpdtelmvbkzgvx. Contains no personal rows or Auth IDs.
SELECT jsonb_build_object(
 'execution_principal',current_user,
 'database',current_database(),
 'postgres_version',current_setting('server_version'),
 'ledger_count',(SELECT count(*) FROM supabase_migrations.schema_migrations),
 'mass_tables',(SELECT count(*) FROM pg_tables WHERE schemaname IN ('mass_core','mass_foundation','mass_import')),
 'unforced_rls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('mass_core','mass_foundation','mass_import') AND c.relkind='r'
   AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)),
 'registration_requests',to_regclass('mass_core.registration_requests'),
 'officer_assignments',to_regclass('mass_core.officer_assignments'),
 'visits',to_regclass('mass_core.cluster_officer_visits'),
 'visit_revisions',to_regclass('mass_core.visit_revisions'),
 'delivery',to_regclass('mass_core.cac_delivery_records'),
 'activation',to_regnamespace('mass_activation'),
 'postgres_can_set_core_owner',pg_has_role('postgres','mass_core_owner','SET'),
 'postgres_can_set_foundation_owner',pg_has_role('postgres','mass_foundation_owner','SET')
) AS preflight;
