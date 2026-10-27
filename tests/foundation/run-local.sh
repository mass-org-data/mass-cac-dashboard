#!/usr/bin/env bash
set -euo pipefail
# No DATABASE_URL, Supabase link, TCP port, mount, or existing database accepted.
# All SQL goes via stdin to a newly created, disposable, network-isolated container.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
image="${MASS_TEST_POSTGRES_IMAGE:-postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe}"
container="mass-foundation-test-$$-${RANDOM}"
cleanup() { docker rm -fv "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
# Trust applies only to the disposable container's Unix socket; no host ports/network.
docker run --detach --name "$container" --network none \
  --label mass.purpose=synthetic-foundation-test \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=mass_foundation_synthetic \
  "$image" >/dev/null
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$container" pg_isready -U postgres -d mass_foundation_synthetic >/dev/null 2>&1; then break; fi
  if ((attempt==59)); then echo 'Local PostgreSQL startup failed.' >&2; exit 1; fi
  sleep 1
done
sql() { docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d mass_foundation_synthetic "$@"; }
echo 'Target: new isolated PostgreSQL container; no network, host mounts or published ports.'
sql -Atc 'SELECT version();'
# Supabase-like roles ONLY inside this synthetic database, not real Auth/resources.
sql < "$repo_root/tests/foundation/bootstrap.sql"
for migration in "$repo_root"/supabase/migrations/*.sql; do
  echo "Applying locally: $(basename "$migration")"
  sql -q < "$migration"
done
sql < "$repo_root/tests/foundation/synthetic.sql"
sql < "$repo_root/tests/foundation/security.sql"
source "$repo_root/tests/foundation/concurrency.sh"
echo 'PASS: local foundation migration and synthetic security suite.'
