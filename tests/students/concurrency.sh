# Sourced by run-local.sh; synthetic database and local container only.
register(){
 local who="$1" centre="$2"
 docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_test_authenticator -d postgres <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"$who"}',true);
SELECT * FROM mass_api.register_student('$centre','9','Morning','2026-04-01','Synthetic concurrency learner','Girl');
SELECT pg_sleep(1);
COMMIT;
SQL
}
register 00000000-0000-4000-8000-000000000001 10000000-0000-4000-8000-000000000001 > "$private/concurrent-a.log" 2>&1 & a=$!
register 00000000-0000-4000-8000-000000000002 10000000-0000-4000-8000-000000000002 > "$private/concurrent-b.log" 2>&1 & b=$!
wait "$a";wait "$b"
sql <<'SQL'
SELECT core_test.assert_true((SELECT array_agg(student_id ORDER BY student_id)=ARRAY['ST_SY_9_01','ST_SY_9_02'] FROM mass_core.children WHERE student_id LIKE 'ST_SY_9_%'),'concurrent registrations in different centres share one prefix/class sequence');
SQL
episode="$(sql -Atqc "SELECT e.id FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id WHERE c.student_id LIKE 'ST_SY_9_%' AND e.centre_id='10000000-0000-4000-8000-000000000001'")"
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_student_deployer -d postgres > "$private/import-race.log" 2>&1 <<SQL &
BEGIN;
GRANT mass_data_importer TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE mass_data_importer;
INSERT INTO mass_core.attendance_records(child_id,enrolment_id,centre_id,shift_code,attendance_date,code)
 SELECT child_id,id,centre_id,shift_code,'2026-11-01','P' FROM mass_core.enrolments WHERE id='$episode';
SELECT pg_sleep(2);
RESET ROLE;
REVOKE SET OPTION FOR mass_data_importer FROM CURRENT_USER;
COMMIT;
SQL
fact=$!
# Wait until the administrative transaction actually holds the enrolment lock.
for ((n=0;n<50;n++));do
 if [[ "$(sql -Atqc "SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a USING(pid) WHERE l.locktype='advisory' AND l.granted AND a.usename='mass_student_deployer')")" == t ]];then break;fi
 sleep 0.1
done
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_test_authenticator -d postgres > "$private/closure-race.log" 2>&1 <<SQL && { echo 'Concurrent invalid closure unexpectedly passed';exit 1; }
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT mass_api.close_enrolment('$episode',1,'2026-10-01','Left programme');
COMMIT;
SQL
wait "$fact"
rg -q 'closure would invalidate recorded history' "$private/closure-race.log"
sql -Atqc "SELECT core_test.assert_true((SELECT ends_before IS NULL FROM mass_core.enrolments WHERE id='$episode'),'administrative fact and runtime closure serialize without authorization bypass');"
echo 'PASS: non-superuser concurrent shared IDs and administrative fact/runtime closure integrity.'
