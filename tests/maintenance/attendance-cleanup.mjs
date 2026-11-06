// Synthetic isolated PG17 only. No network or hosted observations.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname;
const read=p=>fs.readFileSync(root+p,'utf8');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'mass-cleanup-'));
const db=new PGlite();await db.waitReady;
try {
 await db.exec(read('tests/core/bootstrap.sql'));
 for(const f of fs.readdirSync(root+'supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(read('supabase/migrations/'+f));
 await db.exec(read('tests/release/preactivation.sql'));
 await db.exec('CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);');
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claims','{\"sub\":\"90000000-0000-4000-8000-000000000001\"}',false);");
 const codes=['P','P','A','A','L'];const ids=[];
 for(let i=0;i<5;i++){
  const student=(await db.query("SELECT * FROM mass_api.register_student('90000000-0000-4000-8000-000000000002','5',$1,'2026-04-01',$2,'Girl')",[i%2?'Evening':'Morning','Synthetic cleanup learner '+i])).rows[0];
  await db.query("SELECT mass_api.record_attendance($1,'2026-11-05',$2,0)",[student.enrolment_id,codes[i]]);
  ids.push((await db.query('SELECT id FROM mass_core.attendance_records WHERE enrolment_id=$1',[student.enrolment_id])).rows[0].id);
 }
 await db.exec('RESET ROLE;');
 const records=(await db.query(`SELECT r.id,to_jsonb(r) original_row,a.id audit_id,a.changed_at::text,a.actor_user_id,
 encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') row_hash,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') audit_hash
 FROM mass_core.attendance_records r JOIN mass_foundation.audit_events a ON a.entity_id=r.id AND a.entity_type='core.attendance_records' WHERE r.id=ANY($1::uuid[]) ORDER BY r.id`,[ids])).rows;
 const history=(await db.query("SELECT * FROM mass_foundation.audit_events WHERE entity_type='core.attendance_records' AND entity_id=ANY($1::uuid[])",[ids])).rows;
 const guard=(await db.query("SELECT pg_get_functiondef('mass_core.guard_record()'::regprocedure) guard,encode(sha256(convert_to(pg_get_functiondef('mass_core.guard_record()'::regprocedure),'UTF8')),'hex') hash")).rows[0];
 const m={records,history,guard:guard.guard,guard_hash:guard.hash};
 const generate=manifest=>{
  fs.writeFileSync(scratch+'/manifest.json',JSON.stringify(manifest));
  execFileSync('python',[root+'scripts/maintenance/prepare_attendance_cleanup.py','--manifest',scratch+'/manifest.json','--output',scratch+'/cleanup.sql']);
  return fs.readFileSync(scratch+'/cleanup.sql','utf8');
 };
 const sql=generate(m);
 const snapshot=async()=>JSON.stringify((await db.query("SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM mass_core.attendance_records r) attendance,(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM mass_foundation.audit_events a) audit,pg_get_functiondef('mass_core.guard_record()'::regprocedure) guard")).rows);
 const before=await snapshot();
 const receipt=async body=>db.query("INSERT INTO supabase_migrations.schema_migrations VALUES('209911050001','mass_20261105_attendance_test_cleanup',ARRAY[$1])",[body]);
 async function rejected(label,body,expected,withReceipt=false){
  await db.exec('BEGIN;');let caught;
  try {await db.exec(body);if(withReceipt)await receipt(body);await db.exec('COMMIT;');}
  catch(e){caught=e;await db.exec('ROLLBACK;');}
  assert.ok(caught,label+' must reject');if(expected)assert.equal(caught.code,expected,label);
  assert.equal(await snapshot(),before,label+' preserves data and guard');
  assert.equal((await db.query("SELECT count(*) n FROM pg_namespace WHERE nspname='mass_maintenance'")).rows[0].n,0,label+' rolls back DDL');
  console.log('PASS',label);
 }
 await rejected('missing atomic provider receipt',sql,'55000');
 await rejected('failure after deletion rolls back data, receipts and DDL',sql+' SELECT 1/0;','22012',true);
 const bad=structuredClone(m);bad.records[0].row_hash='0'.repeat(64);
 await rejected('changed row fingerprint rejects all five',generate(bad),'P0001');
 const badAudit=structuredClone(m);badAudit.records[0].audit_hash='0'.repeat(64);
 await rejected('changed insertion audit rejects all five',generate(badAudit),'P0001');
 await rejected('ordinary deletion still denied during scoped exception',sql.replace('CALL mass_maintenance.cleanup_exact_five();',"DELETE FROM mass_core.attendance_records WHERE attendance_date='2026-04-02'; CALL mass_maintenance.cleanup_exact_five();"),'55000');
 await rejected('authenticated cannot execute maintenance procedure',sql.replace('CALL mass_maintenance.cleanup_exact_five();','SET LOCAL ROLE authenticated; CALL mass_maintenance.cleanup_exact_five();'),'42501');
 await db.exec('BEGIN;');await db.exec(sql);await receipt(sql);await db.exec('COMMIT;');
 assert.equal((await db.query('SELECT count(*) n FROM mass_core.attendance_records WHERE id=ANY($1::uuid[])',[ids])).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*) n FROM mass_core.attendance_records')).rows[0].n,3);
 assert.equal((await db.query('SELECT count(*) n FROM mass_maintenance.attendance_cleanup_20261105')).rows[0].n,5);
 assert.equal((await db.query("SELECT pg_get_functiondef('mass_core.guard_record()'::regprocedure) guard")).rows[0].guard,m.guard);
 assert.equal((await db.query("SELECT count(*) n FROM mass_foundation.audit_events WHERE entity_type='core.attendance_records' AND entity_id=ANY($1::uuid[])",[ids])).rows[0].n,5);
 for(const statement of ["DELETE FROM mass_core.attendance_records","TRUNCATE mass_core.attendance_records","DELETE FROM mass_maintenance.attendance_cleanup_20261105","UPDATE mass_maintenance.attendance_cleanup_20261105 SET cleanup_reason='changed'","TRUNCATE mass_maintenance.attendance_cleanup_20261105"]){
  let e;try{await db.exec(statement);}catch(x){e=x;}assert.equal(e?.code,'55000');
 }
 await db.exec('SET ROLE authenticated;');
 let denied;try{await db.exec('SELECT * FROM mass_maintenance.attendance_cleanup_20261105');}catch(e){denied=e;}assert.equal(denied?.code,'42501');
 await db.exec('RESET ROLE;');
 assert.equal((await db.query("SELECT count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='mass_maintenance' AND p.proname IN('cleanup_exact_five','exact_cleanup_row')")).rows[0].n,0);
 console.log('PASS exact five removed, unrelated rows/audits preserved, original guard restored, private immutable receipts, no reusable deletion endpoint');
} finally {await db.close();fs.rmSync(scratch,{recursive:true,force:true});}
