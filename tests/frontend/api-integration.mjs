import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createApi,BackendError} from '../../src/live/api.js';
import {createReadApi} from '../../src/live/reads.js';

const address=process.env.MASS_FRONTEND_TEST_API;
assert(/^http:\/\/mass-frontend-read-test-[0-9]+-[0-9]+-api:3000$/.test(address),'Only the generated isolated test API is accepted');
const secret=process.env.MASS_FRONTEND_TEST_SECRET;assert(secret?.length>=32);
function jwt(subject,role='authenticated') {
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const raw=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:subject,role,exp:Math.floor(Date.now()/1000)+300});
  return raw+'.'+createHmac('sha256',secret).update(raw).digest('base64url');
}
function clients(subject,role) {
  const client=createClient(address,`sb_publishable_${'x'.repeat(32)}`,{
    accessToken:async()=>jwt(subject,role),
    global:{fetch:(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url);
      assert.equal(url.origin,address);url.pathname=url.pathname.replace(/^\/rest\/v1/,'');
      return fetch(url,init);
    }},
  });
  return {api:createApi(client),reads:createReadApi(client)};
}
let checks=0;function check(value,label){assert(value,label);++checks;console.log('PASS SDK:',label);}
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const teacher=clients('00000000-0000-4000-8000-000000000001');
const other=clients('00000000-0000-4000-8000-000000000002');
const leader=clients('00000000-0000-4000-8000-000000000004');
for(let attempt=0;attempt<40;attempt++){
  try{await teacher.reads.context();break;}catch(error){if(attempt===39)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
}
const ctx=await teacher.reads.context();
check(ctx.api_version==='frontend-reads-v1'&&ctx.centres.length===1&&ctx.centres[0].id===a&&ctx.centres[0].can_write,'versioned context uses signed UID and only own verified centre');
const refs=await teacher.reads.references();check(refs.attendance_codes.length===5,'actual SDK reads controlled references');
const read=who=>who.reads.centre({centre:a,from:'2026-04-01',until:'2026-05-01',yearFrom:'2026-04-01',yearUntil:'2027-04-01'});
check((await read(teacher)).students.every(s=>s.full_name==='Synthetic record'),'private profile capability survives SDK/read API');
check((await read(leader)).students.every(s=>s.full_name===null&&s.gender_code===null),'Leadership private fields stay masked');
await assert.rejects(read(other),e=>e instanceof BackendError&&e.status===403);check(true,'real PostgREST rejects another centre');
const unassigned=clients('00000000-0000-4000-8000-000000000005');
check((await unassigned.reads.context()).centres.length===0,'unassigned authenticated subject cannot discover centres');
const forged=clients('00000000-0000-4000-8000-000000000001','mass_core_owner');
await assert.rejects(forged.reads.context());check(true,'authenticator cannot assume signed privileged database role');
const [student]=await teacher.api.registerStudent({centre:a,grade:'5',shift:'Morning',start:'2026-04-01',name:'Synthetic SDK record',gender:'Girl'});
let state=await read(teacher);const row=state.students.find(s=>s.child_id===student.child_id);
check(row?.starts_on==='2026-04-01'&&row.student_id===student.student_id,'registration reloads permanent ID and historical episode');
await teacher.api.recordAttendance({enrolment:student.enrolment_id,on:'2026-04-15',code:'L',expected:0});
state=await read(teacher);let mark=state.attendance.find(r=>r.child_id===student.child_id);
check(mark.code==='L'&&Number(mark.row_version)===1,'attendance read supplies real correction revision');
await teacher.api.recordAttendance({enrolment:student.enrolment_id,on:'2026-04-15',code:'P',expected:1});
await assert.rejects(teacher.api.recordAttendance({enrolment:student.enrolment_id,on:'2026-04-15',code:'A',expected:1}),e=>e.conflict);
check(true,'stale SDK correction receives HTTP409 without retry');
await assert.rejects(leader.api.recordAttendance({enrolment:student.enrolment_id,on:'2026-04-15',code:'A',expected:2}),e=>e.status===403);
check(true,'Leadership writes denied by the real backend');
const definition=refs.assessment_definitions[0].id;
await teacher.api.recordAssessment({enrolment:student.enrolment_id,definition,on:'2026-04-15',score:0,expected:0});
state=await read(teacher);check(state.assessments.some(r=>r.child_id===student.child_id&&Number(r.score)===0),'SDK preserves zero assessment score');
const event=randomUUID();await teacher.api.createActivity({id:event,centre:a,shift:'Morning',on:'2026-04-15',name:'Synthetic SDK activity'});
await teacher.api.recordParticipation({enrolment:student.enrolment_id,event,participated:true,expected:0});
state=await read(teacher);check(state.activities.some(r=>r.id===event)&&state.participation.some(r=>r.event_id===event&&r.participated===true),'activity and participation persist through SDK and read API');
await teacher.api.recordParticipation({enrolment:student.enrolment_id,event,participated:null,expected:1});
state=await read(teacher);check(state.participation.find(r=>r.event_id===event).participated===null,'participation Unknown is NULL, not fabricated absence/deletion');
const member=await teacher.api.addMorarjiMember({enrolment:student.enrolment_id,cohort:refs.programme_cohorts[0].id});
await teacher.api.recordMorarji({member,applied:true,attended:null,passed:null,school:null,expected:0});
state=await read(teacher);check(state.morarji.some(r=>r.membership_id===member&&r.applied&&r.attended===null),'Morarji retains independently unknown outcomes');
await teacher.api.closeEnrolment({id:student.enrolment_id,expected:Number(row.row_version),endsBefore:'2026-07-01',status:'Active'});
await teacher.api.addEnrolment({child:student.child_id,centre:a,grade:'6',shift:'Evening',start:'2026-07-01',status:'Active'});
state=await read(teacher);check(state.students.filter(r=>r.child_id===student.child_id).length===2,'assignment edits append history and preserve old context');
const baseline=await teacher.api.listStudents({centre:a,on:'2026-04-15'});check(baseline.rows.some(r=>r.child_id===student.child_id),'original list_students adapter remains usable');
const totals=await teacher.api.attendanceSummary({centre:a,from:'2026-04-01',until:'2026-05-01'});check(Number(totals.present_count)>0,'original attendance_summary remains usable');
console.log(`PASS: ${checks} real SDK/PostgREST checks; Auth issuance is synthetic, not managed Supabase verification.`);
