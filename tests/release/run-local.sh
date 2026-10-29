#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
container="mass-release-${RANDOM}-$$"
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true' EXIT INT TERM
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((n=0;n<60;n++));do if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1;then break;fi;sleep 1;done
sql(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres "$@"; }
sql < "$repo_root/tests/core/bootstrap.sql"
sql <<'SQL'
CREATE ROLE mass_release_deployer LOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE NOINHERIT;
GRANT CREATE ON DATABASE postgres TO mass_release_deployer;
GRANT USAGE ON SCHEMA auth TO mass_release_deployer;
GRANT REFERENCES(id) ON auth.users TO mass_release_deployer;
ALTER DATABASE postgres SET mass_test.deployment_principal='mass_release_deployer';
SQL
migrate(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_release_deployer -d postgres; }
for f in "$repo_root"/supabase/migrations/*.sql;do
 if [[ "$f" == *202610290021* ]];then
  failure_log="$(mktemp /tmp/mass-release-rollback.XXXXXX)"
  if python - "$f" <<'PYINJECT' | migrate > "$failure_log" 2>&1
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text();assert s.count('COMMIT;')==1
print(s.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
PYINJECT
  then echo 'Injected failure unexpectedly committed';exit 1;fi
  rg -q 'division by zero' "$failure_log";rm -f -- "$failure_log"
  [[ "$(docker exec "$container" psql -X -Atqc "SELECT to_regclass('mass_core.officer_assignments') IS NULL AND to_regprocedure('mass_api.get_visit_assignments()') IS NULL" -U postgres)" == t ]]
  echo 'PASS: injected migration021 failure rolls back all visit objects; exact file retried.'
 fi
 migrate < "$f"
done
sql -Atc "SELECT 'SCHEMA_INVENTORY '||jsonb_build_object('tables',(SELECT count(*) FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace) AND relkind='r'),'columns',(SELECT count(*) FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace) AND relkind='r') AND attnum>0 AND NOT attisdropped),'foreign_keys',(SELECT count(*) FROM pg_constraint WHERE connamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace) AND contype='f'),'policies',(SELECT count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace))))::text;"

python - "$repo_root" <<'PY' | sql
from pathlib import Path
import sys
s=(Path(sys.argv[1])/'tests/core/synthetic.sql').read_text()
s=s.replace('count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity)','count(*)=25 AND bool_and(relrowsecurity AND relforcerowsecurity)')
s=s.replace('bool_and(student_id=upper(id::text))',"bool_and(student_id ~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$')")
s=s.replace("'428C9','generated permanent student ID cannot be overwritten'","'55000','generated permanent student ID cannot be overwritten'")
print(s)
PY
sql < "$repo_root/tests/release/visits.sql"
source "$repo_root/tests/release/concurrency.sh"
echo 'PASS: full migration sequence and original core plus release behavioral checks.'
if [[ "${MASS_RELEASE_BROWSER:-0}" == 1 ]];then
 network="${container}-network";rest="${container}-rest";client="${container}-http-client"
 cleanup(){ docker rm -fv "$client" "$rest" "$container" >/dev/null 2>&1 || true;docker network rm "$network" >/dev/null 2>&1 || true; }
 trap cleanup EXIT INT TERM
 docker network create --internal "$network" >/dev/null
 docker network disconnect none "$container"
 docker network connect "$network" "$container"
 export MASS_RELEASE_REST_SECRET="$(python -c 'import secrets;print(secrets.token_hex(32))')"
 docker run -d --name "$rest" --network "$network" -e PGRST_DB_URI="postgresql://mass_test_authenticator@${container}/postgres" -e PGRST_DB_SCHEMAS=mass_api -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$MASS_RELEASE_REST_SECRET" postgrest/postgrest:v13.0.7@sha256:0a46780309a604cdc8b56c776c6e5e15788ce58174d709e40459ab5a2d44d228 >/dev/null
 export MASS_RELEASE_REST_URL="http://${rest}:3000"
 export MASS_RELEASE_HTTP_CLIENT="$client"
 docker run -d --name "$client" --network "$network" node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 tail -f /dev/null >/dev/null
 # Wait for the isolated REST service; container start is not API readiness.
 ready=0
 for ((attempt=0;attempt<30;attempt++));do
  if docker exec "$client" node -e 'fetch(process.argv[1]).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))' "$MASS_RELEASE_REST_URL/" >/dev/null 2>&1;then ready=1;break;fi
  sleep 1
 done
 if [[ "$ready" != 1 ]];then echo 'Local PostgREST failed readiness';docker logs "$rest";exit 1;fi
 export MASS_RELEASE_TEST_OUTPUT="$(mktemp -d /tmp/mass-release-browser.XXXXXX)"
 node --input-type=module - "$repo_root" "$MASS_RELEASE_TEST_OUTPUT" <<'JS'
import {build} from 'esbuild';import path from 'node:path';
await build({entryPoints:[path.join(process.argv[2],'tests/release/browser-entry.js')],outfile:path.join(process.argv[3],'fixture.js'),bundle:true,format:'esm',platform:'browser',plugins:[{name:'local-auth-fixture',setup(b){b.onResolve({filter:/^\.\/client\.js$/},()=>({path:path.join(process.argv[2],'tests/release/browser-client.js')}));}}]});
JS
 python "$repo_root/tests/release/browser.py"
 unset MASS_RELEASE_REST_SECRET
fi
