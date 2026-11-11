import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceCodes,changedAttendance,registerSummaryKey,attendanceSummaryDisplay} from '../../src/live/attendance-register.js';
test('attendance drafts submit only explicit changes without filling unknown students',()=>{
 const roster=[{id:'one'},{id:'two'},{id:'three'}],saved={one:'P'},draft={one:'P',two:'H'};
 assert.deepEqual(changedAttendance(roster,saved,draft),[{enrolment:'two',code:'H'}]);
 assert.deepEqual(saved,{one:'P'});
});
test('clearing a saved mark submits an explicit audited clear',()=>{
 assert.deepEqual(changedAttendance([{id:'one'}],{one:'P'},{}),[{enrolment:'one',code:null}]);
});
test('draft changes cannot include students outside the loaded roster or unsupported codes',()=>{
 assert.deepEqual(changedAttendance([{id:'one'}],{},{one:'INVALID',foreign:'P'}),[]);
});
test('register summary cache follows reporting filters and authorized centre scope',()=>{
 const state={month:'2026-11',shift:'Morning',grade:'1',gender:'Girl'};
 const key=registerSummaryKey(state,[{id:'b'},{id:'a'}]);
 assert.equal(key,registerSummaryKey(state,[{id:'a'},{id:'b'}]));
 assert.notEqual(key,registerSummaryKey({...state,shift:'Evening'},[{id:'a'},{id:'b'}]));
 assert.notEqual(key,registerSummaryKey(state,[{id:'a'}]));
});

test('summary shows present/enrolled and the exact approved percentage fraction',()=>{
 assert.deepEqual(attendanceSummaryDisplay({present:1,total:17,eligible:17,percentage:100/17}),{ratio:'1/17',percentage:'5.9% (1/17)',incomplete:false});
 const partial=attendanceSummaryDisplay({present:1,total:17,eligible:1,percentage:100});
 assert.equal(attendanceSummaryDisplay({present:0,total:17,recorded:17,eligible:0,percentage:null}).incomplete,false);
 assert.equal(partial.ratio,'1/17');assert.equal(partial.percentage,'100.0% (1/1)');assert.equal(partial.incomplete,true);
});

test('new options exclude legacy codes without changing saved history',()=>{assert.deepEqual(attendanceCodes,['A','P','H']);for(const code of ['MM','L','WO']){assert.deepEqual(changedAttendance([{id:'one'}],{one:code},{one:code}),[]);assert.deepEqual(changedAttendance([{id:'one'}],{one:code},{}),[{enrolment:'one',code:null}]);}});
