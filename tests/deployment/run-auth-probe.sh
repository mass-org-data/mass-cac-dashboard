#!/usr/bin/env bash
set -euo pipefail
# Synthetic managed-Auth ownership boundary. Never accepts any hosted URL.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
auth_work="$(mktemp -d /tmp/mass-auth-probe.XXXXXX)"
container="mass-auth-probe-${RANDOM}-$$"
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true;rm -rf -- "$auth_work"; }
trap cleanup EXIT INT TERM
docker run -d --name "$container" --network none \
 --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 -e POSTGRES_HOST_AUTH_METHOD=trust \
 postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((attempt=0;attempt<60;attempt++));do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi
 if ((attempt==59));then echo 'Local Auth boundary database startup failed' >&2;exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
migrate(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U mass_test_migrator -d postgres; }
sql -q < "$repo_root/tests/core/bootstrap.sql"
sql -q <<'SQL'
CREATE ROLE mass_test_auth_owner NOLOGIN;
ALTER SCHEMA auth OWNER TO mass_test_auth_owner;
ALTER TABLE auth.users OWNER TO mass_test_auth_owner;
ALTER FUNCTION auth.uid() OWNER TO mass_test_auth_owner;
CREATE ROLE mass_test_migrator LOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE NOINHERIT;
GRANT CREATE ON DATABASE postgres TO mass_test_migrator;
-- Direct privileges ONLY: intentionally no grant options or Auth-owner membership.
GRANT USAGE ON SCHEMA auth TO mass_test_migrator;
GRANT EXECUTE ON FUNCTION auth.uid() TO mass_test_migrator;
GRANT REFERENCES(id) ON auth.users TO mass_test_migrator;
SQL
for migration in "$repo_root"/supabase/migrations/20261027000[1-6]_*.sql;do migrate < "$migration";done
# Record foundation state to prove failed 007 attempts do not touch committed 001-006.
foundation_state(){ sql -Atq <<'SQL'
SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname)
FROM pg_class c WHERE c.relnamespace='mass_foundation'::regnamespace AND c.relkind='r';
SQL
}
foundation_state > "$auth_work/foundation-before.txt"
# The superseded published 007 shows that failed delegation can emit warnings
# before the actual 42501 on Auth schema lookup by the core owner.
git -C "$repo_root" show 625c458fabb7bc7b8b6e98744f53489c21876bb0:supabase/migrations/202610270007_auth_scope.sql > "$auth_work/legacy007.sql"
if migrate < "$auth_work/legacy007.sql" > "$auth_work/legacy.txt" 2>&1;then echo 'Legacy Auth boundary unexpectedly passed' >&2;exit 1;fi
python - "$auth_work/legacy.txt" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text()
assert '42501' in text and 'permission denied for schema auth' in text,text
assert 'no privileges were granted' in text,text
PY
[[ "$(sql -Atqc "SELECT to_regnamespace('mass_core') IS NULL AND to_regnamespace('mass_api') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('mass_core_owner','mass_core_admin'))")" == t ]]
foundation_state > "$auth_work/foundation-after.txt"
cmp "$auth_work/foundation-before.txt" "$auth_work/foundation-after.txt"
echo 'PASS: legacy Auth delegation warns then fails with schema auth 42501; foundation survives unchanged.'
# Prove a missing direct REFERENCES right remains a hard gate, not bypassed.
sql -q -c 'REVOKE REFERENCES(id) ON auth.users FROM mass_test_migrator;'
if migrate < "$repo_root/supabase/migrations/202610270007_auth_scope.sql" > "$auth_work/no-reference.txt" 2>&1;then echo 'Missing REFERENCES unexpectedly bypassed' >&2;exit 1;fi
python - "$auth_work/no-reference.txt" <<'PY'
from pathlib import Path
import sys
assert '42501' in Path(sys.argv[1]).read_text()
PY
sql -q -c 'GRANT REFERENCES(id) ON auth.users TO mass_test_migrator;'
# Core owner must have existing managed-function EXECUTE; no elevated wrapper.
sql -q -c 'REVOKE EXECUTE ON FUNCTION auth.uid() FROM PUBLIC;'
if migrate < "$repo_root/supabase/migrations/202610270007_auth_scope.sql" > "$auth_work/no-execute.txt" 2>&1;then echo 'Missing managed EXECUTE unexpectedly bypassed' >&2;exit 1;fi
python - "$auth_work/no-execute.txt" <<'PY'
from pathlib import Path
import sys
assert 'provider authorization required' in Path(sys.argv[1]).read_text()
PY
sql -q -c 'GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;'
# Deployment-principal function defaults must not silently publish the wrapper.
sql -q -c 'ALTER DEFAULT PRIVILEGES FOR ROLE mass_test_migrator GRANT EXECUTE ON FUNCTIONS TO anon;'
if migrate < "$repo_root/supabase/migrations/202610270007_auth_scope.sql" > "$auth_work/default-acl.txt" 2>&1;then echo 'Unexpected default function grant bypassed' >&2;exit 1;fi
python - "$auth_work/default-acl.txt" <<'PY'
from pathlib import Path
import sys
assert 'unexpected deployment default function grants' in Path(sys.argv[1]).read_text()
PY
sql -q -c 'ALTER DEFAULT PRIVILEGES FOR ROLE mass_test_migrator REVOKE EXECUTE ON FUNCTIONS FROM anon;'
# Inject a failure late in 007; retry only 007 onward, never the applied foundation.
python - "$repo_root/supabase/migrations/202610270007_auth_scope.sql" "$auth_work/failing.sql" <<'PY'
from pathlib import Path
import sys
source=Path(sys.argv[1]).read_text();assert source.count('COMMIT;')==1
Path(sys.argv[2]).write_text(source.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
PY
if migrate < "$auth_work/failing.sql" > "$auth_work/failure.txt" 2>&1;then echo 'Failure injection unexpectedly passed' >&2;exit 1;fi
python - "$auth_work/failure.txt" <<'PY'
from pathlib import Path
import sys
assert '22012' in Path(sys.argv[1]).read_text()
PY
foundation_state > "$auth_work/foundation-after.txt"
cmp "$auth_work/foundation-before.txt" "$auth_work/foundation-after.txt"
[[ "$(sql -Atqc "SELECT to_regnamespace('mass_core') IS NULL AND to_regnamespace('mass_api') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('mass_core_owner','mass_core_admin'))")" == t ]]
for migration in "$repo_root"/supabase/migrations/*.sql;do
 [[ "$(basename "$migration")" < 202610270007_auth_scope.sql ]] && continue
 migrate < "$migration"
done
sql -Atq <<'SQL' > "$auth_work/checks.txt"
SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='mass_test_migrator';
SELECT NOT has_schema_privilege('mass_test_migrator','auth','USAGE WITH GRANT OPTION')
 AND NOT has_function_privilege('mass_test_migrator','auth.uid()','EXECUTE WITH GRANT OPTION')
 AND NOT has_column_privilege('mass_test_migrator','auth.users','id','REFERENCES WITH GRANT OPTION');
SELECT NOT has_schema_privilege('mass_core_owner','auth','USAGE')
 AND NOT has_schema_privilege('mass_foundation_owner','auth','USAGE')
 AND NOT has_any_column_privilege('mass_core_owner','auth.users','SELECT,INSERT,UPDATE,REFERENCES')
 AND NOT has_any_column_privilege('mass_foundation_owner','auth.users','SELECT,INSERT,UPDATE,REFERENCES');
SELECT NOT prosecdef AND prosqlbody IS NOT NULL AND proconfig @> ARRAY['search_path=pg_catalog']
 FROM pg_proc WHERE oid='mass_core.request_user_id()'::regprocedure;
SELECT EXISTS(SELECT 1 FROM pg_depend WHERE classid='pg_proc'::regclass
 AND objid='mass_core.request_user_id()'::regprocedure AND refclassid='pg_proc'::regclass AND refobjid='auth.uid()'::regprocedure);
SELECT count(*)=23 AND bool_and(relrowsecurity AND relforcerowsecurity)
 FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r';
SELECT count(*)=155 FROM pg_attribute WHERE attrelid IN
 (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r') AND attnum>0 AND NOT attisdropped;
SELECT count(*)=27 FROM pg_constraint WHERE connamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND contype='f';
SELECT count(*)=71 FROM pg_policy WHERE polrelid IN
 (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace));
SQL
python - "$auth_work/checks.txt" <<'PY'
from pathlib import Path
import sys
rows=Path(sys.argv[1]).read_text().splitlines();assert rows==['t']*9,rows
PY
# Exercise the same behavioral and concurrency tests after the restricted install.
sql -q -c "ALTER DATABASE postgres SET mass_test.deployment_principal='mass_test_migrator';"
sql < "$repo_root/tests/core/synthetic.sql"
source "$repo_root/tests/core/concurrency.sh"
# Runtime function ACL remains enforced even after the wrapper is installed.
sql -q <<'SQL'
BEGIN;
REVOKE EXECUTE ON FUNCTION auth.uid() FROM PUBLIC;
SET ROLE mass_core_owner;
SELECT core_test.expect_error('SELECT mass_core.request_user_id()','42501','invoker wrapper honors managed-function EXECUTE revocation');
RESET ROLE;
ROLLBACK;
SQL
echo 'PASS: 007-015 resume with direct Auth privileges only; no Auth delegation, new definer or owner Auth-schema/data access; identity/RLS/FKs and runtime revocation enforced.'
