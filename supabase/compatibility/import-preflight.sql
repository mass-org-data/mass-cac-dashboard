-- Prepared metadata-only checks. Run only in an authorized read-only inspection.
BEGIN READ ONLY;
SELECT current_database(),current_user,session_user,current_setting('transaction_read_only'),current_setting('server_version');
SELECT pg_has_role(session_user,'mass_foundation_ingestor','SET') AS operator_can_set_ingestor,
 pg_has_role(session_user,'mass_core_owner','SET') AS operator_can_set_core_owner;
SELECT column_name FROM information_schema.columns WHERE table_schema='mass_foundation' AND table_name='source_sheets' ORDER BY ordinal_position;
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
-- Current managed ledger uses runner timestamps as versions and original file
-- stems as names. Reconcile all 17 names; NEVER db push/replay/repair history.
SELECT 'source_files' AS relation_name,count(*) FROM mass_foundation.source_files
UNION ALL SELECT 'source_sheets',count(*) FROM mass_foundation.source_sheets
UNION ALL SELECT 'source_rows',count(*) FROM mass_foundation.source_rows
UNION ALL SELECT 'batches',count(*) FROM mass_foundation.import_batches
UNION ALL SELECT 'donors',count(*) FROM mass_core.donors
UNION ALL SELECT 'centres',count(*) FROM mass_core.centres
UNION ALL SELECT 'staff',count(*) FROM mass_core.staff_members
UNION ALL SELECT 'staff_assignments',count(*) FROM mass_core.centre_staff_assignments;
COMMIT;
