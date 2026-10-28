#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
container="mass-student-test-${RANDOM}-$$"
private="$(mktemp -d /tmp/mass-student-test.XXXXXX)"
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true; rm -rf -- "$private"; }
trap cleanup EXIT INT TERM
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=512m \
 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((n=0;n<60;n++));do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1;then break;fi
 if ((n==59));then exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres "$@"; }
sql < "$repo_root/tests/core/bootstrap.sql"
for f in "$repo_root"/supabase/migrations/20261027*.sql;do sql < "$f";done
sql < "$repo_root/tests/core/synthetic.sql"
sql < "$repo_root/supabase/migrations/202610280016_frontend_reads.sql"
sql < "$repo_root/tests/frontend/reads.sql"
sql < "$repo_root/supabase/migrations/202610280017_donor_staff_directory.sql"
sql < "$repo_root/tests/directory/synthetic.sql"
# The new migration must not adopt changes from legacy files or existing policies.
policy_snapshot(){ sql -Atqc "SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid),'roles',polroles::text) ORDER BY oid) FROM pg_policy WHERE polname NOT LIKE 'admin_import_%' AND polrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace))"; }
before="$(policy_snapshot)"
python - "$repo_root" <<'PY' | sql > "$private/failure.log" 2>&1 && { echo 'Injected migration failure passed unexpectedly'; exit 1; }
import pathlib,sys
s=(pathlib.Path(sys.argv[1])/'supabase/migrations/202610280018_controlled_student_import.sql').read_text()
print(s.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'))
PY
rg -q 'division by zero' "$private/failure.log"
[[ "$(sql -Atqc "SELECT to_regnamespace('mass_import') IS NULL AND NOT EXISTS(SELECT FROM pg_roles WHERE rolname='mass_data_importer')")" == t ]]
sql <<'SQL'
CREATE ROLE mass_student_deployer LOGIN CREATEROLE NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT CREATE ON DATABASE postgres TO mass_student_deployer;
GRANT mass_core_owner,mass_foundation_owner TO mass_student_deployer WITH SET TRUE, INHERIT TRUE;
SQL
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_student_deployer -d postgres < "$repo_root/supabase/migrations/202610280018_controlled_student_import.sql"
[[ "$(policy_snapshot)" == "$before" ]]
sql < "$repo_root/supabase/migrations/202610280019_import_history_integrity.sql"
sql < "$repo_root/tests/students/synthetic.sql"
source "$repo_root/tests/students/concurrency.sh"
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U mass_test_authenticator -d postgres <<'SQL'
SET ROLE authenticated;
SELECT core_test.expect_error('SET ROLE mass_data_importer','42501','actual non-superuser staff connection cannot switch into importer');
SQL
echo 'PASS: baseline core/read/directory tests and controlled student import security; original policies unchanged; failure rollback and retry.'
