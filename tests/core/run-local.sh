#!/usr/bin/env bash
set -euo pipefail
# Accepts no DB URL/project: always new synthetic database, no host data mounts.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
image="${MASS_TEST_POSTGRES_IMAGE:-postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe}"
container="mass-core-test-$$-${RANDOM}"
rest="${container}-api"
client="${container}-client"
network="${container}-net"
cleanup() { docker rm -fv "$client" "$rest" "$container" >/dev/null 2>&1 || true; docker network rm "$network" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker network create --internal "$network" >/dev/null
docker run --detach --name "$container" --network "$network" \
 --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 --label mass.purpose=synthetic-core-test \
 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=mass_core_synthetic "$image" >/dev/null
for ((attempt=0;attempt<60;attempt++)); do
 if docker exec "$container" pg_isready -U postgres -d mass_core_synthetic >/dev/null 2>&1; then break; fi
 if ((attempt==59)); then echo 'Local DB startup failed' >&2;exit 1;fi
 sleep 1
done
sql() { docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d mass_core_synthetic "$@"; }
sql -Atc 'SELECT version();'
sql -q < "$repo_root/tests/core/bootstrap.sql"
for migration in "$repo_root"/supabase/migrations/*.sql; do
 # Historical 001–016 acceptance; 017 has tests/directory/run-local.sh.
 [[ "$(basename "$migration")" > 202610280016_frontend_reads.sql ]] && continue
 echo "Applying locally: $(basename "$migration")"
 sql -q < "$migration"
done
sql < "$repo_root/tests/core/synthetic.sql"
source "$repo_root/tests/core/concurrency.sh"
if [[ "${MASS_TEST_REST:-0}" == 1 ]]; then
 # Ephemeral signing secret is process-local; never written to fixtures/config/logs.
 rest_secret="$(python -c 'import secrets; print(secrets.token_hex(32))')"
 docker run --detach --name "$rest" --network "$network" \
  -e PGRST_DB_URI="postgresql://mass_test_authenticator@${container}/mass_core_synthetic" \
  -e PGRST_DB_SCHEMAS=mass_api -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$rest_secret" postgrest/postgrest:v13.0.7@sha256:0a46780309a604cdc8b56c776c6e5e15788ce58174d709e40459ab5a2d44d228 >/dev/null
 if ! docker run --rm --name "$client" -i --network "$network" \
  -e MASS_TEST_API_ADDRESS="${rest}:3000" -e MASS_TEST_JWT_SECRET="$rest_secret" \
  python:3.12-alpine@sha256:5789aa194f757888f41fa3d48e14b6feaa1b57c0af0b56fcb1372d6474d3bff0 python - < "$repo_root/tests/core/api.py"; then
  docker logs "$rest" >&2; exit 1
 fi
 sql -q <<'SQL'
SELECT core_test.assert_true((SELECT count(*)>0 FROM mass_foundation.audit_events WHERE actor_database_principal='mass_test_authenticator' AND actor_database_role='authenticated' AND actor_user_id='00000000-0000-4000-8000-000000000001' AND entity_type='core.attendance_records'),'signed API writes carry Auth UID and authenticator provenance');
SQL
 unset rest_secret
fi
echo 'PASS: isolated core database suite.'
