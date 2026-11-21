#!/usr/bin/env bash
# Native PostgreSQL test with independent transactions and synthetic users only.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
container="mass-phase7-${RANDOM}-$$"
scratch="$(mktemp -d /tmp/mass-phase7-concurrency.XXXXXX)"
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true; rm -rf -- "$scratch"' EXIT
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sql() { docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres "$@"; }
sql < tests/core/bootstrap.sql
for migration in supabase/migrations/*.sql; do sql < "$migration"; done
sql <<'SQL'
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
SET ROLE mass_core_owner;
INSERT INTO mass_core.centres(id,label) VALUES
 ('10000000-0000-4000-8000-000000000001','Synthetic one'),('10000000-0000-4000-8000-000000000002','Synthetic two');
INSERT INTO mass_core.application_users(user_id,role_code,status,starts_at,approval_reference,approved_by,approved_at)
SELECT id,role,'Active',now(),'Synthetic concurrency','00000000-0000-4000-8000-000000000001',now()
FROM (VALUES
 ('00000000-0000-4000-8000-000000000001'::uuid,'Leadership'),
 ('00000000-0000-4000-8000-000000000002'::uuid,'Leadership'),
 ('00000000-0000-4000-8000-000000000003'::uuid,'Teacher')
) subjects(id,role);
SQL

run_overlap() {
  local first="$1" second="$2" expected="$3" pid seen=false
  sql > "$scratch/first.log" 2>&1 <<< "BEGIN; SET LOCAL ROLE mass_user_admin_bridge; $first; SELECT pg_sleep(2); COMMIT;" &
  pid=$!
  for ((attempt=0; attempt<20; attempt++)); do
    if [[ "$(sql -Atc "SELECT EXISTS(SELECT FROM pg_locks WHERE locktype='advisory' AND classid=1935181321 AND objid=7 AND granted)")" == t ]]; then
      seen=true
      break
    fi
    sleep 0.05
  done
  "$seen"
  if sql > "$scratch/second.log" 2>&1 <<SQL
\set VERBOSITY verbose
SET ROLE mass_user_admin_bridge;
$second;
SQL
  then
    wait "$pid"
    echo 'Conflicting second transaction unexpectedly completed.' >&2
    return 1
  fi
  wait "$pid"
  rg -q "ERROR:  $expected:" "$scratch/second.log"
}

run_overlap \
 "SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','assign','{\"subject\":\"00000000-0000-4000-8000-000000000003\",\"centre\":\"10000000-0000-4000-8000-000000000001\",\"version\":1}')" \
 "SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002','assign','{\"subject\":\"00000000-0000-4000-8000-000000000003\",\"centre\":\"10000000-0000-4000-8000-000000000002\",\"version\":2}')" \
 23514
run_overlap \
 "SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003','role','{\"subject\":\"00000000-0000-4000-8000-000000000002\",\"role\":\"Cluster Officer\",\"version\":1}')" \
 "SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000004','role','{\"subject\":\"00000000-0000-4000-8000-000000000001\",\"role\":\"Teacher\",\"version\":1}')" \
 42501
sql -Atc "SELECT core_test.assert_true(
 (SELECT count(*)=1 FROM mass_core.user_centre_assignments WHERE status='Active')
 AND (SELECT count(*)=1 FROM mass_core.application_users WHERE status='Active' AND role_code='Leadership'),
 'concurrent requests preserve one active Teacher centre and at least one active Leadership actor')"
echo 'PASS concurrent Teacher assignments and competing Leadership demotions.'
