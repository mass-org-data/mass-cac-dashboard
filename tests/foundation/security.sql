-- Catalog checks plus direct SQL under real restricted roles (not only UI checks).
SELECT foundation_test.assert_true((SELECT count(*)=6 AND bool_and(relrowsecurity AND relforcerowsecurity)
 FROM pg_class WHERE relnamespace='mass_foundation'::regnamespace AND relkind='r'),'exactly six tables, all with enabled and forced RLS');
SELECT foundation_test.assert_true((SELECT bool_and(NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole)
 FROM pg_roles WHERE rolname LIKE 'mass_foundation_%'),'all technical roles non-login and non-bypass');
SELECT foundation_test.assert_true((SELECT count(*)=0 FROM pg_auth_members WHERE roleid='mass_foundation_owner'::regrole),'owner role has no members');
SELECT foundation_test.assert_true((SELECT count(*)=0 FROM information_schema.columns
 WHERE table_schema='mass_foundation' AND column_name IN ('full_name','phone','payload','payload_ref','resolution_note','header_spec','filename','name')),'no personal/free-payload columns');
SELECT foundation_test.assert_true((SELECT bool_and(NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
 FROM pg_proc p WHERE pronamespace='mass_foundation'::regnamespace),'application role cannot execute helpers');

SET SESSION AUTHORIZATION mass_test_unprivileged;
SELECT foundation_test.expect_error('SET ROLE mass_foundation_ingestor','42501','unassigned login cannot become ingestor');
SELECT set_config('request.jwt.claims','{"role":"mass_foundation_ingestor"}',false);
SELECT foundation_test.expect_error('SELECT * FROM mass_foundation.source_files','42501','forged client claim cannot grant SQL access');
RESET SESSION AUTHORIZATION;
SET ROLE anon;
SELECT foundation_test.expect_error('SELECT * FROM mass_foundation.source_files','42501','anonymous schema access denied');
SELECT foundation_test.expect_error('INSERT INTO mass_foundation.source_files(sha256,storage_ref) VALUES(repeat(''e'',64),gen_random_uuid())','42501','anonymous insert denied');
RESET ROLE;
SET ROLE authenticated;
SELECT foundation_test.expect_error('SELECT * FROM mass_foundation.import_exceptions','42501','authenticated private exceptions denied');
SELECT foundation_test.expect_error('SELECT mass_foundation.record_audit()','42501','authenticated audit helper denied');
RESET ROLE;
SET ROLE service_role;
SELECT foundation_test.expect_error('SELECT * FROM mass_foundation.source_rows','42501','BYPASSRLS service role still denied by schema privileges');
RESET ROLE;
SET ROLE mass_foundation_ingestor;
SELECT foundation_test.expect_error('UPDATE mass_foundation.source_files SET sha256=repeat(''f'',64)','42501','ingestor cannot rewrite snapshots');
SELECT foundation_test.expect_error('DELETE FROM mass_foundation.source_rows','42501','ingestor cannot delete row occurrences');
SELECT foundation_test.expect_error('TRUNCATE mass_foundation.source_files','42501','ingestor cannot truncate');
SELECT foundation_test.expect_error('UPDATE mass_foundation.import_batches SET row_version=99','42501','ingestor cannot forge revision');
SELECT foundation_test.expect_error('UPDATE mass_foundation.import_exceptions SET review_state=''resolved'',resolution_code=''excluded''','42501','ingestor cannot adjudicate exceptions');
SELECT foundation_test.expect_error('SELECT * FROM mass_foundation.audit_events','42501','ingestor cannot read audit trail');
SELECT foundation_test.expect_error('INSERT INTO mass_foundation.audit_events DEFAULT VALUES','42501','ingestor cannot fabricate audit');
SELECT foundation_test.expect_error('ALTER TABLE mass_foundation.source_rows DISABLE ROW LEVEL SECURITY','42501','ingestor cannot disable RLS');
RESET ROLE;
SET ROLE mass_foundation_reviewer;
SELECT foundation_test.expect_error('INSERT INTO mass_foundation.source_files(sha256,storage_ref) VALUES(repeat(''e'',64),gen_random_uuid())','42501','reviewer cannot ingest');
SELECT foundation_test.expect_error('UPDATE mass_foundation.import_batches SET state=''running''','42501','reviewer cannot advance batch');
SELECT foundation_test.expect_error('UPDATE mass_foundation.import_exceptions SET resolved_by=''mass_test_auditor''','42501','reviewer cannot forge attribution');
RESET ROLE;
SET ROLE mass_foundation_auditor;
SELECT foundation_test.expect_error('UPDATE mass_foundation.audit_events SET operation=''INSERT''','42501','auditor cannot edit audit');
SELECT foundation_test.expect_error('DELETE FROM mass_foundation.audit_events','42501','auditor cannot delete audit');
SELECT foundation_test.expect_error('INSERT INTO mass_foundation.audit_events DEFAULT VALUES','42501','auditor cannot append audit');
SELECT foundation_test.expect_error('UPDATE mass_foundation.import_exceptions SET review_state=''open''','42501','auditor cannot adjudicate');
RESET ROLE;

-- RLS must still deny access even if table ACLs are accidentally widened.
GRANT USAGE ON SCHEMA mass_foundation TO mass_test_rls_probe;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA mass_foundation TO mass_test_rls_probe;
SET SESSION AUTHORIZATION mass_test_rls_probe;
SELECT foundation_test.assert_true((SELECT count(*)=0 FROM mass_foundation.source_files),'RLS hides snapshots despite table SELECT');
SELECT foundation_test.assert_true((SELECT count(*)=0 FROM mass_foundation.import_exceptions),'RLS hides exceptions despite table SELECT');
SELECT foundation_test.assert_true((SELECT count(*)=0 FROM mass_foundation.audit_events),'RLS hides audit despite table SELECT');
SELECT foundation_test.expect_error('INSERT INTO mass_foundation.source_files(sha256,storage_ref) VALUES(repeat(''e'',64),gen_random_uuid())','42501','RLS rejects insert despite table INSERT');
SELECT foundation_test.expect_error('INSERT INTO mass_foundation.import_batches(mapping_version,extractor_version) VALUES(''synthetic-v2'',''synthetic-v2'')','42501','RLS rejects batch insert');
WITH denied AS (UPDATE mass_foundation.import_exceptions SET review_state='resolved',resolution_code='excluded' RETURNING id)
 SELECT foundation_test.assert_true((SELECT count(*)=0 FROM denied),'RLS prevents unauthorized exception update');
WITH denied AS (DELETE FROM mass_foundation.audit_events RETURNING id)
 SELECT foundation_test.assert_true((SELECT count(*)=0 FROM denied),'RLS prevents unauthorized audit deletion');
RESET SESSION AUTHORIZATION;
REVOKE ALL ON ALL TABLES IN SCHEMA mass_foundation FROM mass_test_rls_probe;
REVOKE USAGE ON SCHEMA mass_foundation FROM mass_test_rls_probe;
-- Superuser-only probes: immutability and metadata validation as defense in depth.
SELECT foundation_test.expect_error('UPDATE mass_foundation.source_files SET sha256=repeat(''f'',64)','55000','snapshot trigger rejects privileged mutation');
SELECT foundation_test.expect_error('DELETE FROM mass_foundation.source_rows','55000','source row trigger rejects privileged deletion');
SELECT foundation_test.expect_error('UPDATE mass_foundation.audit_events SET operation=''INSERT''','55000','audit trigger rejects privileged update');
SELECT foundation_test.expect_error('TRUNCATE mass_foundation.audit_events','55000','audit trigger rejects privileged truncate');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.audit_events(actor_database_principal,actor_database_role,entity_type,entity_id,operation,change_metadata) VALUES('mass_test_auditor','mass_foundation_auditor','source_files',gen_random_uuid(),'INSERT','{"revision":1,"note":"synthetic-forbidden-field"}')$q$,'23514','audit arbitrary metadata rejected');
SELECT foundation_test.assert_true((SELECT count(*)=11 FROM mass_foundation.audit_events),'security probes leave audit fixture unchanged');
-- No tests create resources outside the disposable database/container.
-- Check every table's ACLs for the usual public API principals, including service.
DO $$
DECLARE principal text; rel record;
BEGIN
 FOREACH principal IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  FOR rel IN SELECT oid,relname FROM pg_class WHERE relnamespace='mass_foundation'::regnamespace AND relkind='r' LOOP
   PERFORM foundation_test.assert_true(
    NOT has_table_privilege(principal,rel.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
    principal || ' has no table privileges on ' || rel.relname);
  END LOOP;
 END LOOP;
END;
$$;
-- A failure to append audit must abort the original write (no unaudited success).
BEGIN;
DROP POLICY audit_events_append ON mass_foundation.audit_events;
SET ROLE mass_foundation_ingestor;
SELECT foundation_test.expect_error('INSERT INTO mass_foundation.source_files(sha256,storage_ref) VALUES(repeat(''e'',64),gen_random_uuid())','42501','audit failure aborts source write');
RESET ROLE;
SELECT foundation_test.assert_true((SELECT count(*)=0 FROM mass_foundation.source_files WHERE sha256=repeat('e',64)),'audit failure leaves no partial source record');
ROLLBACK;
