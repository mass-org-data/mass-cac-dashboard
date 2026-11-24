import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {PGlite} from '@electric-sql/pglite';
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mass-monthly-test-'));fs.chmodSync(tmp,0o700);
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),db=new PGlite();await db.waitReady;let checks=0;
const ok=(x)=>{assert.ok(x);checks++;},error=async(code,sql)=>{await assert.rejects(()=>db.exec(sql),e=>e.code===code);checks++;};
try{
 await db.exec(read('tests/core/bootstrap.sql'));
 for(const name of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&n<'202610290000').sort())await db.exec(read('supabase/migrations/'+name));
 await db.exec(read('supabase/migrations/20261123052939_monthly_activity_history.sql'));
 await db.exec(`INSERT INTO auth.users(id) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,6)n;
 INSERT INTO mass_core.centres(id,label) VALUES('10000000-0000-4000-8000-000000000001','Synthetic A'),('10000000-0000-4000-8000-000000000002','Synthetic B');
 INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at,can_read_profiles) VALUES
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Teacher','2000-01-01','00000000-0000-4000-8000-000000000006','2000-01-01',true),
 ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Teacher','2000-01-01','00000000-0000-4000-8000-000000000006','2000-01-01',true);
 INSERT INTO mass_core.children(id,student_id) VALUES('20000000-0000-4000-8000-000000000001','ST_SY_1_01'),('20000000-0000-4000-8000-000000000002','ST_SY_2_01');
 INSERT INTO mass_core.private_child_profiles(child_id,full_name,gender_code) VALUES('20000000-0000-4000-8000-000000000001','Synthetic One','Girl'),('20000000-0000-4000-8000-000000000002','Synthetic Two','Boy');
 INSERT INTO mass_core.enrolments(id,child_id,centre_id,grade_label,shift_code,starts_on,ends_before,status_code) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','2027-04-01','Active'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','2','Evening','2026-04-01','2027-04-01','Active');`);
 execFileSync('python',['-c',`import sys,json,pathlib,datetime,openpyxl
sys.path.insert(0,'scripts/imports')
from monthly_activity import prepare,render
p=pathlib.Path(sys.argv[1]);w=openpyxl.Workbook();s=w.active;s.title='Fanuc_Monthly Activity'
s.append(['Monthly Activity Participation Sheet']);s.append(['Month',datetime.date(2026,10,1)]);s.append([]);s.append(['Center Name','Student Name','Class','Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2'])
s.append(['Synthetic A','Synthetic One','Grade 1','Yes','No',None,'No']);s.append(['Synthetic A','Synthetic Two','Grade 2','No','Yes','Yes','No']);w.save(p/'source.xlsx')
roster=[dict(child_id='20000000-0000-4000-8000-00000000000'+str(i),enrolment_id='30000000-0000-4000-8000-00000000000'+str(i),centre_id='10000000-0000-4000-8000-000000000001',donor='Fanuc',centre='Synthetic A',full_name='Synthetic '+['One','Two'][i-1],grade=str(i),shift=['Morning','Evening'][i-1],starts_on='2026-04-01',ends_before='2027-04-01') for i in [1,2]]
plan=prepare(p/'source.xlsx',roster,b'synthetic-key');assert len(plan['rows'])==2;assert plan['rows'][0]['sports_1'] is None
(p/'plan.sql').write_text(render(plan));(p/'plan.json').write_text(json.dumps(plan))
s.append(['Synthetic A','Synthetic One','Grade 1','Yes','No','No','No']);w.save(p/'duplicate.xlsx');duplicate=prepare(p/'duplicate.xlsx',roster,b'synthetic-key');assert len(duplicate['rows'])==1 and len(duplicate['held'])==2
`,tmp],{cwd:root});checks+=3;
 const sql=fs.readFileSync(path.join(tmp,'plan.sql'),'utf8');await db.exec(sql.replace(/COMMIT;\s*$/,'ROLLBACK;'));ok(Number((await db.query('SELECT count(*) n FROM mass_import.monthly_activity_history')).rows[0].n)===0);
 await db.exec(sql);await db.exec(sql);ok(Number((await db.query('SELECT count(*) n FROM mass_import.monthly_activity_history')).rows[0].n)===2);
 const summary=`SELECT * FROM mass_api.monthly_activity_history_summary(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01')`;
 await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',false);`);
 let rows=(await db.query(summary)).rows;ok(rows.length===2);ok(rows.reduce((n,r)=>n+Number(r.missing_responses),0)===1);ok(rows.reduce((n,r)=>n+Number(r.students_at_least_two),0)===1);
 await error('42501','SELECT * FROM mass_import.monthly_activity_history');await error('42501',summary.replace('000000000001','000000000002'));
 await db.exec('RESET ROLE;SET ROLE anon;');await error('42501',summary);await db.exec('RESET ROLE;SET ROLE service_role;');await error('42501',summary);await db.exec('RESET ROLE;');
 await error('55000','UPDATE mass_import.monthly_activity_history SET cultural_1=false');await error('55000','DELETE FROM mass_import.monthly_activity_history');await error('55000','TRUNCATE mass_import.monthly_activity_history');
 const bad=sql.replace('"cultural_1":true','"cultural_1":false');await assert.rejects(()=>db.exec(bad),/retry conflict/);checks++;await db.exec('ROLLBACK;');
 ok((await db.query("SELECT bool_and(relrowsecurity AND relforcerowsecurity) ok FROM pg_class WHERE oid='mass_import.monthly_activity_history'::regclass")).rows[0].ok);
 console.log(`PASS ${checks} monthly activity checks: rollback, exact retry, source conflicts, boolean/null preservation, duplicates, scoped aggregate reads and direct-access denial.`);
}finally{await db.close();fs.rmSync(tmp,{recursive:true,force:true});}
