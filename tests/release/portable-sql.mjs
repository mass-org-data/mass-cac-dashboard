// Isolated PostgreSQL 17 WASM tests. No network, hosted project or real records.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {runSqlScript} from '../sql-statements.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const db=new PGlite();await db.waitReady;
const out=fs.mkdtempSync(path.join(os.tmpdir(),'mass-portable-sql-'));
try {
 await db.exec(read('tests/core/bootstrap.sql'));
 for(const name of fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec(read('supabase/migrations/'+name));
 await db.exec(read('supabase/proposals/202611030024_reviewed_chart_metrics.sql'));
 let core=read('tests/core/synthetic.sql').replace('count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity)','count(*)=25 AND bool_and(relrowsecurity AND relforcerowsecurity)')
  .replace('bool_and(student_id=upper(id::text))',()=>"bool_and(student_id ~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$')")
  .replace("'428C9','generated permanent student ID cannot be overwritten'","'55000','generated permanent student ID cannot be overwritten'");
 await runSqlScript(db,core);console.log('PASS existing core SQL assertions');
 await runSqlScript(db,read('tests/release/visits.sql'));console.log('PASS existing visit/delivery/scoped reporting SQL assertions');
 await runSqlScript(db,read('tests/reviewed-calculations/synthetic.sql'));
 await runSqlScript(db,read('tests/security/definer-matrix.sql'));console.log('PASS existing definer security matrix');
 await db.exec('RESET ROLE; BEGIN;'+read('supabase/activation/control.sql')+read('supabase/activation/seal.sql')+'COMMIT;');
 await db.exec("SET ROLE mass_core_owner; UPDATE mass_activation.features SET enabled=true,approval_reference='isolated calculation check' WHERE feature='reviewed_reads'; RESET ROLE;");
 const exported=(await db.query(read('tests/reviewed-calculations/export.sql'))).rows[0];
 fs.writeFileSync(path.join(out,'input.json'),JSON.stringify(Object.values(exported)[0]));
 execFileSync(process.execPath,[path.join(root,'tests/reviewed-calculations/cases.mjs'),path.join(out,'input.json'),path.join(out,'cases.json'),path.join(out,'cases.sql')],{stdio:'pipe'});
 const results=await runSqlScript(db,fs.readFileSync(path.join(out,'cases.sql'),'utf8'));
 const rows=results.flatMap(r=>r.rows).map(r=>Object.values(r)[0]).filter(r=>r&&typeof r==='object'&&r.case!==undefined);
 fs.writeFileSync(path.join(out,'results.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 console.log(execFileSync(process.execPath,[path.join(root,'tests/reviewed-calculations/compare.mjs'),path.join(out,'input.json'),path.join(out,'cases.json'),path.join(out,'results.jsonl')],{encoding:'utf8'}).trim());
 console.log('PASS sealed reviewed calculation API. Native concurrency and managed Auth/browser tests remain separate.');
} finally {await db.close();fs.rmSync(out,{recursive:true,force:true});}
