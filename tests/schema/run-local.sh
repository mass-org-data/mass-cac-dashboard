#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
mode="${1:---check}"
if [[ "$mode" != --check && "$mode" != --write ]]; then echo 'Usage: run-local.sh [--check|--write]' >&2;exit 2;fi
schema_work="$(mktemp -d /tmp/mass-schema-check.XXXXXX)"
container="mass-schema-check-${RANDOM}-$$"
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true;rm -rf -- "$schema_work"; }
trap cleanup EXIT INT TERM
# New local database only; no URL, project, host mount, port or real source accepted.
docker run -d --name "$container" --network none \
 --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 -e POSTGRES_HOST_AUTH_METHOD=trust \
 postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((attempt=0;attempt<60;attempt++)); do
 # TCP becomes ready only on final startup, not the temporary initdb server.
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break;fi
 if ((attempt==59)); then echo 'Local schema database startup failed' >&2;exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
# Explicitly test-only managed Auth stand-in; never part of the real migrations.
sql -q < "$repo_root/tests/core/bootstrap.sql"
for migration in "$repo_root"/supabase/migrations/*.sql;do sql -q < "$migration";done
sql -Atq < "$repo_root/tests/schema/catalog.sql" > "$schema_work/catalog.json"
if [[ "$mode" == --check ]];then
 python "$repo_root/tests/schema/render.py" "$schema_work/catalog.json" --check
else
 python "$repo_root/tests/schema/render.py" "$schema_work/catalog.json"
fi
