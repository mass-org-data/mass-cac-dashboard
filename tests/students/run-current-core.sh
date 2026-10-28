#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
container="mass-current-core-${RANDOM}-$$"
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true' EXIT INT TERM
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec,size=256m \
 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe >/dev/null
for ((n=0;n<60;n++));do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1;then break;fi
 if ((n==59));then exit 1;fi
 sleep 1
done
sql(){ docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres; }
sql < "$repo_root/tests/core/bootstrap.sql"
for f in "$repo_root"/supabase/migrations/*.sql;do sql < "$f";done
# Reuse every behavioral assertion against the CURRENT schema, changing only
# the three explicit historical catalog/ID expectations. No behavioral assertions
# are removed. The unmodified historical suite also runs in run-local.sh.
python - "$repo_root" <<'PY' | sql
from pathlib import Path
import sys
s=(Path(sys.argv[1])/'tests/core/synthetic.sql').read_text()
changes={"count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity)":"count(*)=20 AND bool_and(relrowsecurity AND relforcerowsecurity)",
 "bool_and(student_id=upper(id::text))":"bool_and(student_id ~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$')",
 "'428C9','generated permanent student ID cannot be overwritten'":"'55000','generated permanent student ID cannot be overwritten'"}
for a,b in changes.items():
 assert s.count(a)==1,a
 s=s.replace(a,b)
print(s)
PY
echo 'PASS: all existing core behavioral assertions against migrations 001–019.'
