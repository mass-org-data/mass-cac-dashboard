#!/usr/bin/env bash
set -euo pipefail
# Local capability model only. Never accepts a hosted URL or applies provider changes.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
probe_work="$(mktemp -d /tmp/mass-role-probe.XXXXXX)"
container="mass-role-probe-${RANDOM}-$$"
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true;rm -rf -- "$probe_work"; }
trap cleanup EXIT INT TERM
docker run -d --name "$container" --network none \
 --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 -e POSTGRES_HOST_AUTH_METHOD=trust \
 postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((attempt=0;attempt<60;attempt++));do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then break;fi
 if ((attempt==59));then echo 'Local capability database startup failed' >&2;exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
sql -q < "$repo_root/tests/core/bootstrap.sql"
sql -q <<'SQL'
CREATE ROLE mass_test_migrator LOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE NOINHERIT;
GRANT CREATE ON DATABASE postgres TO mass_test_migrator;
GRANT USAGE ON SCHEMA auth TO mass_test_migrator WITH GRANT OPTION;
GRANT EXECUTE ON FUNCTION auth.uid() TO mass_test_migrator WITH GRANT OPTION;
GRANT REFERENCES(id) ON auth.users TO mass_test_migrator WITH GRANT OPTION;
SQL
# Regression copies omit ONLY the new explicit owner grants. The committed files
# remain untouched; reproduce the original PG17 failure for both bootstrap files.
for version in 001 007;do
 file=$(printf '%s\n' "$repo_root"/supabase/migrations/202610270${version}_*.sql)
 python - "$file" "$probe_work/legacy.sql" <<'LEGACY'
from pathlib import Path
import sys
lines=Path(sys.argv[1]).read_text().splitlines()
Path(sys.argv[2]).write_text('\n'.join(line for line in lines if not (line.startswith('GRANT mass_') and 'TO CURRENT_USER WITH SET TRUE, INHERIT TRUE' in line))+'\n')
LEGACY
 if docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate \
  -U mass_test_migrator -d postgres < "$probe_work/legacy.sql" > "$probe_work/legacy-${version}.txt" 2>&1;then
  echo 'Legacy bootstrap unexpectedly succeeded' >&2;exit 1
 fi
 python - "$probe_work/legacy-${version}.txt" <<'ERROR'
from pathlib import Path
import sys
assert '42501' in Path(sys.argv[1]).read_text(), 'Unexpected legacy failure reason'
ERROR
 if [[ "$version" == 001 ]];then
  [[ "$(sql -Atqc "SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'mass\_foundation\_%' ESCAPE '\') AND to_regnamespace('mass_foundation') IS NULL")" == t ]]
  echo 'PASS: original foundation SET ROLE failure reproduces and leaves zero MASS roles/schemas.'
  for migration in "$repo_root"/supabase/migrations/20261027000[1-6]_*.sql;do
   docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_test_migrator -d postgres < "$migration"
  done
 else
  [[ "$(sql -Atqc "SELECT to_regnamespace('mass_core') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'mass\_core\_%' ESCAPE '\') AND to_regclass('mass_foundation.source_files') IS NOT NULL")" == t ]]
  echo 'PASS: original core bootstrap fails atomically; committed foundation remains intact.'
 fi
done
# Apply 07 through 15 without any createrole_self_grant override. Inject an
# error after all of corrected 07 to prove its roles/memberships/objects roll back.
python - "$repo_root/supabase/migrations/202610270007_auth_scope.sql" "$probe_work/failing.sql" <<'FAILURE'
from pathlib import Path
import sys
source=Path(sys.argv[1]).read_text()
assert source.count('COMMIT;')==1
Path(sys.argv[2]).write_text(source.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
FAILURE
if docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate \
 -U mass_test_migrator -d postgres < "$probe_work/failing.sql" > "$probe_work/failure.txt" 2>&1;then
 echo 'Failure injection unexpectedly succeeded' >&2;exit 1
fi
python - "$probe_work/failure.txt" <<'FAILURE'
from pathlib import Path
import sys
failure=Path(sys.argv[1]).read_text()
assert '22012' in failure,failure
FAILURE
[[ "$(sql -Atqc "SELECT to_regnamespace('mass_core') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'mass\_core\_%' ESCAPE '\') AND to_regclass('mass_foundation.source_files') IS NOT NULL")" == t ]]
for migration in "$repo_root"/supabase/migrations/*.sql;do
 # Historical 001–016 acceptance; 017 has tests/directory/run-local.sh.
 [[ "$(basename "$migration")" > 202610280016_frontend_reads.sql ]] && continue
 [[ "$(basename "$migration")" < 202610270007_auth_scope.sql ]] && continue
 docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_test_migrator -d postgres < "$migration"
done
sql -Atq <<'CHECKS' > "$probe_work/capabilities.txt"
SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='mass_test_migrator';
SELECT count(*)=23 AND bool_and(relrowsecurity AND relforcerowsecurity)
 FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r';
SELECT count(*)=155 FROM pg_attribute WHERE attrelid IN
 (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r') AND attnum>0 AND NOT attisdropped;
SELECT count(*)=27 FROM pg_constraint WHERE connamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND contype='f';
SELECT count(*)=72 FROM pg_policy WHERE polrelid IN
 (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace));
-- PG17 may retain separate automatic-ADMIN and explicit-SET/INHERIT rows
-- from different grantors. Verify effective rights and explicit grant coverage.
SELECT count(DISTINCT roleid)=2 AND bool_and(pg_has_role('mass_test_migrator',roleid,'SET') AND pg_has_role('mass_test_migrator',roleid,'USAGE'))
 FROM pg_auth_members WHERE roleid IN ('mass_foundation_owner'::regrole,'mass_core_owner'::regrole)
 AND member='mass_test_migrator'::regrole AND set_option AND inherit_option;
SELECT NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid IN
 ('mass_foundation_owner'::regrole,'mass_core_owner'::regrole) AND member<>'mass_test_migrator'::regrole);
SELECT bool_and(c.relowner=CASE WHEN n.nspname='mass_foundation' THEN 'mass_foundation_owner'::regrole ELSE 'mass_core_owner'::regrole END)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('mass_foundation','mass_core') AND c.relkind='r';
SELECT NOT EXISTS(SELECT 1 FROM pg_roles caller CROSS JOIN pg_roles owner
 WHERE caller.rolname IN ('anon','authenticated','service_role')
 AND owner.rolname IN ('mass_foundation_owner','mass_core_owner')
 AND (pg_has_role(caller.oid,owner.oid,'SET') OR pg_has_role(caller.oid,owner.oid,'USAGE')));
CHECKS
python - "$probe_work/capabilities.txt" <<'CHECKS'
from pathlib import Path
import sys
values=Path(sys.argv[1]).read_text().splitlines()
assert values==['t']*9,values
CHECKS
# Prove later SET LOCAL ROLE operations under the actual non-superuser session.
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_test_migrator -d postgres <<'SWITCH'
BEGIN;
SET LOCAL ROLE mass_foundation_owner;
RESET ROLE;
SET LOCAL ROLE mass_core_owner;
ROLLBACK;
SWITCH
echo 'PASS: corrected core bootstrap failure rolls back roles/grants/schema; retry completes all 16 files.'
echo 'PASS: restricted PG17 principal with default creator settings switches both owners; 23 tables/155 columns/27 FKs/72 policies; owner membership isolated to deployer. Managed Supabase unverified.'
