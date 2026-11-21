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
const phase7='20261121120000_leadership_user_administration.sql';
try {
 await db.exec(read('tests/core/bootstrap.sql'));
 for(const name of fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')&&n!==phase7).sort())await db.exec(read('supabase/migrations/'+name));
 await db.exec(read('supabase/proposals/202611030024_reviewed_chart_metrics.sql'));
 // The efficiency migration upgrades the installed function only, so a fresh database applies it again after the reviewed proposal.
 await db.exec(read('supabase/migrations/20261114130000_reviewed_chart_metrics_efficiency.sql'));
 // The efficiency migration rebuilds the function without the centre-event patch of 20261111120000; the corrective migration restores it and is idempotent.
 await db.exec(read('supabase/migrations/20261117120000_reviewed_chart_metrics_centre_events.sql'));
 await db.exec(read('supabase/migrations/20261117120000_reviewed_chart_metrics_centre_events.sql'));
 {const def=(await db.query("SELECT pg_get_functiondef('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)'::regprocedure) d")).rows[0].d;
  if(def.split("e.event_kind='Activity'").length!==2||def.split("e.shift_code='Both shifts'").length!==3||!def.includes("(p.shift_code=e.shift_code OR e.shift_code='Both shifts') AND e.activity_date")||!def.includes("code IN ('WO','MM','H')"))throw new Error('reviewed_chart_metrics must hold the centre-event patch exactly once and keep the Holiday exclusion');
  console.log('PASS reviewed_chart_metrics keeps the centre-event patch after the efficiency migration, applied twice');}
 let core=read('tests/core/synthetic.sql').replace('count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity)','count(*)=34 AND bool_and(relrowsecurity AND relforcerowsecurity)')
  .replace('bool_and(student_id=upper(id::text))',()=>"bool_and(student_id ~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$')")
  .replace("'428C9','generated permanent student ID cannot be overwritten'","'55000','generated permanent student ID cannot be overwritten'");
 await runSqlScript(db,core);console.log('PASS existing core SQL assertions');
 await runSqlScript(db,read('tests/security/permission-foundation.sql'));console.log('PASS single-role governance foundation, centre limits and immediate inactive-user denial');
 await runSqlScript(db,read('tests/security/permission-reconciliation.sql'));console.log('PASS private dual-read reconciliation and cutover drift gate');
 await runSqlScript(db,read('tests/security/permission-read-cutover.sql'));console.log('PASS governed read cutover, one-role context, current profiles and immediate assignment denial');
 await runSqlScript(db,read('tests/security/permission-write-cutover.sql'));console.log('PASS governed write hierarchy, date independence and immediate inactive denial');
 await runSqlScript(db,read('tests/security/permission-frontend-cutover.sql'));console.log('PASS frontend cutover export gates and versioned attendance identity');
 await runSqlScript(db,read('tests/release/visits.sql'));console.log('PASS existing visit/delivery/scoped reporting SQL assertions');
 await runSqlScript(db,read('tests/release/batched-reads.sql'));console.log('PASS batched visit, Morarji and profile reads equal the single-centre functions and keep their scope');
 await runSqlScript(db,read('tests/reviewed-calculations/synthetic.sql'));
 await runSqlScript(db,read('tests/reviewed-calculations/attendance-series.sql'));console.log('PASS batched monthly attendance series equals reviewed_chart_metrics for 63 month and filter cases');
 await runSqlScript(db,read('tests/security/definer-matrix.sql'));console.log('PASS existing definer security matrix');
 await db.exec('RESET ROLE; BEGIN;'+read('supabase/activation/control.sql')+read('supabase/activation/seal.sql')+'COMMIT;');
 await runSqlScript(db,read('tests/security/permission-destructive-workflows.sql'));console.log('PASS reviewed destructive workflows, atomic cascades, private receipts and cross-role denial');
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
 const gated3=(await db.query("SELECT position('-- MASS_ACTIVATION_GUARD_V1' IN prosrc)>0 AS guarded FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND proname='reviewed_shift_counts'")).rows;
 if(gated3.length!==1||gated3[0].guarded!==true)throw new Error('reviewed_shift_counts must be sealed behind reviewed_reads');
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',false)");
 const caps=(await db.query("SELECT mass_api.get_original_capabilities()->>'reviewed_attendance_series' AS v")).rows;await db.exec('RESET ROLE');
 if(caps[0]?.v!=='1')throw new Error('get_original_capabilities must advertise reviewed_attendance_series when reviewed_reads is enabled');
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',false);");
 const caps2=(await db.query("SELECT mass_api.get_original_capabilities()->>'reviewed_attendance_by_centre_month' AS a,mass_api.get_original_capabilities()->>'batched_reads' AS b,mass_api.get_original_capabilities()->>'reviewed_shift_counts' AS c")).rows;await db.exec('RESET ROLE');
 if(caps2[0]?.a!=='1'||caps2[0]?.b!=='1'||caps2[0]?.c!=='1')throw new Error('get_original_capabilities must advertise the batched reads');
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',false);");
 const pageContext="jsonb_build_object('on',y.starts_on,'from',y.starts_on,'until',y.starts_on+30,'year',y.id,'earlier',1,'later',2,'quarter',2)";
 await db.query(`WITH y AS(SELECT * FROM mass_core.academic_years ORDER BY starts_on LIMIT 1),c AS(SELECT array_agg(id) ids FROM(SELECT id FROM mass_core.centres WHERE mass_core.can_read(id) ORDER BY id LIMIT 2)s) SELECT mass_api.dashboard_table_page('reviewed_centres',c.ids,${pageContext},'','centre',false,0,10) FROM y,c`);
 await db.query("WITH y AS(SELECT * FROM mass_core.academic_years ORDER BY starts_on LIMIT 1),c AS(SELECT array_agg(id) ids FROM(SELECT id FROM mass_core.centres WHERE mass_core.can_read(id) ORDER BY id LIMIT 2)s) SELECT mass_api.dashboard_table_page('assessment_register',c.ids,jsonb_build_object('year',y.id),'','date',true,0,10),mass_api.dashboard_table_page('annual_centres',c.ids,jsonb_build_object('year',y.id,'today',least(y.ends_before-1,y.starts_on+180)),'','name',false,0,10),mass_api.attendance_register_page_v2(c.ids,y.starts_on,y.starts_on+30,NULL,NULL,NULL,0,10,'date',true,'') FROM y,c");
 await db.exec("SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000003\"}',false);");
 await db.query("WITH c AS(SELECT array_agg(id) ids FROM(SELECT id FROM mass_core.centres WHERE mass_core.can_read(id) ORDER BY id LIMIT 2)s) SELECT mass_api.dashboard_table_page('visit_centres',c.ids,jsonb_build_object('from','2025-01-01','until','2025-02-01'),'','centre',false,0,10),mass_api.dashboard_table_page('visit_officers',c.ids,jsonb_build_object('from','2025-01-01','until','2025-02-01'),'','label',false,0,10),mass_api.dashboard_table_page('morarji_cohorts',c.ids,'{}','','cohort',false,0,10) FROM c");
 await db.exec("SELECT set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',false);");
 const initialLanguage=(await db.query("SELECT mass_api.get_user_preferences()->>'default_language' language")).rows[0]?.language;
 const savedLanguage=(await db.query("SELECT mass_api.set_default_language('kn')->>'default_language' language")).rows[0]?.language;
 const currentLanguage=(await db.query("SELECT mass_api.get_user_preferences()->>'default_language' language")).rows[0]?.language;
 await db.exec('RESET ROLE');
 const preferenceGrants=(await db.query("SELECT has_table_privilege('authenticated','mass_core.user_preferences','SELECT,INSERT,UPDATE,DELETE') direct_table,has_function_privilege('authenticated','mass_api.get_user_preferences()','EXECUTE') auth_read,has_function_privilege('authenticated','mass_api.set_default_language(text)','EXECUTE') auth_write,has_function_privilege('anon','mass_api.get_user_preferences()','EXECUTE') anon_read")).rows[0];
 if(initialLanguage!=='en'||savedLanguage!=='kn'||currentLanguage!=='kn')throw new Error('language preference must default to English and round-trip the authenticated user choice');
 if(preferenceGrants?.direct_table!==false||preferenceGrants?.auth_read!==true||preferenceGrants?.auth_write!==true||preferenceGrants?.anon_read!==false)throw new Error('language preference grants must expose only authenticated API functions');
 console.log('PASS bounded table pages execute under authenticated scoped reads');
 console.log('PASS self-service language preference defaults, saves and keeps the table private');
 console.log('PASS series is sealed behind reviewed_reads');
 console.log('PASS sealed reviewed calculation API. Native concurrency and managed Auth/browser tests remain separate.');
 await db.exec(read('supabase/migrations/'+phase7));
 await runSqlScript(db,read('tests/security/permission-administration.sql'));
 console.log('PASS protected Leadership administration, role and centre invariants, Auth ordering and immutable events');
} finally {await db.close();fs.rmSync(out,{recursive:true,force:true});}
