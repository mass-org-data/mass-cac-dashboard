import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clearStoredSession} from '../../src/live/client.js';
import {programmePopulation,reportingOn} from '../../src/live/population.js';
test('default signout cleanup purges the actual persistent storage key',()=>{
 const removed=[],previous=globalThis.localStorage;globalThis.localStorage={removeItem:k=>removed.push(k)};
 try{clearStoredSession({project:'synthetic'});assert.deepEqual(removed,['mass-auth-synthetic','mass-auth-synthetic-code-verifier','mass-auth-synthetic-user']);}finally{globalThis.localStorage=previous;}
});
test('current month snapshot includes an observed mid-month enrolment',()=>{
 const state={month:'2026-10',today:'2026-10-29',page:'overview'};
 assert.equal(reportingOn(state),'2026-10-29');assert.equal(reportingOn({...state,month:'2026-09'}),'2026-09-30');
 const rows=[{centre:'a',enrolled:'2026-10-15',exitDate:null}];assert.equal(programmePopulation(rows,[{id:'a'}],state).length,1);
});
