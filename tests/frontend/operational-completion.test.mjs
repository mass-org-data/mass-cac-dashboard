import test from 'node:test';import assert from 'node:assert/strict';
import {createOriginalActions,refreshVisitSelection} from '../../src/live/original-actions.js';
const capabilities={originalWorkflows:true,operationalDetails:true,aggregates:true};
function fixture(overrides={}){const calls=[],s={id:'e',enrolmentId:'e',childId:'c',centre:'a',name:'Synthetic learner',studentId:'ST_SY_5_01'};const state={role:'Teacher',date:'2026-10-20',exam:'F1'},db={academicYear:'year',students:[s,{...s,id:'unknown',enrolmentId:'unknown'}],attendanceRecords:{},assessmentDetails:{},scores:{}};const handle=createOriginalActions({client:{schema(){throw Error('Unexpected mutation/API request')}},api:{},refs:{assessment_definitions:[{id:'d',period_id:'p'}],assessment_periods:[{id:'p',quarter:1,academic_year_id:'year'}]},context:{centres:[{id:'a',can_write:true,roles:['Teacher']}]},capabilities:{...capabilities,...overrides},refresh:async()=>{calls.push('refresh');db.attendanceRecords['e|2026-10-20']={code:'L',row_version:2};}});let modal;const t={state,db,children:()=>db.students,toast:x=>calls.push(x),esc:x=>String(x),field:(label,name,value,type)=>`<input name="${name}" value="${value}" type="${type||'text'}">`,modal:(title,sub,body,submit)=>{modal={title,sub,body,submit}}};return {handle,t,calls,modal:()=>modal};}
test('Save attendance refreshes actual saved codes, preserving unknowns without writes/revision churn',async()=>{const f=fixture();await f.handle({dataset:{action:'save-default-attendance'}},f.t);assert.deepEqual(f.calls,['refresh','1 explicit marks saved for 2026-10-20; 1 unrecorded remain unknown.']);assert.equal(f.t.db.attendanceRecords['unknown|2026-10-20'],undefined);assert.equal(f.t.db.attendanceRecords['e|2026-10-20'].row_version,2);});
test('assessment history control uses actual scoped record identity, not a guessed result',async()=>{const f=fixture();f.t.db.assessmentDetails['e|F1']={id:'score'};await f.handle({dataset:{action:'manage-records'}},f.t);assert.match(f.modal().body,/data-record-history="assessment_results\|score\|a"/);assert.equal((f.modal().body.match(/F1 history/g)||[]).length,1);});
test('Leadership cannot access mutation forms through the restored save control',async()=>{const f=fixture();f.t.state.role='Leadership';await assert.rejects(()=>f.handle({dataset:{action:'save-default-attendance'}},f.t),/does not permit/);assert.equal(f.calls.length,0);});

test('saved visits select their month and refresh the visible visit list',async()=>{
 const state={month:'2026-10',centre:'',shift:''},loaded=[];
 await refreshVisitSelection(state,{date:'2026-11-09',centre:'centre-a',shift:'Evening'},month=>loaded.push(month));
 assert.deepEqual(state,{month:'2026-11',centre:'centre-a',shift:'Evening'});assert.deepEqual(loaded,['2026-11']);
});

test('entry-only bulk attendance skips already equal marks but cannot overwrite another code',async()=>{
 const f=fixture({activationControl:true,writes:{attendance_entry:true}});f.t.db.attendanceRecords['e|2026-10-20']={code:'P',row_version:1};await f.handle({dataset:{action:'mark-all'}},f.t);assert.match(f.modal().sub,/1 changes within 2/);
 f.t.db.attendanceRecords['e|2026-10-20'].code='L';await assert.rejects(()=>f.handle({dataset:{action:'mark-all'}},f.t),/Operational activation pending/);
});

test('entry-only assessment form preserves existing scores while accepting missing-result fields',async()=>{
 const f=fixture({activationControl:true,writes:{assessment_entry:true}});f.t.db.assessmentDetails['e|F1']={id:'result',row_version:1};f.t.db.scores.e={F1:12};await f.handle({dataset:{action:'enter-marks'}},f.t);assert.match(f.modal().body,/<input readonly aria-readonly="true" name="score_e"/);assert.match(f.modal().body,/<input name="score_unknown"/);await assert.rejects(()=>f.modal().submit({score_e:'13',score_unknown:'',batchDate:''}),/Operational activation pending/);assert.equal(f.t.db.scores.e.F1,12);
});
