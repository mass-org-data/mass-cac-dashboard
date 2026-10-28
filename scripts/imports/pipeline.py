"""Private source stage -> review -> preview -> approved SQL; never connects to a DB."""
import argparse,hashlib,json,os,sys
from pathlib import Path
from common import Invalid,canonical,digest,read_private,write_private
from stage import stage
from review import scaffold,preview
from render import render

def load(p):return json.loads(read_private(p).read_text())
def main():
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='command',required=True)
 q=sub.add_parser('init-key');q.add_argument('--out',required=True)
 q=sub.add_parser('stage');q.add_argument('--workbook',required=True);q.add_argument('--layout',required=True);q.add_argument('--key',required=True);q.add_argument('--out',required=True)
 q=sub.add_parser('review-template');q.add_argument('--plan',required=True);q.add_argument('--out',required=True)
 q=sub.add_parser('directory-review');q.add_argument('--plan',required=True);q.add_argument('--decision-ref',required=True);q.add_argument('--out',required=True);q.add_argument('--exceptions-out',required=True)
 q=sub.add_parser('approval-template');q.add_argument('--plan',required=True);q.add_argument('--mapping',required=True);q.add_argument('--out',required=True)
 q=sub.add_parser('preview');q.add_argument('--plan',required=True);q.add_argument('--mapping');q.add_argument('--out',required=True)
 q=sub.add_parser('render');q.add_argument('--plan',required=True);q.add_argument('--mapping',required=True);q.add_argument('--approval',required=True);q.add_argument('--workbook',required=True);q.add_argument('--out',required=True)
 q=sub.add_parser('student-stage')
 for name in ('staging','directory','source-plan','centres','source-rows','key','out','sql-out'):q.add_argument('--'+name,required=True)
 q=sub.add_parser('history-stage')
 for name in ('students','attendance','assessment','morarji','key','out','provenance-out','sql-directory'):q.add_argument('--'+name,required=True)
 a=p.parse_args()
 try:
  if a.command=='init-key':
   # A fresh key is generated once, never printed. Preserve it privately for retries.
   out=Path(a.out).resolve();from common import private_path
   private_path(out);out.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
   if out.parent.stat().st_mode&0o077:raise Invalid('Key directory must have mode 0700.')
   fd=os.open(out,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
   with os.fdopen(fd,'wb') as f:f.write(os.urandom(32))
  elif a.command=='stage':
   plan=stage(a.workbook,load(a.layout),read_private(a.key).read_bytes());write_private(a.out,canonical(plan)+'\n')
   print('Source staged privately. Candidates:',preview(plan)['candidate_source_rows'])
  elif a.command=='review-template':write_private(a.out,canonical(scaffold(load(a.plan)))+'\n')
  elif a.command=='directory-review':
   from directory_decisions import association_review
   mapping,report=association_review(load(a.plan),a.decision_ref)
   write_private(a.out,canonical(mapping)+'\n');write_private(a.exceptions_out,canonical(report)+'\n')
   print('Private association review prepared; staff identities remain deferred. No execution approval or database connection.')
  elif a.command=='approval-template':
   plan=load(a.plan);mapping=load(a.mapping)
   approval={'plan_digest':digest(plan),'mapping_digest':digest(mapping),'scope':'directory-only','approved':False,'reviewer_ref':'','decision_ref':'',**{k:False for k in ('identity_reviewed','source_provenance_reviewed','single_donor_reviewed','regions_reviewed','shifts_reviewed','directory_privacy_approved')}}
   write_private(a.out,canonical(approval)+'\n')
  elif a.command=='preview':
   result=preview(load(a.plan),load(a.mapping) if a.mapping else None);write_private(a.out,canonical(result)+'\n');print('Preview written; not approval. No database connection.')
  elif a.command=='student-stage':
   from students import prepare,render as student_sql
   result=prepare(read_private(a.staging),read_private(a.directory),load(a.source_plan),load(a.centres),load(a.source_rows),read_private(a.key).read_bytes())
   write_private(a.out,canonical(result)+'\n');write_private(a.sql_out,student_sql(result));print('Student staging prepared privately:',canonical(result['counts']))
  elif a.command=='history-stage':
   from history import prepare
   from history_sql import provenance,chunk
   from common import private_path
   result=prepare({k:read_private(getattr(a,k)) for k in ('attendance','assessment','morarji')},load(a.students)['rows'],read_private(a.key).read_bytes())
   write_private(a.out,canonical(result)+'\n');write_private(a.provenance_out,provenance(result))
   folder=private_path(a.sql_directory);folder.mkdir(mode=0o700,parents=True,exist_ok=True)
   for i in range(0,len(result['accepted']),1000):write_private(folder/f'{i//1000+1:03d}.private.sql',chunk(result['accepted'][i:i+1000]))
   print('Historical staging prepared privately:',canonical(result['summary']))
  else:
   plan=load(a.plan)
   if hashlib.sha256(read_private(a.workbook).read_bytes()).hexdigest()!=plan['source']['sha256']:raise Invalid('Workbook changed after review; restage and reapprove.')
   sql=render(plan,load(a.mapping),load(a.approval));write_private(a.out,sql);print('Approved private data SQL rendered; no execution or database connection.')
 except Exception:
  # Never echo file contents, raw values, paths or rejected source tuples in logs.
  print('Import preparation stopped: private input/approval validation failed. Inspect privately; no database execution.',file=sys.stderr);return 2
 return 0
if __name__=='__main__':raise SystemExit(main())
