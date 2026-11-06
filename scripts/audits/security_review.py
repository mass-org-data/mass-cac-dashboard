"""Read-only hosted advisor/catalog evidence. Private source bodies stay outside Git."""
import argparse,hashlib,json,os,urllib.request
from pathlib import Path
BASE='https://api.supabase.com/v1/projects/pbkwpfdpdtelmvbkzgvx'
CATALOG="""SELECT n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.proconfig settings,p.prosrc body,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,has_function_privilege('service_role',p.oid,'EXECUTE') service_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('mass_core','mass_api','mass_foundation','mass_import') ORDER BY 1,2,3"""
def get(path,payload=None):
 r=urllib.request.Request(BASE+path,data=json.dumps(payload).encode() if payload else None,headers={'Authorization':'Bearer '+os.environ['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=60) as f:return json.load(f)
def capture(output):
 output=Path(output).resolve()
 if output.is_relative_to(Path(__file__).resolve().parents[2]):raise ValueError('Private evidence must stay outside checkout')
 output.mkdir(parents=True,exist_ok=True,mode=0o700)
 functions=get('/database/query',{'query':CATALOG,'read_only':True});advisors=get('/advisors/security')
 for name,obj in [('functions',functions),('advisors',advisors)]:
  f=output/(name+'.private.json');f.write_text(json.dumps(obj,indent=2));f.chmod(0o600)
 flagged={x.get('metadata',{}).get('name') for x in advisors.get('lints',[]) if x['name']=='authenticated_security_definer_function_executable'}
 public=[]
 for f in functions:
  if f['schema']=='mass_api' and f['security_definer'] and f['name'] in flagged:
   public.append({k:f[k] for k in ['schema','name','arguments','owner','settings','authenticated_execute','anon_execute','service_execute']}|{'body_sha256':hashlib.sha256(f['body'].encode()).hexdigest()})
 summary={'project':'pbkwpfdpdtelmvbkzgvx','read_only':True,'advisor_names':[x['name'] for x in advisors.get('lints',[])],'flagged_functions':public,'boundary':'Catalog and advisor inspection only; function ownership/ACLs are not proof of hosted staff-session or DDL execution.'}
 (output/'security-summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps({'advisor_warnings':len(advisors.get('lints',[])),'flagged_api_functions':len(public),'private_evidence_written':True}))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);a=p.parse_args();capture(a.output)
