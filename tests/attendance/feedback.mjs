import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fixture,centre,user} from './fixture.mjs';
const {db,rpc}=await fixture({metadata:false});let checks=0;
const check=v=>{assert.ok(v);checks++;};
const denied=async work=>{await assert.rejects(work,e=>e.code==='42501');checks++;};
try{
 await db.exec(fs.readFileSync(new URL('../../supabase/migrations/20261110120000_attendance_register_metadata.sql',import.meta.url),'utf8'));
 const migration=fs.readFileSync(new URL('../../supabase/migrations/20261112052348_feedback_register_reporting.sql',import.meta.url),'utf8');
 const fingerprint=async()=>JSON.stringify((await db.query("SELECT (SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM mass_core.attendance_records a) attendance,(SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM mass_core.assessment_results a) scores,(SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM mass_core.user_scope_grants a) grants,(SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY feature)) FROM mass_activation.features a) gates")).rows);
 const prior=await fingerprint();
 try{await db.exec(migration.replace('COMMIT;','SELECT 1/0;COMMIT;'));throw Error('injected failure committed');}catch(error){if(error.code!=='22012')throw error;await db.exec('ROLLBACK');}
 check(await fingerprint()===prior);check((await db.query("SELECT to_regprocedure('mass_api.assessment_register_summary(uuid[],uuid,text,text,text)') rpc")).rows[0].rpc===null);
 check((await db.query("SELECT count(*) n FROM pg_policies WHERE policyname='assessment_register_audit_read'")).rows[0].n===0);
 await db.exec(migration);check(await fingerprint()===prior);
 const cap=await rpc('get_attendance_register_capabilities');check(cap.assessment_register&&cap.register_timestamps&&cap.profile_sort_v2);
 const args={p_centres:[centre],p_year:'20000000-0000-4000-8000-000000000001'};
 const rows=await rpc('assessment_register_summary',args);check(rows.length>0);check(rows.every(r=>r.created_by&&r.last_edited_by));check(!JSON.stringify(rows).includes('actor_user_id'));
 for(const actor of [2,5,7])await denied(()=>rpc('assessment_register_summary',args,user(actor)));
 await denied(()=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');await tx.query('SELECT entity_id FROM mass_foundation.audit_events LIMIT 1');}));
 for(const role of ['anon','service_role'])await denied(()=>rpc('assessment_register_summary',args,user(1),role));
 await denied(()=>rpc('assessment_register_summary',{...args,p_centres:[randomUUID()]}));
 for(const actor of [4,8])check((await rpc('assessment_register_summary',args,user(actor))).length>0);
 const before=(await db.query('SELECT count(*) n FROM mass_core.assessment_results')).rows[0].n;
 await db.query("INSERT INTO mass_core.staff_operational_access(user_id,approval_reference,approved_by) VALUES($1,'TEST RECORD attribution verification',$2)",[user(1),user(6)]);await db.exec('SET ROLE mass_core_owner');await db.query("INSERT INTO mass_core.staff_members(display_name,source_name,auth_user_id) VALUES('TEST RECORD editor','TEST RECORD editor',$1)",[user(1)]);await db.exec('RESET ROLE');
 const enrolment=(await db.query('SELECT id FROM mass_core.enrolments WHERE centre_id=$1 AND starts_on<=$2 AND (ends_before IS NULL OR ends_before>$2) ORDER BY id LIMIT 1',[centre,'2026-08-15'])).rows[0].id;
 await db.exec("SET ROLE mass_core_admin; INSERT INTO mass_core.assessment_definitions(period_id) SELECT id FROM mass_core.assessment_periods WHERE academic_year_id='20000000-0000-4000-8000-000000000001' AND quarter=2; RESET ROLE;");
 const definition=(await db.query('SELECT d.id FROM mass_core.assessment_definitions d JOIN mass_core.assessment_periods p ON p.id=d.period_id WHERE p.academic_year_id=$1 AND p.quarter=2',[args.p_year])).rows[0].id;
 await rpc('record_assessment_batch',{p_rows:[{enrolment,definition,date:'2026-08-15',score:21,expected:0}]});
 const saved=(await rpc('assessment_register_summary',args)).find(r=>(r.assessment_date instanceof Date?r.assessment_date.toISOString().slice(0,10):r.assessment_date)==='2026-08-15');
 check(saved?.last_edited_by==='TEST RECORD editor');check(saved.created_by==='TEST RECORD editor');check(saved.last_edited_at!==null);check(Number(saved.average_score)===21);check((await db.query('SELECT count(*) n FROM mass_core.assessment_results')).rows[0].n===before+1);
 const context={p_centre:centre,p_shift:'Morning',p_date:'2026-07-15'},register=await rpc('read_attendance_register_v3',context);
 await rpc('save_attendance_register_v3',{...context,p_request:randomUUID(),p_token:register.token,p_rows:[{enrolment:register.roster[0].id,code:'P'}],p_notes:'TEST RECORD saved'});
 const attendance=await rpc('attendance_register_summary_v4',{p_centres:[centre],p_from:'2026-07-15',p_until:'2026-07-16'});check(attendance[0].last_edited_by==='TEST RECORD editor'&&attendance[0].last_edited_at!==null);
 const profile={p_centres:[centre],p_on:'2026-07-15',p_limit:100};const ascending=await rpc('student_profile_page_v2',profile),descending=await rpc('student_profile_page_v2',{...profile,p_reverse:true});check(JSON.stringify(descending.ids)===JSON.stringify([...ascending.ids].reverse()));
 const paged=await rpc('student_profile_page_v2',{...profile,p_limit:1,p_reverse:true});check(paged.ids[0]===descending.ids[0]);
 for(const actor of [2,4,5,7,8])await denied(()=>rpc('student_profile_page_v2',profile,user(actor)));
 // New read migration rolls back without changing existing facts or grants.
 const sql=fs.readFileSync(new URL('../../supabase/migrations/20261112052348_feedback_register_reporting.sql',import.meta.url),'utf8');check(sql.includes('REVOKE ALL')&&!sql.includes('UPDATE mass_activation'));
 console.log(`PASS ${checks} feedback register assertions: attribution, timestamps, scoped denial, immutable history and whole-population reverse paging.`);
}finally{await db.close();}
