import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {fixture,centre,user} from './fixture.mjs';

const {db,rpc}=await fixture();
const other='10000000-0000-4000-8000-000000000002';
let checks=0;
const ok=value=>{assert.ok(value);checks++;};

try {
 const initial=await rpc('get_context',{},user(8));
 ok(initial.role==='Leadership'&&!('roles' in initial)&&!('operational_roles_enabled' in initial)&&initial.centres.every(c=>!('roles' in c)&&c.can_write));
 ok((await rpc('get_context',{},user(4))).centres.every(c=>c.can_write));

 await db.exec('SET ROLE mass_core_admin;');
 await assert.rejects(
  ()=>db.query("INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at) VALUES($1,$2,'Cluster Officer','2026-01-01',$3,now())",[user(8),centre,user(6)]),
  error=>error.code==='42501');checks++;
 await assert.rejects(
  ()=>db.query("INSERT INTO mass_core.staff_operational_access(user_id,approval_reference,approved_by) VALUES($1,'Synthetic retired override',$2)",[user(8),user(6)]),
  error=>error.code==='42501');checks++;
 await db.exec('RESET ROLE;');

 const register=await rpc('read_attendance_register',{p_centre:other,p_shift:'Morning',p_date:'2026-05-15'},user(8));
 ok(register.roster.length>0);
 assert.equal(await rpc('save_attendance_register',{p_request:randomUUID(),p_centre:other,p_shift:'Morning',p_date:'2026-05-15',p_token:register.token,p_rows:[{enrolment:register.roster[0].id,code:'P'}],p_reason:'Synthetic governed Leadership entry'},user(8)),1);checks++;
 const results=await rpc('read_assessments',{p_centre:other,p_from:'2026-04-01',p_until:'2026-07-01'},user(8));
 const learner=register.roster.find(student=>!results.some(result=>result.enrolment_id===student.id));
 ok(Boolean(learner));
 ok(typeof await rpc('record_assessment',{p_enrolment:learner.id,p_definition:'22000000-0000-4000-8000-000000000001',p_date:'2026-05-15',p_score:22,p_expected:0},user(8))==='string');
 const capabilities=await rpc('get_original_capabilities',{},user(8));
 ok(capabilities.writes.visit_entry===false&&capabilities.writes.assessment_entry===true);

 const leadershipLinks=await rpc('get_visit_assignments',{},user(8));
 const officerLinks=await rpc('get_visit_assignments',{},user(3));
 ok(leadershipLinks.length>=1&&officerLinks.length===1&&leadershipLinks.some(link=>link.id===officerLinks[0].id));
 const assignment=officerLinks[0].id;
 await assert.rejects(()=>rpc('record_visit',{p_id:randomUUID(),p_assignment:assignment,p_shift:'Morning',p_date:'2026-11-09',p_status:'Completed',p_feedback:'Synthetic gated visit',p_next_action:'',p_expected:0},user(8)),error=>error.code==='42501');checks++;
 await db.exec("SET ROLE mass_core_owner; UPDATE mass_activation.features SET enabled=true,approval_reference='isolated governed visit test' WHERE feature='visit_entry'; RESET ROLE;");
 assert.equal(await rpc('record_visit',{p_id:randomUUID(),p_assignment:assignment,p_shift:'Morning',p_date:'2026-11-09',p_status:'Completed',p_feedback:'Synthetic governed Leadership visit',p_next_action:'',p_expected:0},user(8)),1);checks++;
 await assert.rejects(()=>rpc('record_visit',{p_id:randomUUID(),p_assignment:assignment,p_shift:'Morning',p_date:'2026-11-09',p_status:'Completed',p_feedback:'Synthetic foreign identity',p_next_action:'',p_expected:0},user(2)),error=>error.code==='42501');checks++;

 await db.exec('SET ROLE mass_core_owner;');
 await db.query("INSERT INTO mass_core.officer_assignments(id,governed_assignment_id,directory_assignment_id,starts_on,shift_scope,verification_reference) SELECT $1,a.id,'57000000-0000-4000-8000-000000000003','2098-01-01','Both shifts','Synthetic governed operator assignment' FROM mass_core.user_centre_assignments a WHERE a.user_id=$2 AND a.centre_id=$3 AND a.status='Active'",[randomUUID(),user(3),centre]);
 const governedInsert=(await db.query("SELECT count(*)::int n FROM mass_core.officer_assignments WHERE starts_on='2098-01-01' AND scope_grant_id IS NULL")).rows[0];
 ok(governedInsert.n===1);
 await db.exec('RESET ROLE;');

 const onboarding=fs.readFileSync(new URL('../../scripts/staff/clone-operational-access.sql',import.meta.url),'utf8');
 await assert.rejects(()=>db.exec(onboarding),error=>error.code==='55000');checks++;
 const after=await rpc('get_context',{},user(8));
 ok(after.role==='Leadership'&&after.centres.every(c=>c.can_write));
 console.log(`PASS ${checks} governed hierarchy assertions: legacy writes and clone path retired, single-role context, Leadership writes, governed visit links and coherent release gates.`);
} catch(error) {
 console.error(error.stack||error.message,error.code,error.where);
 process.exitCode=1;
} finally {
 await db.close();
}
