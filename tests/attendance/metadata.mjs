import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,centre,user} from './fixture.mjs';
const {db,rpc}=await fixture();let checks=0;
const check=value=>{assert.ok(value);checks++;};
const fails=async(code,work)=>{await assert.rejects(work,error=>error.code===code);checks++;};
const context={p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'};
try{
 const initial=await rpc('read_attendance_register_v3',context);
 check(initial.notes==='');
 const args={...context,p_request:randomUUID(),p_token:initial.token,p_rows:[{enrolment:initial.roster[0].id,code:'L'}],p_reason:'TEST RECORD initial entry',p_notes:'TEST RECORD overall notes'};
 check(await rpc('save_attendance_register_v3',args)===1);
 check(await rpc('save_attendance_register_v3',args)===1);
 await fails('PT409',()=>rpc('save_attendance_register_v3',{...args,p_notes:'different replay'}));
 const saved=await rpc('read_attendance_register_v3',context);
 check(saved.notes===args.p_notes&&saved.recorded===1);
 const totals=await rpc('attendance_register_summary_v3',{p_centres:[centre],p_from:context.p_date,p_until:'2026-05-15'});
 check(totals.length===1&&Number(totals[0].eligible)===1&&Number(totals[0].percentage)===0);
 check(Boolean(totals[0].created_by)&&Boolean(totals[0].last_edited_by));
 check(!JSON.stringify(totals).includes(user(1)));
 const edit={...args,p_request:randomUUID(),p_token:saved.token,p_rows:[],p_notes:'TEST RECORD notes-only correction'};
 check(await rpc('save_attendance_register_v3',edit)===0);
 await fails('PT409',()=>rpc('save_attendance_register_v3',{...edit,p_request:randomUUID(),p_notes:'stale overwrite'}));
 const corrected=await rpc('read_attendance_register_v3',context);
 check(corrected.notes===edit.p_notes&&corrected.token!==saved.token);
 for(const actor of [2,4,5,7,8]){
  await fails('42501',()=>rpc('read_attendance_register_v3',context,user(actor)));
  await fails('42501',()=>rpc('save_attendance_register_v3',{...edit,p_request:randomUUID()},user(actor)));
 }
 for(const role of ['anon','service_role'])await fails('42501',()=>rpc('save_attendance_register_v3',args,user(1),role));
 await fails('22023',()=>rpc('save_attendance_register_v3',{...edit,p_request:randomUUID(),p_notes:'x'.repeat(2001)}));
 await fails('PT409',()=>rpc('delete_attendance_register_v3',{...context,p_request:randomUUID(),p_token:saved.token,p_reason:'stale notes deletion'}));
 await rpc('delete_attendance_register_v3',{...context,p_request:randomUUID(),p_token:corrected.token,p_reason:'TEST RECORD deletion'});
 const deleted=await rpc('read_attendance_register_v3',context);check(deleted.recorded===0&&deleted.notes==='');
 await db.exec('SET ROLE mass_core_owner;');
 check(Number((await db.query("SELECT count(*) n FROM mass_core.attendance_register_actions WHERE notes IS NOT NULL")).rows[0].n)===2);
 await db.exec('UPDATE mass_core.attendance_register_control SET enabled=false;RESET ROLE;');
 await fails('42501',()=>rpc('save_attendance_register_v3',{...args,p_request:randomUUID(),p_token:deleted.token}));
 console.log(`PASS ${checks} register metadata assertions: durable notes, exact replay, attribution, scoped access, feature gate and retained history.`);
}catch(error){console.error(error.message,error.code);process.exitCode=1;}finally{await db.close();}
