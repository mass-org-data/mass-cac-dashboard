"""Offline reviewed installation envelope builder. Never connects to a database."""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def literal(s):return "'"+s.replace("'","''")+"'"
def prepare(output,include_proposal=False):
 output=Path(output).resolve()
 if output.is_relative_to(ROOT):raise ValueError('Generated envelopes stay outside checkout')
 frozen={line.split()[1]:line.split()[0] for line in (ROOT/'docs/readiness/2026-11-04/RELEASE.sha256').read_text().splitlines()}
 control=(ROOT/'supabase/activation/control.sql').read_text();seal=(ROOT/'supabase/activation/seal.sql').read_text()
 files=sorted((ROOT/'supabase/migrations').glob('*02[0-3]_*.sql'))
 if len(files)!=4:raise ValueError('Expected exactly020–023')
 if include_proposal:files.append(ROOT/'supabase/proposals/202611030024_reviewed_chart_metrics.sql')
 output.mkdir(parents=True,exist_ok=True,mode=0o700);manifest=[]
 for i,p in enumerate(files):
  relative=str(p.relative_to(ROOT));raw=p.read_text();digest=hashlib.sha256(p.read_bytes()).hexdigest()
  if frozen.get(relative)!=digest:raise ValueError('Frozen checksum mismatch: '+relative)
  if raw.count('BEGIN;')!=1 or raw.count('COMMIT;')!=1 or not raw.rstrip().endswith('COMMIT;'):raise ValueError('Unexpected transaction boundary')
  version,name=p.stem.split('_',1)
  # 024 remains an explicitly separate proposal envelope, never auto-included.
  if i==4:name='reviewed_chart_metrics_activation_proposal'
  prefix=f"""\nSET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(hashtextextended('MASS.reviewed.installation',0));
DO $ledger$ BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>{19+i} OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version={literal(version)}) THEN
 RAISE EXCEPTION 'Unexpected migration ledger; stop and reconcile, never replay';END IF;
END;$ledger$;
"""
  for previous in files[:i]:
   previous_version,previous_name=previous.stem.split('_',1)
   prefix+="DO $predecessor$ BEGIN IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version="+literal(previous_version)+" AND name="+literal(previous_name)+") THEN RAISE EXCEPTION 'Predecessor ledger mismatch';END IF;END;$predecessor$;\n"
  if i==0:
   prior_names=[p.stem for p in sorted((ROOT/'supabase/migrations').glob('*.sql'))[:17]]
   prefix+="DO $baseline$ BEGIN IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE name=ANY(ARRAY["+','.join(literal(n) for n in prior_names)+"]))<>17 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='202610280018') OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='202610280019') THEN RAISE EXCEPTION 'Baseline aliases/definitions require reconciliation';END IF;END;$baseline$;\n"
   prefix+='RESET ROLE;\n'+control+'\n'
  body=raw.replace('BEGIN;','BEGIN;\n'+prefix,1)
  ledger="RESET ROLE;\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES("+literal(version)+','+literal(name)+',ARRAY['+','.join(literal(x) for x in [raw,control if i==0 else '',seal])+']);\n'
  body=body.rsplit('COMMIT;',1)[0]+seal+'\n'+ledger+'COMMIT;\n'
  target=output/p.name;target.write_text(body);target.chmod(0o600)
  manifest.append({'source':relative,'source_sha256':digest,'envelope':p.name,'envelope_sha256':hashlib.sha256(body.encode()).hexdigest(),'separate_proposal':i==4})
 (output/'ENVELOPES.json').write_text(json.dumps({'control_sha256':hashlib.sha256(control.encode()).hexdigest(),'seal_sha256':hashlib.sha256(seal.encode()).hexdigest(),'files':manifest},indent=2)+'\n')
 return manifest
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True);parser.add_argument('--include-proposal-024',action='store_true');a=parser.parse_args();print(json.dumps(prepare(a.output,a.include_proposal_024),indent=2))
