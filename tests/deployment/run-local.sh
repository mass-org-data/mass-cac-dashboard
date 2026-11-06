#!/usr/bin/env bash
set -euo pipefail
# Validation queries only against a new synthetic container. No external DB accepted.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
validation_work="$(mktemp -d /tmp/mass-deployment-check.XXXXXX)"
container="mass-deployment-check-${RANDOM}-$$"
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true;rm -rf -- "$validation_work"; }
trap cleanup EXIT INT TERM
docker run -d --name "$container" --network none \
 --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 -e POSTGRES_HOST_AUTH_METHOD=trust \
 postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((attempt=0;attempt<60;attempt++));do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi
 if ((attempt==59));then echo 'Local validation database startup failed' >&2;exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
# The test-only managed Auth stub is never a hosted migration.
sql -q < "$repo_root/tests/core/bootstrap.sql"
# Exercise the pre-install branch of the psql report with no ledger or MASS objects.
docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$container" \
 psql -X -qAt -v ON_ERROR_STOP=1 -U postgres \
 < "$repo_root/supabase/compatibility/production-preflight.sql" > "$validation_work/before.txt"
for migration in "$repo_root"/supabase/migrations/*.sql;do
 # Historical 001–016 acceptance; 017 has tests/directory/run-local.sh.
 [[ "$(basename "$migration")" > 202610280016_frontend_reads.sql ]] && continue
 if [[ "$(basename "$migration")" == 202610270008_identity_history.sql ]];then
  # Fail only a temporary copy inside the file's transaction. Earlier files stay
  # committed; this failed file's objects disappear on session termination.
  python - "$migration" "$validation_work/failing.sql" <<'PY'
import sys
from pathlib import Path
source=Path(sys.argv[1]).read_text()
assert source.count('COMMIT;')==1
Path(sys.argv[2]).write_text(source.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
PY
  if sql -q < "$validation_work/failing.sql" > "$validation_work/failure.txt" 2>&1;then
   echo 'Failure injection unexpectedly succeeded' >&2;exit 1
  fi
  [[ "$(sql -Atqc "SELECT to_regclass('mass_core.children') IS NULL AND to_regclass('mass_core.centres') IS NOT NULL")" == t ]]
  echo 'PASS: failed-file transaction rolls back; earlier migration remains; corrected retry follows.'
 fi
 sql -q < "$migration"
done
for report in preflight production-preflight postflight;do
 docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$container" \
  psql -X -qAt -v ON_ERROR_STOP=1 -U postgres \
  < "$repo_root/supabase/compatibility/${report}.sql" > "$validation_work/${report}.txt"
done
# Backup/recovery rehearsal uses only this empty synthetic local database.
docker exec "$container" pg_dump -U postgres --format=custom postgres > "$validation_work/database.dump"
docker exec "$container" pg_dumpall -U postgres --roles-only --no-role-passwords > "$validation_work/roles.sql"
docker exec -i "$container" pg_restore --list < "$validation_work/database.dump" > "$validation_work/archive.list"
docker exec "$container" createdb -U postgres mass_restore
# Same isolated cluster already has the roles; global role replay is deliberately
# not tested or authorized. Provider role reconciliation remains a manual gate.
docker exec -i "$container" pg_restore -U postgres --exit-on-error --dbname=mass_restore < "$validation_work/database.dump"
docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$container" \
 psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d mass_restore \
 < "$repo_root/supabase/compatibility/postflight.sql" > "$validation_work/restored.txt"
cmp "$validation_work/postflight.txt" "$validation_work/restored.txt"
echo 'PASS: synthetic custom archive restored; postflight identical; provider role replay remains untested.'
python - "$validation_work/postflight.txt" "$repo_root/docs/DATABASE-SCHEMA-INVENTORY.json" <<'PY'
import sys,json
from pathlib import Path
rows=[line.split('|') for line in Path(sys.argv[1]).read_text().splitlines()]
checks=[r for r in rows if len(r)==4 and r[1].isdigit() and r[2].isdigit() and r[3] in ('t','f')]
assert len(checks)==15,checks
assert all(r[3]=='t' for r in checks),checks
assert ['managed_auth_invoker_wrapper','t'] in rows, 'Managed Auth invoker binding missing'
assert not any(r[-1] in ('table_or_column_access','unexpected_function_execute','unexpected_schema_usage') for r in rows), 'Unexpected effective ACL'
definers={(f['schema'],f['name']):f for f in json.loads(Path(sys.argv[2]).read_text())['functions'] if f['security_definer']}
matrix=[r for r in rows if len(r)==6 and r[0] in ('mass_foundation','mass_core','mass_api')]
assert len(definers)==19 and len(matrix)==19*9, 'Incomplete definer permission matrix'
for r in matrix:
    name=r[1].split('(')[0].split('.')[-1]
    definition=definers[r[0],name]
    expected=r[3]==r[2] or r[3]=='authenticated' and 'authenticated=X/' in definition['acl']
    assert (r[4]=='t')==expected, 'Unexpected effective definer execute privilege'
counts=[r for r in rows if len(r)==2 and r[1].isdigit()]
assert len(counts)==22 and all(r[1]=='0' for r in counts), 'All 22 non-reference tables must be empty'
assert sorted(r for r in rows if len(r)==2 and r[0] in ('A','P','L','WO','MM'))==[
 ['A','Absent'],['L','Leave'],['MM','Monthly Meeting'],['P','Present'],['WO','Sunday']]
print('PASS: read-only preflight/postflight; 15 invariants, 171 definer/role permissions, all 22 empty-table counts and reference codes.')
PY
