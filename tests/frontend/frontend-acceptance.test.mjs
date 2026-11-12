import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateRosterNames} from '../../src/live/roster-names.js';
import {savedAssessmentGroups} from '../../src/live/assessment-records.js';
import {defaultAuthorizedRole} from '../../src/live/role-data.js';

test('role defaults prefer Leadership without inventing a grant',()=>{
 for(const roles of [['Teacher','Leadership','Cluster Officer'],['Leadership','Teacher']])
  assert.equal(defaultAuthorizedRole({centres:[{roles}]}),'Leadership');
 assert.equal(defaultAuthorizedRole({centres:[{roles:['Teacher']}]}),'Teacher');
 assert.equal(defaultAuthorizedRole({centres:[{roles:['Cluster Officer','Teacher']}]}),'Cluster Officer');
 assert.equal(defaultAuthorizedRole({centres:[]}),null);
});

test('operational names come only from the scoped roster, including closed episodes',async()=>{
 const rows=[{enrolment_id:'a',starts_on:'2026-04-01',shift_code:'Morning'},
  {enrolment_id:'b',starts_on:'2026-04-01',ends_before:'2026-05-01',shift_code:'Morning'},
  {enrolment_id:'c',starts_on:'2026-04-01',shift_code:'Evening',full_name:'Already authorized'}];
 const calls=[];
 const result=await hydrateRosterNames(rows,'permitted',async args=>{
  calls.push(args);return {roster:[{id:args.p_date==='2026-04-30'?'b':'a',name:'TEST RECORD'},{id:'foreign',name:'Out of scope'}]};
 },'2026-11-10');
 assert.equal(result[0].full_name,'TEST RECORD');assert.equal(result[1].full_name,'TEST RECORD');
 assert.equal(result[2].full_name,'Already authorized');assert.equal(result.length,3);
 assert.deepEqual(calls.map(value=>value.p_date).sort(),['2026-04-30','2026-11-10']);
 assert(calls.every(value=>value.p_centre==='permitted'));
 await assert.rejects(hydrateRosterNames(rows,'denied',async()=>{throw Error('permission denied');},'2026-11-10'),/permission denied/);
});

test('saved assessment records group by authorized centre, actual date and round',()=>{
 const db={students:[{id:'a',centre:'one'},{id:'b',centre:'one'},{id:'c',centre:'foreign'}],assessmentDetails:{
  'a|F1':{id:'x',date:''},'b|F1':{id:'y',date:''},'a|F2':{id:'z',date:'2026-08-01'},'c|F2':{id:'foreign',date:'2026-08-01'}
 }};
 const result=savedAssessmentGroups(db,[{id:'one'}]);
 assert.equal(result.length,2);assert.equal(result[0].date,'2026-08-01');
 assert.equal(result[1].date,'');assert.equal(result[1].students.length,2);
 assert(result.every(group=>group.centre==='one'));
});
