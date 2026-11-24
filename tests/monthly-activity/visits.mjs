import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.waitReady;
const read=p=>fs.readFileSync(p,'utf8');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mass-historical-visits-'));let checks=0;
const ok=x=>{assert.ok(x);checks++;};
const error=async(code,sql)=>{await assert.rejects(()=>db.exec(sql),e=>e.code===code);checks++;};
try{
 await db.exec(read('tests/core/bootstrap.sql'));
 for(const n of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&n<'202610290000').sort())await db.exec(read('supabase/migrations/'+n));
 await db.exec(read('supabase/migrations/20261124062419_historical_officer_visits.sql'));
 await db.exec(`INSERT INTO mass_core.centres(id,label) VALUES('10000000-0000-4000-8000-000000000001','Synthetic Centre');`);
 execFileSync('python',['-c',`import sys,json,pathlib,datetime,openpyxl
sys.path.insert(0,'scripts/imports')
from historical_visits import prepare,render
p=pathlib.Path(sys.argv[1]);w=openpyxl.Workbook();s=w.active;s.title='Fanuc-Visit Log'
for r in [['Visit log'],['Officer Name','Synthetic Ofcer'],['Area','Synthetic'],['Visits logged',0],[],['Visit Date','Center Name','Shift','Remarks']]:s.append(r)
for r in [[datetime.date(2026,10,5),'Synthetic Cntr','Morning',None],[datetime.date(2026,10,6),'Synthetic Cntr','Evening','Observed'],[None,'Synthetic Cntr','Morning',None],[datetime.date(2026,10,7),'Synthetic Cntr','Morning',None],[datetime.date(2026,10,7),'Synthetic Cntr','Morning',None],[datetime.date(2026,10,8),'Example','Morning',None]]:s.append(r)
w.save(p/'source.xlsx')
review={'values':[['Issue ID','Issue type','Donor / area','Source tab and cells','Visit workbook value','Supabase / other value','Correct value — MASS'],['C01','Centre spelling','Fanuc','Fanuc-Visit Log!B7','Synthetic Cntr','Synthetic Centre','Confirmed Centre'],['O01','Officer spelling','Fanuc','Fanuc-Visit Log!B2','Synthetic Ofcer','Synthetic Officer','Synthetic Officer']]}
database={'centres':[{'id':'10000000-0000-4000-8000-000000000001','name':'Synthetic Centre','donor':'Fanuc'}],'staff':[{'id':'20000000-0000-4000-8000-000000000001','name':'Synthetic Officer'}]}
plan=prepare(p/'source.xlsx',review,database,b'synthetic-key')
assert len(plan['visits'])==2 and len(plan['assignments'])==1 and len(plan['held'])==3 and plan['excluded_examples']==1
assert plan['assignments'][0]['confirmed_centre_name']=='Confirmed Centre'
assert plan['visits'][0]['remarks'] is None
(p/'plan.sql').write_text(render(plan));(p/'plan.json').write_text(json.dumps(plan))
review['values'][1][6]=''
try:prepare(p/'source.xlsx',review,database,b'synthetic-key');raise AssertionError('blank review accepted')
except ValueError:pass
`,tmp]);checks+=4;
 const sql=fs.readFileSync(path.join(tmp,'plan.sql'),'utf8');const plan=JSON.parse(fs.readFileSync(path.join(tmp,'plan.json'),'utf8'));
 await db.exec(sql.slice(0,sql.indexOf('GRANT mass_data_importer TO'))+`RESET ROLE; INSERT INTO mass_core.staff_members(id,display_name,source_name,source_row_id,source_slot) VALUES('20000000-0000-4000-8000-000000000001','Synthetic Officer','Synthetic Officer','${plan.files[1].sheets[0].rows[0].id}',1);COMMIT;`);
 const count=async t=>Number((await db.query(`SELECT count(*) n FROM mass_import.${t}`)).rows[0].n);
 await db.exec(sql.replace(/COMMIT;\s*$/,'ROLLBACK;'));ok(await count('historical_officer_visits')===0);ok(await count('historical_officer_assignments')===0);
 await db.exec(sql);await db.exec(sql);ok(await count('historical_officer_visits')===2);ok(await count('historical_officer_assignments')===1);
 ok((await db.query('SELECT remarks FROM mass_import.historical_officer_visits ORDER BY visit_date')).rows[0].remarks===null);
 ok(Number((await db.query('SELECT count(*) n FROM mass_core.user_scope_grants')).rows[0].n)===0);
 ok(Number((await db.query('SELECT count(*) n FROM auth.users')).rows[0].n)===0);
 for(const role of ['anon','authenticated','service_role']){
  await db.exec(`SET ROLE ${role}`);
  await error('42501','SELECT * FROM mass_import.historical_officer_visits');
  await error('42501','SELECT * FROM mass_import.historical_officer_assignments');
  await db.exec('RESET ROLE');
 }
 for(const table of ['historical_officer_assignments','historical_officer_visits']){
  await error('55000',`UPDATE mass_import.${table} SET payload_hmac=repeat('a',64)`);
  await error('55000',`DELETE FROM mass_import.${table}`);await error('55000',`TRUNCATE mass_import.${table} CASCADE`);
 }
 await assert.rejects(()=>db.exec(sql.replace('"remarks":"Observed"','"remarks":"Changed"')),/retry conflict/);checks++;await db.exec('ROLLBACK');
 const visit=plan.visits[0];
 const insert=r=>`INSERT INTO mass_import.historical_officer_visits SELECT * FROM jsonb_populate_record(NULL::mass_import.historical_officer_visits,'${JSON.stringify({...r,imported_at:'2026-10-10',imported_by:'postgres'}).replaceAll("'","''")}')`;
 await error('23514',insert({...visit,id:'30000000-0000-4000-8000-000000000001',source_sha256:'a'.repeat(64)}));
 await error('23514',insert({...visit,id:'30000000-0000-4000-8000-000000000002',visit_date:'9999-10-01',reporting_month:'9999-10-01'}));
 ok((await db.query("SELECT bool_and(relrowsecurity AND relforcerowsecurity) ok FROM pg_class WHERE oid IN('mass_import.historical_officer_assignments'::regclass,'mass_import.historical_officer_visits'::regclass)")).rows[0].ok);
 console.log(`PASS ${checks} historical visit checks: reviewed aliases, duplicate/date holds, rollback, exact retry, immutable evidence, source validation, no login/scope creation and app access denial.`);
}finally{await db.close();fs.rmSync(tmp,{recursive:true,force:true});}
