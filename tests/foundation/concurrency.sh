# Sourced only by tests/foundation/run-local.sh; sql targets its fresh container.
# Independent psql sessions contend on the same unique key and expected revision.
sql -q <<'SQL' &
BEGIN;
SET ROLE mass_foundation_ingestor;
INSERT INTO mass_foundation.source_files(sha256,storage_ref)
 VALUES(repeat('f',64),'90000000-0000-4000-8000-000000000002') ON CONFLICT(sha256) DO NOTHING;
SELECT pg_sleep(1);
COMMIT;
SQL
first_pid=$!
sql -q <<'SQL'
BEGIN;
SET ROLE mass_foundation_ingestor;
INSERT INTO mass_foundation.source_files(sha256,storage_ref)
 VALUES(repeat('f',64),'90000000-0000-4000-8000-000000000003') ON CONFLICT(sha256) DO NOTHING;
COMMIT;
SQL
wait "$first_pid"
sql -q <<'SQL'
SELECT foundation_test.assert_true((SELECT count(*)=1 FROM mass_foundation.source_files WHERE sha256=repeat('f',64)), 'concurrent retry retains one snapshot');
SELECT foundation_test.assert_true((SELECT count(*)=1 FROM mass_foundation.audit_events WHERE entity_type='source_files' AND entity_id IN (SELECT id FROM mass_foundation.source_files WHERE sha256=repeat('f',64))), 'concurrent retry retains one audit insert');
SET ROLE mass_foundation_ingestor;
INSERT INTO mass_foundation.import_batches(id,mapping_version,extractor_version)
 VALUES('30000000-0000-4000-8000-000000000002','synthetic-v1','synthetic-v1');
SQL
sql -q <<'SQL' &
BEGIN;
SET ROLE mass_foundation_ingestor;
UPDATE mass_foundation.import_batches SET state='validated' WHERE id='30000000-0000-4000-8000-000000000002' AND row_version=1;
SELECT pg_sleep(1);
COMMIT;
SQL
first_pid=$!
sql -q <<'SQL'
BEGIN;
SET ROLE mass_foundation_ingestor;
UPDATE mass_foundation.import_batches SET state='validated' WHERE id='30000000-0000-4000-8000-000000000002' AND row_version=1;
COMMIT;
SQL
wait "$first_pid"
sql -q <<'SQL'
SELECT foundation_test.assert_true((SELECT row_version=2 AND state='validated' FROM mass_foundation.import_batches WHERE id='30000000-0000-4000-8000-000000000002'), 'concurrent stale update commits one revision');
SELECT foundation_test.assert_true((SELECT count(*)=1 FROM mass_foundation.audit_events WHERE entity_id='30000000-0000-4000-8000-000000000002' AND operation='UPDATE'), 'concurrent stale update records one audit event');
SQL
