"""Private, read-only scope audit. No account/permission or programme mutations."""
import argparse,collections,json,os,urllib.request,urllib.error
from pathlib import Path
QUERY="""SELECT jsonb_build_object('captured_at',statement_timestamp(),'principal',current_user,'read_only',current_setting('transaction_read_only'),'grants',(SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('auth_exists',u.id IS NOT NULL,'banned_until',u.banned_until,'deleted_at',u.deleted_at)) FROM mass_core.user_scope_grants g LEFT JOIN auth.users u ON u.id=g.user_id),'api_acl',(SELECT jsonb_agg(jsonb_build_object('name',proname,'arguments',pg_get_function_identity_arguments(oid),'authenticated',has_function_privilege('authenticated',oid,'EXECUTE'),'anon',has_function_privilege('anon',oid,'EXECUTE'),'service',has_function_privilege('service_role',oid,'EXECUTE'))) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace),'owner_memberships',(SELECT count(*) FROM pg_roles c CROSS JOIN pg_roles o WHERE c.rolname IN ('authenticated','anon','service_role') AND o.rolname IN ('mass_core_owner','mass_foundation_owner') AND (pg_has_role(c.oid,o.oid,'SET') OR pg_has_role(c.oid,o.oid,'USAGE')))) audit"""
def analyze(data):
 from datetime import datetime
 now=datetime.fromisoformat(data['captured_at']);active=lambda g:datetime.fromisoformat(g['starts_at'])<=now and (not g['ends_at'] or now<datetime.fromisoformat(g['ends_at']))
 grants=data.get('grants') or [];users=collections.defaultdict(list)
 for g in grants:users[g['user_id']].append(g)
 private=[]
 for user,rows in users.items():
  current=[g for g in rows if active(g)];lead=any(g['role_code']=='Leadership' for g in current)
  for g in rows:
   readable=active(g);write=readable and not lead and g['role_code'] in ('Teacher','Cluster Officer');profile=not lead and any(active(h) and h['can_read_profiles'] and h['role_code'] in ('Teacher','Cluster Officer') for h in rows)
   private.append({'user_id':user,'grant_id':g['id'],'centre_id':g['centre_id'],'role':g['role_code'],'active':readable,'auth_exists':g['auth_exists'],'auth_banned_until':g['banned_until'],'auth_deleted_at':g['deleted_at'],'read_scope':readable,'write_scope':write,'profile_scope_some_enrolment_centre':profile,'grant_profile_capability':g['can_read_profiles'],'officer_role':write and g['role_code']=='Cluster Officer','leadership_veto':lead,'post_sealed_install_writes':False,'conditions':'Managed authenticated session; target child/enrolment must independently satisfy current scope/profile predicates. Visit writes additionally need verified dated officer assignment. Auth existence is not proof of usable login/session.'})
 summary={'grant_rows':len(grants),'active_grants':sum(active(g) for g in grants),'distinct_users':len(users),'roles':dict(collections.Counter(g['role_code'] for g in grants if active(g))),'users_with_any_write_scope':len({r['user_id'] for r in private if r['write_scope']}),'users_with_leadership_veto':len({r['user_id'] for r in private if r['leadership_veto']}),'owner_memberships':data['owner_memberships'],'missing_auth_accounts':len({g['user_id'] for g in grants if not g['auth_exists']}),'post_sealed_install_write_users':0,'read_only':data['read_only']}
 return private,summary
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args();out=a.output.resolve()
 if out.is_relative_to(Path(__file__).resolve().parents[2]):raise SystemExit('Private evidence must stay outside checkout')
 out.mkdir(parents=True,exist_ok=True,mode=0o700)
 req=urllib.request.Request('https://api.supabase.com/v1/projects/pbkwpfdpdtelmvbkzgvx/database/query',data=json.dumps({'query':QUERY,'read_only':True}).encode(),headers={'Authorization':'Bearer '+os.environ['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=30) as r:data=json.load(r)[0]['audit']
 except urllib.error.HTTPError as error:
  receipt={'status':'unavailable','http_status':error.code,'read_only_attempt':True,'grant_snapshot_captured':False}
  (out/'inspection-status.json').write_text(json.dumps(receipt));print(json.dumps(receipt));raise SystemExit(1)
 private,summary=analyze(data)
 for name,value in [('scope.private.json',data),('authorization.private.json',private),('summary.json',summary)]:
  dest=out/name;dest.write_text(json.dumps(value,indent=2));dest.chmod(0o600)
 print(json.dumps(summary))
