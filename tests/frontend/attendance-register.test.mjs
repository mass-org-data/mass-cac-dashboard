import test from 'node:test';
import assert from 'node:assert/strict';
import {changedAttendance,registerSummaryKey} from '../../src/live/attendance-register.js';
test('attendance drafts submit only explicit changes without filling unknown students',()=>{
 const roster=[{id:'one'},{id:'two'},{id:'three'}],saved={one:'P'},draft={one:'P',two:'L'};
 assert.deepEqual(changedAttendance(roster,saved,draft),[{enrolment:'two',code:'L'}]);
 assert.deepEqual(saved,{one:'P'});
});
test('clearing a draft never erases an existing saved attendance mark',()=>{
 assert.deepEqual(changedAttendance([{id:'one'}],{one:'P'},{}),[]);
});
test('draft changes cannot include students outside the loaded roster or unsupported codes',()=>{
 assert.deepEqual(changedAttendance([{id:'one'}],{},{one:'H',foreign:'P'}),[]);
});
test('register summary cache follows reporting filters and authorized centre scope',()=>{
 const state={month:'2026-11',shift:'Morning',grade:'1',gender:'Girl'};
 const key=registerSummaryKey(state,[{id:'b'},{id:'a'}]);
 assert.equal(key,registerSummaryKey(state,[{id:'a'},{id:'b'}]));
 assert.notEqual(key,registerSummaryKey({...state,shift:'Evening'},[{id:'a'},{id:'b'}]));
 assert.notEqual(key,registerSummaryKey(state,[{id:'a'}]));
});
