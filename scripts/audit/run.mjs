// Read-only reference runner and joiner. Private output is always outside the source tree by default.
// node scripts/audit/run.mjs --scenario file.json --out /private/audit-run [--execute]
// node scripts/audit/run.mjs --reference reference.json [--dashboard dashboard.json] --out /private/audit-run
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {CATALOG,CUTOFF,makeRun,summarize,csv,validateScenario} from './core.mjs';
import {referenceSql} from './sql.mjs';
const args=process.argv.slice(2),option=(name,fallback=null)=>{const n=args.indexOf('--'+name);return n<0?fallback:args[n+1];};
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const out=path.resolve(option('out',path.join(process.cwd(),'audit-runs','october-2026')));
await mkdir(out,{recursive:true,mode:0o700});
if(option('scenario')) {
 const scenario=validateScenario(await read(option('scenario'))),query=referenceSql(scenario,{eventKind:args.includes('--event-kind')});
 await writeFile(path.join(out,'reference.sql'),query,{mode:0o600});
 if(args.includes('--execute')) {
  const token=process.env.MASS_AUDIT_ACCESS_TOKEN;
  if(!token)throw Error('Set MASS_AUDIT_ACCESS_TOKEN for approved read-only project access, or execute reference.sql with the connected Supabase SQL tool.');
  const response=await fetch(`https://api.supabase.com/v1/projects/${scenario.project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query})});
  if(!response.ok)throw Error(`Read-only reference extraction failed (HTTP ${response.status}); no response body or credentials logged.`);
  const result=await response.json();const reference=result.find(r=>r.audit_reference)?.audit_reference;
  if(!reference)throw Error('Reference response is missing.');
  await writeFile(path.join(out,'reference.json'),JSON.stringify(reference,null,2),{mode:0o600});
 }
}
const file=option('reference')||(args.includes('--execute')?path.join(out,'reference.json'):null);
if(file) {
 const reference=await read(file),capture=option('dashboard')?await read(option('dashboard')):null;
 if(capture&&option('reference-after')){const after=await read(option('reference-after'));if(JSON.stringify(after.scenario)!==JSON.stringify(reference.scenario))throw Error('Post-capture reference scope differs.');capture.referenceAfterFingerprint=after.fingerprint;}
 const run=makeRun(reference,capture);
 await writeFile(path.join(out,'run.json'),JSON.stringify(run,null,2),{mode:0o600});
 await writeFile(path.join(out,'comparisons.csv'),csv(run.rows),{mode:0o600});
 await writeFile(path.join(out,'summary.json'),JSON.stringify(summarize(run.rows),null,2),{mode:0o600});
}
await writeFile(path.join(out,'indicator-catalog.json'),JSON.stringify({cutoff:CUTOFF,indicators:CATALOG},null,2),{mode:0o600});
console.log('Audit files written. Live records were not changed.');
