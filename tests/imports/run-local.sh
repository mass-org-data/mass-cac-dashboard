#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
container="mass-import-test-${RANDOM}-$$"
private="$(mktemp -d /tmp/mass-import-test.XXXXXX)"
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true;rm -rf -- "$private"; }
trap cleanup EXIT INT TERM
python "$repo_root/tests/imports/test_pipeline.py"
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((n=0;n<60;n++));do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi
 if ((n==59));then echo 'Isolated import database startup failed';exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -U postgres "$@"; }
import_sql(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -U mass_import_test -d postgres; }
sql < "$repo_root/tests/core/bootstrap.sql"
for f in "$repo_root"/supabase/migrations/*.sql;do sql < "$f";done
sql <<'SQL'
-- Test-only migration-history stand-in; hosted names were inspected separately.
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);
CREATE ROLE mass_import_test LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOINHERIT;
GRANT mass_foundation_ingestor,mass_core_owner TO mass_import_test WITH SET TRUE, INHERIT FALSE;
SQL
sql < "$repo_root/supabase/compatibility/import-preflight.sql"
python - "$repo_root" "$private" <<'PY'
import sys
from pathlib import Path
sys.path.insert(0,str(Path(sys.argv[1])/'tests/imports'))
from test_pipeline import fixture
from render import render
p,layout,plan,mapping,approval=fixture(sys.argv[2],optional_shift=True,missing_teacher=True)
sql=render(plan,mapping,approval());(Path(sys.argv[2])/'import.sql').write_text(sql)
# Same valid source/mapping; a fault inside its transaction must undo all writes.
(Path(sys.argv[2])/'failure.sql').write_text(sql.replace('\nCOMMIT;','\nSELECT 1/0;\nCOMMIT;'))
# A separately reviewed different label with the same source identity must fail.
mapping['entities']['donors'][0]['label']='Synthetic conflicting canonical label'
(Path(sys.argv[2])/'conflict.sql').write_text(render(plan,mapping,approval()))
PY
if import_sql < "$private/failure.sql" > "$private/error.log" 2>&1;then echo 'Injected import failure unexpectedly passed';exit 1;fi
if ! rg -q 'division by zero' "$private/error.log";then cat "$private/error.log";exit 1;fi
[[ "$(sql -Atqc "SELECT (SELECT count(*) FROM mass_foundation.source_files)=0 AND (SELECT count(*) FROM mass_core.donors)=0 AND (SELECT count(*) FROM mass_foundation.import_batches)=0")" == t ]]
echo 'PASS IMPORT: late failure rolls back source, directory, batches and audit together.'
import_sql < "$private/import.sql" > "$private/a.log" 2>&1 & a=$!
import_sql < "$private/import.sql" > "$private/b.log" 2>&1 & b=$!
wait "$a";wait "$b"
echo 'PASS IMPORT: concurrent first execution serializes on the batch without duplicate writes.'
sql -Atq <<'SQL' > "$private/before.txt"
SELECT count(*) FROM mass_foundation.audit_events;
SELECT row_version FROM mass_foundation.import_batches;
SQL
import_sql < "$private/import.sql"
sql -Atq <<'SQL' > "$private/after.txt"
SELECT count(*) FROM mass_foundation.audit_events;
SELECT row_version FROM mass_foundation.import_batches;
SQL
cmp "$private/before.txt" "$private/after.txt"
echo 'PASS IMPORT: exact retry creates no rows, revisions or audit duplicates.'
if import_sql < "$private/conflict.sql" > "$private/error.log" 2>&1;then echo 'Conflicting identity unexpectedly accepted';exit 1;fi
rg -q 'donor/source mapping mismatch' "$private/error.log"
echo 'PASS IMPORT: conflicting approved mapping fails without overwriting stored identity.'
sql <<'SQL'
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_foundation.source_files),'one checksummed source file');
SELECT core_test.assert_true((SELECT count(*)=5 FROM mass_foundation.source_sheets),'five registered physical worksheets');
SELECT core_test.assert_true((SELECT count(*)=10 FROM mass_foundation.source_rows),'headers and candidate rows retain exact row provenance');
SELECT core_test.assert_true((SELECT count(*)=4 FROM mass_core.donors),'four approved donors; quarantined row not imported');
SELECT core_test.assert_true((SELECT count(*)=4 FROM mass_core.centres),'four explicit centre identities');
SELECT core_test.assert_true((SELECT count(*)=7 FROM mass_core.staff_members),'seven reviewed staff; missing teacher creates no fabricated person');
SELECT core_test.assert_true((SELECT count(*)=7 FROM mass_core.centre_staff_assignments),'seven source-backed assignments; missing teacher has no assignment');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_core.centre_staff_assignments WHERE shift_code IS NULL),'absent worksheet shift persists as SQL NULL');
SELECT core_test.assert_true((SELECT count(*)=0 FROM auth.users),'no Auth accounts provisioned');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.children),'no children implicitly imported from directory observations');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.user_scope_grants),'directory identities create no access grants');
SELECT core_test.assert_true((SELECT state='complete' AND extracted_count=10 AND accepted_count=4 AND quarantined_count=1 AND excluded_count=5 AND row_version=5 FROM mass_foundation.import_batches),'batch transitions and physical-row reconciliation exact');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_foundation.import_exceptions),'quarantined row has minimized restricted exception');
SELECT core_test.assert_true((SELECT bool_and(change_metadata - 'revision'='{}'::jsonb) FROM mass_foundation.audit_events),'technical audit contains only minimized revision metadata');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_api.get_centre_directory()),'imported directory grants no unassigned authenticated access');
RESET ROLE;
SET ROLE anon;
SELECT core_test.expect_error('SELECT * FROM mass_api.get_centre_directory()','42501','imported directory remains inaccessible anonymously');
RESET ROLE;
SQL
sql < "$repo_root/supabase/compatibility/import-postflight.sql"
echo 'PASS: isolated PostgreSQL17 import pipeline, retry/conflict/rollback and reconciliation; no hosted target accepted.'
