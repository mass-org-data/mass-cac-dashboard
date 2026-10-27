# Independent sessions; no connection string or existing database target accepted.
sql -q <<'SQL'
CREATE FUNCTION core_test.try_edit() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM mass_api.record_attendance(core_test.id('A'),'2026-04-01','A',1);
EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
END;
$$;
SQL
sql -q <<'SQL' &
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.try_edit();
SELECT pg_sleep(1);
COMMIT;
SQL
race_pid=$!
sql -q <<'SQL'
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.try_edit();
COMMIT;
SQL
wait "$race_pid"
sql -q <<'SQL'
SELECT core_test.assert_true((SELECT row_version=2 FROM mass_core.attendance_records WHERE enrolment_id=core_test.id('A') AND attendance_date='2026-04-01'),'concurrent edits create one accepted revision');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_foundation.audit_events WHERE entity_id=(SELECT id FROM mass_core.attendance_records WHERE enrolment_id=core_test.id('A') AND attendance_date='2026-04-01') AND operation='UPDATE'),'concurrent conflict creates no extra audit event');
SQL
