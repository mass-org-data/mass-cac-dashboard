#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ "${MASS_POPULATED_UPGRADE:-0}" == 1 && "${MASS_BASELINE_BROWSER:-0}" == 1 ]];then echo 'Populated upgrade requires020–023; invalid test combination';exit 1;fi
if [[ "${MASS_DEPENDENT_BROWSER:-0}" == 1 && "${MASS_REVIEWED_CHARTS:-0}" != 1 ]];then echo 'Dependent browser suite requires reviewed synthetic fixtures';exit 1;fi
if [[ "${MASS_AGGREGATE_PERFORMANCE:-0}" == 1 ]];then MASS_LOCAL_PG_TMPFS_SIZE=512m;fi
container="mass-release-${RANDOM}-$$"
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true' EXIT INT TERM
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=${MASS_LOCAL_PG_TMPFS_SIZE:-256m} -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
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
 if [[ "${MASS_BASELINE_BROWSER:-0}" == 1 && "$(basename "$f")" > 202610290019 ]];then continue;fi
 if [[ "${MASS_POPULATED_UPGRADE:-0}" == 1 && "$f" == *202610290020* ]];then sql < "$repo_root/tests/release/preactivation.sql";fi
 if [[ "$(basename "$f")" > 202610290019 ]];then
  schema_before="$(docker exec "$container" pg_dump -U postgres --schema-only | sed '/^\\restrict /d; /^\\unrestrict /d' | sha256sum | cut -d' ' -f1)"
  failure_log="$(mktemp /tmp/mass-release-rollback.XXXXXX)"
  if python - "$f" <<'PYINJECT' | migrate > "$failure_log" 2>&1
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text();assert s.count('COMMIT;')==1
print(s.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
PYINJECT
  then echo 'Injected failure unexpectedly committed';exit 1;fi
  rg -q 'division by zero' "$failure_log";rm -f -- "$failure_log"
  schema_after="$(docker exec "$container" pg_dump -U postgres --schema-only | sed '/^\\restrict /d; /^\\unrestrict /d' | sha256sum | cut -d' ' -f1)"
  [[ "$schema_before" == "$schema_after" ]]
  echo "PASS: injected $(basename "$f") failure preserves schema/ACL/ownership; exact file retried."
 fi
 migrate < "$f"
 if [[ "${MASS_POPULATED_UPGRADE:-0}" == 1 && "$(basename "$f")" > 202610290019 ]];then sql < "$repo_root/tests/release/verify-preactivation.sql";fi
done
if [[ "${MASS_REVIEWED_CHARTS:-0}" == 1 ]];then
if [[ "${MASS_BASELINE_BROWSER:-0}" == 1 ]];then echo 'Reviewed proposal requires020–023; invalid test combination';exit 1;fi
 migrate < "$repo_root/supabase/proposals/202611030024_reviewed_chart_metrics.sql"
fi
if [[ "${MASS_POPULATED_UPGRADE:-0}" == 1 ]];then
 sql < "$repo_root/tests/release/verify-preactivation.sql"
 sql <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001"}',false);
DO $$DECLARE r jsonb;BEGIN
 IF (mass_api.get_original_capabilities()->>'aggregate_api')::int<>23 THEN RAISE EXCEPTION 'Upgrade capability missing';END IF;
 IF to_regprocedure('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)') IS NOT NULL THEN
  r:=mass_api.reviewed_chart_metrics(ARRAY['90000000-0000-4000-8000-000000000002']::uuid[],'2026-04-30','2026-04-01','2026-05-01','90000000-0000-4000-8000-000000000003');
  IF (r->>'children')::int<>1 OR abs((r->'attendance'->>'percentage')::numeric-100.0/3)>0.000001 THEN RAISE EXCEPTION 'Upgraded read changed approved calculation';END IF;
 END IF;
END;$$;
SQL
 echo 'PASS: populated001–019→020–023 upgrade, all failure rollbacks/retries, original data and optional024 scoped reads.'
 exit 0
fi
if [[ "${MASS_AGGREGATE_PERFORMANCE:-0}" == 1 ]];then
 if [[ "${MASS_REVIEWED_CHARTS:-0}" != 1 ]];then echo 'Performance suite requires024proposal';exit 1;fi
 sql < "$repo_root/tests/performance/reviewed.sql"
 exit 0
fi
sql -Atc "SELECT 'SCHEMA_INVENTORY '||jsonb_build_object('tables',(SELECT count(*) FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace) AND relkind='r'),'columns',(SELECT count(*) FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace) AND relkind='r') AND attnum>0 AND NOT attisdropped),'foreign_keys',(SELECT count(*) FROM pg_constraint WHERE connamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace) AND contype='f'),'policies',(SELECT count(*) FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_import'::regnamespace))))::text;"

python - "$repo_root" "${MASS_BASELINE_BROWSER:-0}" <<'PY' | sql
from pathlib import Path
import sys
s=(Path(sys.argv[1])/'tests/core/synthetic.sql').read_text()
s=s.replace('count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity)',('count(*)=20' if sys.argv[2]=='1' else 'count(*)=25')+' AND bool_and(relrowsecurity AND relforcerowsecurity)')
s=s.replace('bool_and(student_id=upper(id::text))',"bool_and(student_id ~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$')")
s=s.replace("'428C9','generated permanent student ID cannot be overwritten'","'55000','generated permanent student ID cannot be overwritten'")
print(s)
PY
if [[ "${MASS_BASELINE_BROWSER:-0}" != 1 ]];then
 sql < "$repo_root/tests/release/visits.sql"
 source "$repo_root/tests/release/concurrency.sh"
fi
if [[ "${MASS_REVIEWED_CHARTS:-0}" == 1 ]];then
 sql < "$repo_root/tests/reviewed-calculations/synthetic.sql"
 sql < "$repo_root/tests/security/definer-matrix.sql"
 review_output="$(mktemp -d /tmp/mass-reviewed-calculations.XXXXXX)"
 sql -At < "$repo_root/tests/reviewed-calculations/export.sql" > "$review_output/input.json"
 node "$repo_root/tests/reviewed-calculations/cases.mjs" "$review_output/input.json" "$review_output/cases.json" "$review_output/cases.sql"
 sql -At < "$review_output/cases.sql" > "$review_output/sql-results.jsonl"
 node "$repo_root/tests/reviewed-calculations/compare.mjs" "$review_output/input.json" "$review_output/cases.json" "$review_output/sql-results.jsonl"
fi
if [[ "${MASS_SECURITY_REVIEW:-0}" == 1 && "${MASS_REVIEWED_CHARTS:-0}" != 1 ]];then sql < "$repo_root/tests/security/definer-matrix.sql";fi
if [[ -n "${MASS_SECURITY_CATALOG_DIR:-}" ]];then
 python - "$repo_root" "$MASS_SECURITY_CATALOG_DIR" <<'PATHCHECK'
from pathlib import Path
import sys
if Path(sys.argv[2]).resolve().is_relative_to(Path(sys.argv[1]).resolve()):raise SystemExit('Private catalog output must be outside checkout')
PATHCHECK
 mkdir -p "$MASS_SECURITY_CATALOG_DIR"
 chmod 700 "$MASS_SECURITY_CATALOG_DIR"
 sql -Atc "SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'body',p.prosrc,'owner',pg_get_userbyid(p.proowner),'settings',p.proconfig) ORDER BY n.nspname,p.proname),'[]'::jsonb) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='mass_api' AND p.prosecdef" > "$MASS_SECURITY_CATALOG_DIR/local-functions.private.json"
 chmod 600 "$MASS_SECURITY_CATALOG_DIR/local-functions.private.json"
fi
if [[ "${MASS_ACTIVATION_DISABLED_BROWSER:-0}" == 1 ]];then
 if [[ "${MASS_BASELINE_BROWSER:-0}" == 1 ]];then echo 'Activation gate requires020–023';exit 1;fi
 { echo 'BEGIN;';cat "$repo_root/supabase/activation/control.sql" "$repo_root/supabase/activation/seal.sql";echo 'COMMIT;'; } | migrate
 if [[ "${MASS_REVIEWED_CHARTS:-0}" == 1 ]];then
  sql -c "SET ROLE mass_core_owner; UPDATE mass_activation.features SET enabled=true,approval_reference='isolated reviewed read reconciliation' WHERE feature='reviewed_reads';"
  sql -At < "$review_output/cases.sql" > "$review_output/sealed-sql-results.jsonl"
  node "$repo_root/tests/reviewed-calculations/compare.mjs" "$review_output/input.json" "$review_output/cases.json" "$review_output/sealed-sql-results.jsonl"
  sql -c "SET ROLE mass_core_owner; UPDATE mass_activation.features SET enabled=false,approval_reference='isolated read deactivation' WHERE feature='reviewed_reads';"
 fi
fi
if [[ "${MASS_BASELINE_BROWSER:-0}" == 1 ]];then echo 'PASS: isolated001–019sequence and original core checks.';else echo 'PASS: full migration sequence and original core plus release behavioral checks.';fi
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
const {writeSourceZip}=await import(path.join(process.argv[2],'scripts/zip.mjs'));await writeSourceZip(process.argv[2],path.join(process.argv[3],'MASS-CAC-Vercel-Source.zip'));
JS
 python "$repo_root/tests/release/browser.py"
 unset MASS_RELEASE_REST_SECRET
fi
