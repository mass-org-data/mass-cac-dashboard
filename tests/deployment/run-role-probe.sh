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
# With default PG17 creator settings, CREATEROLE alone cannot SET ROLE the new
# owner. The file must fail atomically, without adopting/repairing anything.
if docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate \
 -U mass_test_migrator -d postgres < "$repo_root/supabase/migrations/202610270001_source_files.sql" \
 > "$probe_work/default.txt" 2>&1;then
 echo 'Unexpected default creator behavior; review capability model' >&2;exit 1
fi
python - "$probe_work/default.txt" <<'PY'
from pathlib import Path
import sys
assert '42501' in Path(sys.argv[1]).read_text(), 'Unexpected failure reason'
PY
[[ "$(sql -Atqc "SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mass_foundation_owner')")" == t ]]
echo 'PASS: CREATEROLE alone insufficient under default PG17 creator settings; failed file rolls back.'
# SET alone still does not give the creator owner privileges for the schema ACL
# statements that precede SET LOCAL ROLE in files 01/07. Verify that failure too.
if { printf '%s\n' "SET createrole_self_grant='set';";cat "$repo_root/supabase/migrations/202610270001_source_files.sql"; } |
 docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -U mass_test_migrator -d postgres \
 > "$probe_work/set-only.txt" 2>&1;then
 echo 'Unexpected SET-only creator behavior; review capability model' >&2;exit 1
fi
python - "$probe_work/set-only.txt" <<'PY'
from pathlib import Path
import sys
assert '42501' in Path(sys.argv[1]).read_text(), 'Unexpected SET-only failure reason'
PY
[[ "$(sql -Atqc "SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mass_foundation_owner')")" == t ]]
echo 'PASS: SET-only creator membership also insufficient for schema ACL operations before SET ROLE.'
# Explicitly test a supported PG17 session capability in this disposable model.
# This is not an approved hosted setting change or evidence of provider support.
for migration in "$repo_root"/supabase/migrations/*.sql;do
 { printf '%s\n' "SET createrole_self_grant='set, inherit';";cat "$migration"; } |
 docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_test_migrator -d postgres
done
sql -Atq <<'SQL' > "$probe_work/capabilities.txt"
SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='mass_test_migrator';
SELECT count(*)=23 AND bool_and(relrowsecurity AND relforcerowsecurity)
 FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r';
SELECT count(*)=27 FROM pg_constraint WHERE connamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND contype='f';
SELECT count(*)=71 FROM pg_policy WHERE polrelid IN
 (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace));
SQL
python - "$probe_work/capabilities.txt" <<'PY'
from pathlib import Path
import sys
assert Path(sys.argv[1]).read_text().splitlines()==['t']*4
PY
echo 'PASS: all 15 files apply as a NOSUPERUSER/NOBYPASSRLS principal with explicit SET/INHERIT-self-grant and delegated Auth privileges; managed Supabase unverified.'
