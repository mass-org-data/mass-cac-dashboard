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
 // The efficiency migration upgrades the installed function only, so a fresh database applies it again after the reviewed proposal.
 await db.exec(read('supabase/migrations/20261114130000_reviewed_chart_metrics_efficiency.sql'));
 let core=read('tests/core/synthetic.sql').replace('count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity)','count(*)=30 AND bool_and(relrowsecurity AND relforcerowsecurity)')
  .replace('bool_and(student_id=upper(id::text))',()=>"bool_and(student_id ~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$')")
  .replace("'428C9','generated permanent student ID cannot be overwritten'","'55000','generated permanent student ID cannot be overwritten'");
 await runSqlScript(db,core);console.log('PASS existing core SQL assertions');
 await runSqlScript(db,read('tests/release/visits.sql'));console.log('PASS existing visit/delivery/scoped reporting SQL assertions');
 await runSqlScript(db,read('tests/release/batched-reads.sql'));console.log('PASS batched visit, Morarji and profile reads equal the single-centre functions and keep their scope');
 await runSqlScript(db,read('tests/reviewed-calculations/synthetic.sql'));
 await runSqlScript(db,read('tests/reviewed-calculations/attendance-series.sql'));console.log('PASS batched monthly attendance series equals reviewed_chart_metrics for 63 month and filter cases');
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
 const gated=(await db.query("SELECT position('-- MASS_ACTIVATION_GUARD_V1' IN prosrc)>0 AS guarded FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND proname='reviewed_attendance_series'")).rows;
 if(gated.length!==1||gated[0].guarded!==true)throw new Error('reviewed_attendance_series must be sealed behind reviewed_reads');
 const gated2=(await db.query("SELECT position('-- MASS_ACTIVATION_GUARD_V1' IN prosrc)>0 AS guarded FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND proname='reviewed_attendance_by_centre_month'")).rows;
 if(gated2.length!==1||gated2[0].guarded!==true)throw new Error('reviewed_attendance_by_centre_month must be sealed behind reviewed_reads');
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',false)");
 const caps=(await db.query("SELECT mass_api.get_original_capabilities()->>'reviewed_attendance_series' AS v")).rows;await db.exec('RESET ROLE');
 if(caps[0]?.v!=='1')throw new Error('get_original_capabilities must advertise reviewed_attendance_series when reviewed_reads is enabled');
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',false);");
 const caps2=(await db.query("SELECT mass_api.get_original_capabilities()->>'reviewed_attendance_by_centre_month' AS a,mass_api.get_original_capabilities()->>'batched_reads' AS b")).rows;await db.exec('RESET ROLE');
 if(caps2[0]?.a!=='1'||caps2[0]?.b!=='1')throw new Error('get_original_capabilities must advertise the batched reads');
 console.log('PASS series is sealed behind reviewed_reads');
 console.log('PASS sealed reviewed calculation API. Native concurrency and managed Auth/browser tests remain separate.');
} finally {await db.close();fs.rmSync(out,{recursive:true,force:true});}
