# Sourced only by the ephemeral local PostgreSQL runner.
concurrent_dir="$(mktemp -d /tmp/mass-visit-concurrency.XXXXXX)"
visit_edit(){
 docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -U postgres <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',false);
SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000001','Morning','2026-10-01','Completed','Synthetic concurrent correction','',2,'Synthetic concurrency reason');
SQL
}
visit_edit > "$concurrent_dir/a" 2>&1 & visit_a=$!
visit_edit > "$concurrent_dir/b" 2>&1 & visit_b=$!
wait "$visit_a" && visit_a_result=0 || visit_a_result=$?
wait "$visit_b" && visit_b_result=0 || visit_b_result=$?
if [[ "$visit_a_result" == 0 && "$visit_b_result" != 0 ]];then rg -q PT409 "$concurrent_dir/b";
elif [[ "$visit_b_result" == 0 && "$visit_a_result" != 0 ]];then rg -q PT409 "$concurrent_dir/a";
else echo 'Concurrent visit edits did not produce one success and one conflict';exit 1;fi
rm -rf -- "$concurrent_dir"
echo 'PASS: concurrent same-version visit edits produce one success and one PT409; no lost update.'
