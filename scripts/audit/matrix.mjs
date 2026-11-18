// No database writes or browser sign-in. Prepares scoped SQL or joins explicitly supplied private captures.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';
import {auditPlan,SAMPLE_SEED} from './plan.mjs';import {referenceSql} from './sql.mjs';
import {makeRun,scenarioKey,summarize,rowsForExport,csv} from './core.mjs';
const args=process.argv.slice(2),opt=(name,fallback=null)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const out=path.resolve(opt('out','audit-runs/april-october-selected-centres')),phase=opt('phase','prepare');
const plan=auditPlan({environment:opt('environment','production'),project:opt('project','pbkwpfdpdtelmvbkzgvx')});
await mkdir(out,{recursive:true,mode:0o700});const read=async p=>JSON.parse(await readFile(p,'utf8'));
if(phase==='prepare'){
 for(let i=0;i<plan.length;i++){const dir=path.join(out,String(i));await mkdir(dir,{recursive:true,mode:0o700});await writeFile(path.join(dir,'scenario.json'),JSON.stringify(plan[i],null,2),{mode:0o600});await writeFile(path.join(dir,'reference.sql'),referenceSql(plan[i],{eventKind:args.includes('--event-kind')}),{mode:0o600});}
 await writeFile(path.join(out,'plan.json'),JSON.stringify({sampleSeed:SAMPLE_SEED,scenarios:plan},null,2),{mode:0o600});console.log('Prepared 14 separate Leadership centre/month scenarios and two seeded role samples. No database action performed.');
}else if(phase==='collect'){
 const runs=[];
 for(let i=0;i<plan.length;i++){const dir=path.join(out,String(i)),ref=await read(path.join(dir,'reference.json'));if(scenarioKey(ref.scenario)!==scenarioKey(plan[i]))throw Error('Reference does not match planned scenario '+i);ref.sql=await readFile(path.join(dir,'reference.sql'),'utf8');
  const capture=await read(path.join(dir,'dashboard.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(capture){const after=await read(path.join(dir,'reference-after.json'));if(after.project!==ref.project||scenarioKey(after.scenario)!==scenarioKey(ref.scenario))throw Error('After reference scope differs: '+i);capture.referenceAfterFingerprint=after.fingerprint;}
  runs.push(makeRun(ref,capture));
 }
 const rows=runs.flatMap(r=>r.rows);await writeFile(path.join(out,'collection.json'),JSON.stringify({schemaVersion:1,sampleSeed:SAMPLE_SEED,runs},null,2),{mode:0o600});await writeFile(path.join(out,'summary.json'),JSON.stringify(summarize(rows),null,2),{mode:0o600});if(args.includes('--csv'))await writeFile(path.join(out,'comparisons.csv'),csv(runs.flatMap(rowsForExport)),{mode:0o600});console.log('Collected private comparisons. Missing captures remain untested; only stable before/after references certify comparisons.');
}else throw Error('Use --phase prepare or --phase collect.');
