#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
container="mass-frontend-read-test-${RANDOM}-$$"
rest="${container}-api"
client="${container}-client"
network="${container}-net"
sdk_bundle="$(mktemp /tmp/mass-frontend-sdk.XXXXXX.mjs)"
cleanup(){ docker rm -fv "$client" "$rest" "$container" >/dev/null 2>&1 || true;docker network rm "$network" >/dev/null 2>&1 || true;rm -f -- "$sdk_bundle"; }
trap cleanup EXIT INT TERM
docker network create --internal "$network" >/dev/null
docker run -d --name "$container" --network "$network" \
 --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 -e POSTGRES_HOST_AUTH_METHOD=trust \
 postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((attempt=0;attempt<60;attempt++));do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi
 if ((attempt==59));then echo 'Isolated read-API test DB failed to start' >&2;exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
sql -q < "$repo_root/tests/core/bootstrap.sql"
for migration in "$repo_root"/supabase/migrations/*.sql;do sql -q < "$migration";done
sql -q < "$repo_root/tests/core/synthetic.sql"
# Proposal intentionally outside automatic migration discovery and production manifests.
sql -q < "$repo_root/supabase/proposals/202610280016_frontend_reads.sql"
sql -q < "$repo_root/tests/frontend/reads.sql"
sql -q < "$repo_root/supabase/proposals/016-postflight.sql"
rest_secret="$(python -c 'import secrets; print(secrets.token_hex(32))')"
docker run -d --name "$rest" --network "$network" \
 -e PGRST_DB_URI="postgresql://mass_test_authenticator@${container}/postgres" \
 -e PGRST_DB_SCHEMAS=mass_api -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$rest_secret" \
 postgrest/postgrest:v13.0.7@sha256:0a46780309a604cdc8b56c776c6e5e15788ce58174d709e40459ab5a2d44d228 >/dev/null
node --input-type=module - "$repo_root" "$sdk_bundle" <<'JS'
import {build} from 'esbuild';
import path from 'node:path';
await build({entryPoints:[path.join(process.argv[2],'tests/frontend/api-integration.mjs')],outfile:process.argv[3],bundle:true,platform:'node',format:'esm',target:'node24',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
JS
# No host ports or mounts. The SDK client runs on the same internal test network.
docker run --rm -i --name "$client" --network "$network" \
 -e MASS_FRONTEND_TEST_API="http://${rest}:3000" -e MASS_FRONTEND_TEST_SECRET="$rest_secret" \
 node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 \
 node --input-type=module - < "$sdk_bundle"
unset rest_secret
echo 'PASS: isolated proposal 016, bounded reads, role discovery, masking, centre isolation and revocation.'
