-- Entire fixture uses constructed technical UUIDs, synthetic fingerprints and counters.
-- No child identity, contacts, source workbook content or external artifact exists.
GRANT mass_foundation_ingestor TO mass_test_ingestor;
GRANT mass_foundation_reviewer TO mass_test_reviewer;
GRANT mass_foundation_auditor TO mass_test_auditor;
BEGIN;
SET SESSION AUTHORIZATION mass_test_ingestor;
SET ROLE mass_foundation_ingestor;
INSERT INTO mass_foundation.source_files(id,sha256,storage_ref,source_version)
 VALUES ('10000000-0000-4000-8000-000000000001',repeat('a',64),'90000000-0000-4000-8000-000000000001','synthetic-v1');
INSERT INTO mass_foundation.source_sheets(id,file_id,ordinal,classification,header_version)
 VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'input',1);
INSERT INTO mass_foundation.import_batches(id,mapping_version,extractor_version)
 VALUES ('30000000-0000-4000-8000-000000000001','synthetic-v1','synthetic-v1');
INSERT INTO mass_foundation.source_rows(id,sheet_id,first_batch_id,row_number,content_hash)
 VALUES ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,repeat('b',64)),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2,repeat('b',64));
INSERT INTO mass_foundation.import_exceptions(id,batch_id,source_row_id,reason_code)
 VALUES ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','conflicting_metadata');
SELECT foundation_test.assert_true((SELECT count(*)=2 FROM mass_foundation.source_rows),'equal fingerprints do not merge row occurrences');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.source_files(sha256,storage_ref) VALUES(repeat('a',64),gen_random_uuid())$q$,'23505','duplicate snapshot rejected');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.source_files(sha256,storage_ref) VALUES('not-a-hash',gen_random_uuid())$q$,'23514','invalid fingerprint rejected');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.source_sheets(file_id,ordinal,header_version) VALUES('10000000-0000-4000-8000-000000000001',1,1)$q$,'23505','sheet occurrence idempotency');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.source_rows(sheet_id,first_batch_id,row_number,content_hash) VALUES('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,repeat('c',64))$q$,'23505','row occurrence idempotency');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.source_rows(sheet_id,first_batch_id,row_number,content_hash) VALUES('20000000-0000-4000-8000-000000000099','30000000-0000-4000-8000-000000000001',3,repeat('c',64))$q$,'23503','missing parent rejected');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.import_exceptions(batch_id,source_row_id,reason_code) VALUES('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','conflicting_metadata')$q$,'23505','NULL field duplicate exception rejected');
SELECT foundation_test.expect_error($q$INSERT INTO mass_foundation.import_exceptions(batch_id,source_row_id,reason_code) VALUES('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','arbitrary_note')$q$,'23514','non-allowlisted exception reason rejected');
SELECT foundation_test.expect_error($q$UPDATE mass_foundation.import_batches SET state='complete'$q$,'23514','cannot skip batch states');
UPDATE mass_foundation.import_batches SET state='validated' WHERE row_version=1;
SELECT foundation_test.assert_true((SELECT row_version=2 FROM mass_foundation.import_batches),'batch revision server-managed');
WITH stale AS (UPDATE mass_foundation.import_batches SET state='approved' WHERE row_version=1 RETURNING id)
 SELECT foundation_test.assert_true((SELECT count(*)=0 FROM stale),'stale expected revision changes nothing');
UPDATE mass_foundation.import_batches SET state='approved' WHERE row_version=2;
UPDATE mass_foundation.import_batches SET state='running',extracted_count=2,checkpoint_position=1 WHERE row_version=3;
SELECT foundation_test.expect_error($q$UPDATE mass_foundation.import_batches SET checkpoint_position=0$q$,'23514','checkpoint regression rejected');
SELECT foundation_test.expect_error($q$UPDATE mass_foundation.import_batches SET state='complete',accepted_count=1$q$,'23514','incomplete reconciliation cannot complete');
SELECT foundation_test.expect_error($q$UPDATE mass_foundation.import_batches SET accepted_count=-1$q$,'23514','negative counts rejected');
UPDATE mass_foundation.import_batches SET state='complete',accepted_count=1,quarantined_count=1,checkpoint_position=2 WHERE row_version=4;
SELECT foundation_test.assert_true((SELECT row_version=5 AND started_at IS NOT NULL AND completed_at>=started_at FROM mass_foundation.import_batches),'completed batch retains timing and reconciliation');
SELECT foundation_test.expect_error($q$UPDATE mass_foundation.import_batches SET state='running'$q$,'23514','terminal batch cannot reopen');
RESET ROLE;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION mass_test_reviewer;
SET ROLE mass_foundation_reviewer;
UPDATE mass_foundation.import_exceptions SET review_state='resolved',resolution_code='excluded' WHERE row_version=1;
SELECT foundation_test.assert_true((SELECT resolved_by='mass_test_reviewer' AND resolved_at IS NOT NULL AND row_version=2 FROM mass_foundation.import_exceptions),'review actor and revision derived by server');
SELECT foundation_test.expect_error($q$UPDATE mass_foundation.import_exceptions SET review_state='rejected',resolution_code='not_an_issue'$q$,'23514','terminal exception cannot be overwritten');
RESET ROLE;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION mass_test_auditor;
SET ROLE mass_foundation_auditor;
SELECT foundation_test.assert_true((SELECT count(*)=11 FROM mass_foundation.audit_events),'every successful write audited; rejected/stale writes not audited');
SELECT foundation_test.assert_true((SELECT count(*)=6 FROM mass_foundation.audit_events WHERE operation='INSERT'),'all initial inserts audited');
SELECT foundation_test.assert_true((SELECT bool_and(change_metadata - 'revision'='{}'::jsonb) FROM mass_foundation.audit_events),'audit metadata contains revision only');
SELECT foundation_test.assert_true((SELECT count(*)=1 FROM mass_foundation.audit_events WHERE entity_type='import_exceptions' AND operation='UPDATE' AND actor_database_principal='mass_test_reviewer' AND actor_database_role='mass_foundation_reviewer'),'audit records actual database principal and active role');
RESET ROLE;
RESET SESSION AUTHORIZATION;
COMMIT;
-- Transactional rollback must roll back both data and its audit entry.
BEGIN;
SET SESSION AUTHORIZATION mass_test_ingestor;
SET ROLE mass_foundation_ingestor;
INSERT INTO mass_foundation.source_files(sha256,storage_ref) VALUES(repeat('d',64),gen_random_uuid());
RESET ROLE;
RESET SESSION AUTHORIZATION;
ROLLBACK;
SELECT foundation_test.assert_true((SELECT count(*)=11 FROM mass_foundation.audit_events),'rolled-back write leaves no orphan audit');
