import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fixture,centre,user} from './fixture.mjs';
const {db,rpc}=await fixture({metadata:false});let checks=0;
const check=value=>{assert.ok(value);checks++;};
const fails=async(code,work)=>{await assert.rejects(work,error=>error.code===code);checks++;};
const context={p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'};
try{
 const migration=fs.readFileSync(new URL('../../supabase/migrations/20261110120000_attendance_register_metadata.sql',import.meta.url),'utf8');
 const fingerprint=async()=>JSON.stringify((await db.query("SELECT (SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM mass_core.attendance_records a) attendance,(SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM mass_core.assessment_results a) scores,(SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM mass_core.user_scope_grants a) grants,(SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY feature)) FROM mass_activation.features a) gates")).rows);
 const before=await fingerprint();
 try{await db.exec(migration.replace('COMMIT;','SELECT 1/0;COMMIT;'));throw Error('Injected failure unexpectedly committed');}catch(error){if(error.code!=='22012')throw error;await db.exec('ROLLBACK;');}
 check(await fingerprint()===before);
 check((await db.query("SELECT to_regprocedure('mass_api.student_profile_page(uuid[],date,text,text,text,text,text,integer,integer,text)') rpc")).rows[0].rpc===null);
 check((await db.query("SELECT count(*) n FROM information_schema.columns WHERE table_schema='mass_core' AND table_name='attendance_register_actions' AND column_name='notes'")).rows[0].n===0);
 check((await db.query("SELECT count(*) n FROM mass_core.attendance_codes WHERE code='H'")).rows[0].n===0);
 await db.exec(migration);check(await fingerprint()===before);
 check((await db.query("SELECT count(*) n FROM mass_core.attendance_codes WHERE code='H'")).rows[0].n===1);
 check((await rpc('get_attendance_register_capabilities')).holiday_code===true);
 const holidayContext={p_centre:centre,p_shift:'Morning',p_date:'2026-07-13'};
 const holidayRoster=await rpc('read_attendance_register_v3',holidayContext);
 await rpc('save_attendance_register_v3',{...holidayContext,p_request:randomUUID(),p_token:holidayRoster.token,p_rows:[{enrolment:holidayRoster.roster[0].id,code:'P'},{enrolment:holidayRoster.roster[1].id,code:'H'}]});
 const holidaySummary=await rpc('attendance_register_summary_v3',{p_centres:[centre],p_from:'2026-07-13',p_until:'2026-07-14'});
 check(Number(holidaySummary[0].percentage)===100&&Number(holidaySummary[0].eligible)===1&&Number(holidaySummary[0].recorded)===2);
 const holidayTotals=await rpc('attendance_summary',{p_centre:centre,p_from:'2026-07-13',p_until:'2026-07-14'});
 check(Number(holidayTotals[0].excluded_count)===1&&Number(holidayTotals[0].percentage)===100);
 const currentHoliday=await rpc('read_attendance_register_v3',holidayContext);
 for(const code of ['L','WO'])await fails('23514',()=>rpc('save_attendance_register_v3',{...holidayContext,p_request:randomUUID(),p_token:currentHoliday.token,p_rows:[{enrolment:holidayRoster.roster[0].id,code}],p_reason:'TEST RECORD old code cannot be newly assigned'}));
 const reviewedHoliday=await rpc('reviewed_chart_metrics',{p_centres:[centre],p_on:'2026-07-31',p_from:'2026-07-01',p_until:'2026-08-01',p_year:'20000000-0000-4000-8000-000000000001'});
 check(Number(reviewedHoliday.attendance.excluded)===1&&Number(reviewedHoliday.attendance.percentage)===100);
 const profileArgs={p_centres:[centre],p_on:'2026-05-14',p_sort:'id',p_limit:1};
 const firstPage=await rpc('student_profile_page',profileArgs),nextPage=await rpc('student_profile_page',{...profileArgs,p_offset:1});
 check(firstPage.total>1&&firstPage.ids.length===1&&nextPage.ids.length===1&&firstPage.ids[0]!==nextPage.ids[0]);
 const secondId=(await db.query('SELECT ch.student_id FROM mass_core.enrolments e JOIN mass_core.children ch ON ch.id=e.child_id WHERE e.id=$1',[nextPage.ids[0]])).rows[0].student_id;
 const searched=await rpc('student_profile_page',{...profileArgs,p_query:secondId});check(searched.total===1&&searched.ids[0]===nextPage.ids[0]);
 check(!JSON.stringify(firstPage).includes('full_name')&&!JSON.stringify(firstPage).includes('gender'));
 for(const actor of [2,4,5,7,8])await fails('42501',()=>rpc('student_profile_page',profileArgs,user(actor)));
 for(const role of ['anon','service_role'])await fails('42501',()=>rpc('student_profile_page',profileArgs,user(1),role));
 await fails('22023',()=>rpc('student_profile_page',{...profileArgs,p_limit:101}));
 await fails('22023',()=>rpc('student_profile_page',{...profileArgs,p_sort:'injected column'}));
 const initial=await rpc('read_attendance_register_v3',context);
 check(initial.notes==='');
 const args={...context,p_request:randomUUID(),p_token:initial.token,p_rows:[{enrolment:initial.roster[0].id,code:'A'}],p_reason:'TEST RECORD initial entry',p_notes:'TEST RECORD overall notes'};
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
 check(Number((await db.query("SELECT count(*) n FROM mass_core.attendance_register_actions WHERE notes LIKE 'TEST RECORD%'")).rows[0].n)===2);
 await db.exec('UPDATE mass_core.attendance_register_control SET enabled=false;RESET ROLE;');
 await fails('42501',()=>rpc('save_attendance_register_v3',{...args,p_request:randomUUID(),p_token:deleted.token}));
 // Confirmed contradictory Morarji answers are rejected on the server too.
 // Unknown earlier stages remain unknown; the hosted write gate is unchanged.
 const member=(await db.query('SELECT id FROM mass_core.cohort_memberships WHERE centre_id=$1 LIMIT 1',[centre])).rows[0].id;
 for(const applied of [null,false,true])for(const attended of [null,false,true])for(const passed of [null,false,true]){
  const current=(await db.query('SELECT row_version FROM mass_core.morarji_outcomes WHERE membership_id=$1',[member])).rows[0];
  const write=()=>db.transaction(async tx=>{
   await tx.exec('SET LOCAL ROLE mass_core_owner;');
   await tx.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user(1),role:'authenticated'})]);
   return tx.query('UPDATE mass_core.morarji_outcomes SET applied=$1,attended=$2,passed=$3 WHERE membership_id=$4 AND row_version=$5',[applied,attended,passed,member,current.row_version]);
  });
  const invalid=(attended===true&&applied===false)||(passed===true&&(applied===false||attended===false));
  if(invalid)await fails('23514',write);
  else{await write();const result=(await db.query('SELECT applied,attended,passed FROM mass_core.morarji_outcomes WHERE membership_id=$1',[member])).rows[0];check(result.applied===applied&&result.attended===attended&&result.passed===passed);}
 }
 await fails('42501',()=>rpc('record_morarji',{p_member:member,p_applied:true,p_attended:true,p_passed:true,p_school:null,p_expected:1}));
 console.log(`PASS ${checks} register metadata assertions: durable notes, exact replay, attribution, scoped access, feature gate, retained history and all 27 nullable Morarji stage combinations.`);
}catch(error){console.error(error.message,error.code);process.exitCode=1;}finally{await db.close();}
