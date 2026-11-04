#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
container="mass-activation-${RANDOM}-$$"
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true' EXIT INT TERM
out="$(mktemp -d /tmp/mass-activation-test.XXXXXX)"
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((n=0;n<60;n++));do if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1;then break;fi;sleep 1;done
sql(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres "$@"; }
migrate(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_activation_deployer -d postgres; }
sql < "$root/tests/core/bootstrap.sql"
sql <<'SQL'
CREATE ROLE mass_activation_deployer LOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE NOINHERIT;
GRANT CREATE ON DATABASE postgres TO mass_activation_deployer;
GRANT USAGE ON SCHEMA auth TO mass_activation_deployer;
GRANT REFERENCES(id) ON auth.users TO mass_activation_deployer;
ALTER DATABASE postgres SET mass_test.deployment_principal='mass_activation_deployer';
CREATE SCHEMA supabase_migrations AUTHORIZATION mass_activation_deployer;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);
ALTER TABLE supabase_migrations.schema_migrations OWNER TO mass_activation_deployer;
SQL
for f in "$root"/supabase/migrations/*.sql;do
 [[ "$(basename "$f")" > 202610290019 ]] && continue
 migrate < "$f"
 name="$(basename "$f" .sql)";version="${name%%_*}"
 migrate <<< "INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('$version','$name');"
done
# Deliberately noncanonical provider aliases; the explicit envelopes must not
# replay historical files or depend on their version-number sorting.
sql -c "UPDATE supabase_migrations.schema_migrations SET version='20991231'||right(version,6) WHERE name NOT LIKE '%018_%' AND name NOT LIKE '%019_%';"
sql < "$root/tests/release/preactivation.sql"
# TEST ONLY: one anonymous, Leadership and additional CO actor; 276 grants do not
# purport to reproduce the unavailable private hosted grant topology.
sql < "$root/tests/activation/grants.sql"
python "$root/scripts/activation/prepare.py" --output "$out/envelopes" --include-proposal-024 > "$out/manifest.log"
for f in "$out"/envelopes/*.sql;do
 before="$(docker exec "$container" pg_dump -U postgres --schema-only | sed '/^\\restrict /d; /^\\unrestrict /d' | sha256sum | cut -d' ' -f1)"
 if python - "$f" <<'PY' | migrate > "$out/failure.log" 2>&1
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text();assert s.rstrip().endswith('COMMIT;');print(s.rsplit('COMMIT;',1)[0]+'SELECT 1/0;\nCOMMIT;')
PY
 then echo 'Failure injection unexpectedly committed';exit 1;fi
 rg -q 'division by zero' "$out/failure.log"
 after="$(docker exec "$container" pg_dump -U postgres --schema-only | sed '/^\\restrict /d; /^\\unrestrict /d' | sha256sum | cut -d' ' -f1)"
 [[ "$before" == "$after" ]]
 # An unexpected overloaded API cannot become an unclassified write route.
 if python - "$f" <<'PYOVERLOAD' | migrate > "$out/overload.log" 2>&1
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
extra="SET LOCAL ROLE mass_core_owner; CREATE FUNCTION mass_api.get_context(p_unreviewed integer) RETURNS jsonb LANGUAGE sql AS $unexpected$ SELECT '{}'::jsonb $unexpected$;\n"
print(s.replace('-- Executed INSIDE each installation transaction',extra+'-- Executed INSIDE each installation transaction',1))
PYOVERLOAD
 then echo 'Unreviewed API overload unexpectedly committed';exit 1;fi
 rg -q 'Unreviewed API overload' "$out/overload.log"
 after="$(docker exec "$container" pg_dump -U postgres --schema-only | sed '/^\\restrict /d; /^\\unrestrict /d' | sha256sum | cut -d' ' -f1)"
 [[ "$before" == "$after" ]]
 python - "$f" <<'PYMETA' | migrate
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
needle='-- Executed INSIDE each installation transaction'
before="""RESET ROLE;
CREATE TEMP TABLE activation_metadata AS SELECT oid,to_jsonb(p)-'prosrc' original,prosrc FROM pg_proc p WHERE pronamespace='mass_api'::regnamespace;
"""
after="""RESET ROLE;
DO $metadata$ DECLARE r record; BEGIN
 FOR r IN SELECT a.*,p.prosrc newbody,to_jsonb(p)-'prosrc' current FROM activation_metadata a JOIN pg_proc p ON p.oid=a.oid WHERE a.original->>'proname'<>'get_original_capabilities' LOOP
 IF r.original IS DISTINCT FROM r.current THEN RAISE EXCEPTION 'Function owner/ACL/security/config/signature changed by seal';END IF;
 IF position('-- MASS_ACTIVATION_GUARD_V1' IN r.prosrc)=0 AND position('-- MASS_ACTIVATION_GUARD_V1' IN r.newbody)>0 THEN
 IF regexp_replace(r.newbody,E'\\n -- MASS_ACTIVATION_GUARD_V1\\n PERFORM mass_core.require_operation_enabled[(][^;]*;','')<>r.prosrc THEN RAISE EXCEPTION 'Underlying body changed beyond entry guard';END IF;
 ELSIF r.newbody<>r.prosrc THEN RAISE EXCEPTION 'Unrelated API body changed';END IF;
 END LOOP;
END;$metadata$;
DROP TABLE activation_metadata;
"""
s=s.replace(needle,before+needle,1).replace('RESET ROLE;\nINSERT INTO supabase_migrations.schema_migrations',after+'RESET ROLE;\nINSERT INTO supabase_migrations.schema_migrations',1)
print(s)
PYMETA
 sql < "$root/tests/release/verify-preactivation.sql"
 sql < "$root/tests/activation/disabled.sql"
 echo "PASS: $(basename "$f") atomic failure rollback, retry, unchanged original rows and disabled direct calls."
done
# No repeat: ledger guard must reject before modifying already installed objects.
if migrate < "$out/envelopes/202610290020_original_workflows.sql" > "$out/replay.log" 2>&1;then echo 'Replay unexpectedly succeeded';exit 1;fi
rg -q 'Unexpected migration ledger' "$out/replay.log"
sql < "$root/supabase/activation/postflight.sql"
sql < "$root/tests/activation/enabled.sql"
echo "PASS: isolated activation suite; private logs in $out. Not managed Auth or actual hosted grant replication."
