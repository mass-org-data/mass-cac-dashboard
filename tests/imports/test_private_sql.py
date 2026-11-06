"""Execute the exact private SQL only in a new Docker-internal disposable PG17.
Accepts no URL/host/production credential; never writes private records to Git/logs.
"""
import argparse,hashlib,json,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/imports'))
from common import canonical,read_private,write_private
from render import render

def main():
 p=argparse.ArgumentParser();p.add_argument('--sql',required=True);p.add_argument('--plan',required=True);p.add_argument('--mapping',required=True);p.add_argument('--approval',required=True);p.add_argument('--workbook',required=True);p.add_argument('--report',required=True);a=p.parse_args()
 plan=json.loads(read_private(a.plan).read_text());mapping=json.loads(read_private(a.mapping).read_text());approval=json.loads(read_private(a.approval).read_text())
 sql=read_private(a.sql).read_bytes()
 if hashlib.sha256(read_private(a.workbook).read_bytes()).hexdigest()!=plan['source']['sha256'] or render(plan,mapping,approval).encode()!=sql:raise ValueError('Private release digest mismatch.')
 container='mass-private-import-'+uuid.uuid4().hex[:12]
 def command(args,data=None,allow_fail=False):
  r=subprocess.run(args,input=data,capture_output=True)
  if r.returncode and not allow_fail:raise RuntimeError('Isolated verification stopped; no hosted connection or private diagnostic output.')
  return r
 def execute(data,principal='postgres',allow_fail=False):
  return command(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=terse','-U',principal,'-d','postgres'],data,allow_fail)
 try:
  command(['docker','run','-d','--name',container,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,nosuid,noexec,size=512m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe'])
  for attempt in range(120):
   if command(['docker','exec',container,'pg_isready','-h','127.0.0.1','-U','postgres'],allow_fail=True).returncode==0:break
   time.sleep(.25)
  else:raise RuntimeError('Fresh isolated database startup failed.')
  execute((ROOT/'tests/core/bootstrap.sql').read_bytes())
  # Baseline DDL installed once in this brand-new local database only. No existing
  # target is accepted and no deployed migration is replayed against Supabase.
  for f in sorted((ROOT/'supabase/migrations').glob('*.sql')):execute(f.read_bytes())
  execute(b'CREATE ROLE mass_private_import LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOINHERIT; GRANT mass_foundation_ingestor,mass_core_owner TO mass_private_import WITH SET TRUE, INHERIT FALSE;')
  failed=execute(sql.replace(b'\nCOMMIT;',b'\nSELECT 1/0;\nCOMMIT;'),'mass_private_import',True)
  if failed.returncode==0 or b'division by zero' not in failed.stderr:raise RuntimeError('Rollback rehearsal failed before its intended stop condition.')
  rolled_back=execute(b"SELECT (SELECT count(*) FROM mass_foundation.source_files)=0 AND (SELECT count(*) FROM mass_core.centres)=0 AND (SELECT count(*) FROM mass_foundation.import_batches)=0 AND (SELECT count(*) FROM mass_foundation.audit_events)=0;").stdout.strip()==b't'
  if not rolled_back:raise RuntimeError('Isolated rollback was not complete.')
  execute(sql,'mass_private_import')
  snapshot=b"SELECT jsonb_build_object('files',(SELECT count(*) FROM mass_foundation.source_files),'sheets',(SELECT count(*) FROM mass_foundation.source_sheets),'rows',(SELECT count(*) FROM mass_foundation.source_rows),'exceptions',(SELECT count(*) FROM mass_foundation.import_exceptions),'donors',(SELECT count(*) FROM mass_core.donors),'centres',(SELECT count(*) FROM mass_core.centres),'staff',(SELECT count(*) FROM mass_core.staff_members),'assignments',(SELECT count(*) FROM mass_core.centre_staff_assignments),'audit',(SELECT count(*) FROM mass_foundation.audit_events),'batches',(SELECT jsonb_agg(jsonb_build_object('state',state,'revision',row_version,'accepted',accepted_count,'excluded',excluded_count,'quarantined',quarantined_count)) FROM mass_foundation.import_batches),'children',(SELECT count(*) FROM mass_core.children),'auth_users',(SELECT count(*) FROM auth.users),'access_grants',(SELECT count(*) FROM mass_core.user_scope_grants));"
  before=execute(snapshot).stdout
  execute(sql,'mass_private_import')
  after=execute(snapshot).stdout
  if before!=after:raise RuntimeError('Exact retry altered counts or audit revisions.')
  counts=json.loads(after)
  expected={'donors':len(mapping['entities']['donors']),'centres':len(mapping['entities']['centres']),'staff':len(mapping['entities']['staff_members']),'assignments':len(mapping['entities']['centre_staff_assignments']),'files':1,'sheets':len(plan['sheets']),'rows':sum(len(s['rows']) for s in plan['sheets'])}
  if any(counts[k]!=v for k,v in expected.items()) or any(counts[k] for k in ('children','auth_users','access_grants')):raise RuntimeError('Counts or execution scope mismatch.')
  exposed=execute(b"SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',false); SELECT count(*) FROM mass_api.get_centre_directory();").stdout.splitlines()[-1:]==[b'0']
  anon=execute(b'SET ROLE anon; SELECT * FROM mass_api.get_centre_directory();',allow_fail=True)
  if not exposed or anon.returncode==0:raise RuntimeError('Isolated access boundary check failed.')
  report={'format':'mass-private-sql-verification-v1','sql_sha256':hashlib.sha256(sql).hexdigest(),'source_sha256':plan['source']['sha256'],'target':'fresh-local-docker-network-none-PG17','non_superuser':True,'rollback_passed':rolled_back,'exact_retry_passed':True,'no_unassigned_or_anonymous_access':True,'counts':counts,'production_execution':False}
  write_private(a.report,canonical(report)+'\n')
  print('PASS: exact private SQL, full rollback, idempotent retry, expected counts and access isolation. No hosted connection.')
 finally:command(['docker','rm','-fv',container],allow_fail=True)
if __name__=='__main__':
 try:main()
 except Exception:print('Private SQL test stopped; source contents and database errors withheld.',file=sys.stderr);raise SystemExit(1)
