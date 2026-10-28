#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
container="mass-frontend-read-test-${RANDOM}-$$"
rest="${container}-api"
client="${container}-client"
network="${container}-net"
sdk_bundle="$(mktemp /tmp/mass-frontend-sdk.XXXXXX.mjs)"
cleanup(){ docker rm -fv "$client" "$rest" "$container" >/dev/null 2>&1 || true;docker network rm "$network" >/dev/null 2>&1 || true;rm -f -- "$sdk_bundle" "${sdk_bundle}.failure"; }
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
for migration in "$repo_root"/supabase/migrations/20261027*.sql;do sql -q < "$migration";done
# Preflight is read-only and expects the existing 15-version baseline.
sql -q < "$repo_root/supabase/compatibility/016-preflight.sql"
sql -q < "$repo_root/tests/core/synthetic.sql"
# Freeze original policy definitions before additive 016; inject a failure to prove
# transaction rollback retains baseline objects/ACLs, then retry the exact file.
policy_snapshot(){ sql -Atqc "SELECT jsonb_agg(jsonb_build_object('table',polrelid::regclass::text,'name',polname,'cmd',polcmd,'permissive',polpermissive,'roles',polroles::text,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polrelid::regclass::text,polname) FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace)) AND polname<>'self_scope_discovery'"; }
baseline_policies="$(policy_snapshot)"
python - "$repo_root/supabase/migrations/202610280016_frontend_reads.sql" <<'PYTEST' | sql -q > "${sdk_bundle}.failure" 2>&1 && { echo 'Injected 016 failure unexpectedly committed';exit 1; }
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text();assert s.count('COMMIT;')==1
print(s.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
PYTEST
rg -q 'division by zero' "${sdk_bundle}.failure"
[[ "$(sql -Atqc "SELECT to_regprocedure('mass_api.get_context()') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_policy WHERE polname='self_scope_discovery') AND NOT has_any_column_privilege('authenticated','mass_core.user_scope_grants','SELECT')")" == t ]]
[[ "$(policy_snapshot)" == "$baseline_policies" ]]
echo 'PASS: injected 016 failure rolls back functions/policy/column grants; all 71 baseline policy definitions intact.'
sql -q < "$repo_root/supabase/migrations/202610280016_frontend_reads.sql"
[[ "$(policy_snapshot)" == "$baseline_policies" ]]
echo 'PASS: exact 016 retry succeeds; all 71 baseline policy definitions unchanged.'
sql -q < "$repo_root/tests/frontend/reads.sql"
sql -q < "$repo_root/supabase/compatibility/016-postflight.sql"
sql -q < "$repo_root/supabase/compatibility/017-preflight.sql"
baseline_policies="$(policy_snapshot)"
# Snapshot existing function metadata too; new RPCs must not replace any of twenty.
original_api="$(sql -Atqc "SELECT jsonb_agg(pg_get_functiondef(oid) ORDER BY oid) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace")"
# Test 017 with no superuser, BYPASSRLS, CREATEROLE or Auth delegation.
sql -q <<'ROLE'
CREATE ROLE mass_directory_migrator LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOINHERIT;
GRANT mass_foundation_owner,mass_core_owner TO mass_directory_migrator WITH SET TRUE, INHERIT FALSE;
ROLE
migrate017(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_directory_migrator -d postgres; }
python - "$repo_root/supabase/migrations/202610280017_donor_staff_directory.sql" <<'PYTEST' | migrate017 > "${sdk_bundle}.failure" 2>&1 && { echo 'Injected 017 failure unexpectedly committed';exit 1; }
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text();assert s.count('COMMIT;')==1
print(s.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
PYTEST
rg -q 'division by zero' "${sdk_bundle}.failure"
[[ "$(sql -Atqc "SELECT to_regclass('mass_core.donors') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='mass_core.centres'::regclass AND attname='donor_id') AND NOT has_column_privilege('mass_core_owner','mass_foundation.source_rows','id','REFERENCES')")" == t ]]
echo 'PASS: 017 injected failure rolls back tables, column/trigger changes and provenance grant.'
# Provider-style inherited grants must fail installation, not expose new tables.
sql -q -c 'GRANT authenticated TO service_role;'
if migrate017 < "$repo_root/supabase/migrations/202610280017_donor_staff_directory.sql" > "${sdk_bundle}.failure" 2>&1;then
 echo 'Inherited directory privilege gate unexpectedly passed';exit 1
fi
rg -q 'unexpected inherited directory privileges' "${sdk_bundle}.failure"
sql -q -c 'REVOKE authenticated FROM service_role;'
[[ "$(sql -Atqc "SELECT to_regclass('mass_core.donors') IS NULL")" == t ]]
echo 'PASS: inherited service-role table rights fail closed and roll back 017.'
migrate017 < "$repo_root/supabase/migrations/202610280017_donor_staff_directory.sql"
# New policies live only on the three new relations.
[[ "$(sql -Atqc "SELECT jsonb_agg(jsonb_build_object('table',polrelid::regclass::text,'name',polname,'cmd',polcmd,'permissive',polpermissive,'roles',polroles::text,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polrelid::regclass::text,polname) FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relname NOT IN ('donors','staff_members','centre_staff_assignments')) AND polname<>'self_scope_discovery'")" == "$baseline_policies" ]]
[[ "$(sql -Atqc "SELECT jsonb_agg(pg_get_functiondef(oid) ORDER BY oid) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND proname NOT IN ('get_centre_directory','get_centre_staff')")" == "$original_api" ]]
sql -q < "$repo_root/tests/directory/synthetic.sql"
sql -q < "$repo_root/supabase/compatibility/017-postflight.sql"
echo 'PASS: 017 non-superuser/no-Auth-delegation retry succeeds; existing API definitions and original policy definitions unchanged.'
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
 -e MASS_DIRECTORY_TEST=1 -e MASS_FRONTEND_TEST_API="http://${rest}:3000" -e MASS_FRONTEND_TEST_SECRET="$rest_secret" \
 node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 \
 node --input-type=module - < "$sdk_bundle"
unset rest_secret
echo 'PASS: isolated migration 017 and baseline 016, bounded reads, role discovery, masking, centre isolation and revocation.'
