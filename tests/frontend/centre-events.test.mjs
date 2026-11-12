import test from 'node:test';
import assert from 'node:assert/strict';
import {eventIncludesStudent,discoverCentreEvents,participationChanges} from '../../src/live/centre-events.js';
import {BackendError} from '../../src/live/api.js';
const event={id:'v',centre:'one',shift:'Both shifts',date:'2026-05-14'};
test('one centre event includes both shifts but never another centre or an ineligible date',()=>{
 for(const shift of ['Morning','Evening'])assert(eventIncludesStudent(event,{centre:'one',shift,enrolled:'2026-04-01'}));
 assert(!eventIncludesStudent(event,{centre:'two',shift:'Morning',enrolled:'2026-04-01'}));
 assert(!eventIncludesStudent(event,{centre:'one',shift:'Morning',enrolled:'2026-05-15'}));
 assert(!eventIncludesStudent(event,{centre:'one',shift:'Morning',enrolled:'2026-04-01',exitDate:'2026-05-14'}));
 assert(!eventIncludesStudent({...event,shift:'Morning'},{centre:'one',shift:'Evening',enrolled:'2026-04-01'}));
});
test('only an exactly missing optional event capability uses the legacy path',async()=>{
 assert(await discoverCentreEvents(async()=>({version:1})));
 assert.equal(await discoverCentreEvents(async()=>{throw new BackendError({code:'PGRST202'},404,false,'get_centre_event_capabilities');}),false);
 await assert.rejects(discoverCentreEvents(async()=>{throw new BackendError({code:'42501'},403,false,'get_centre_event_capabilities');}));
});
test('unmarked or unknown participation is never saved as non-participation',()=>{
 const students=[{id:'a',enrolmentId:'a'},{id:'b',enrolmentId:'b'}];
 assert.deepEqual(participationChanges(students,'v',{},{}),[]);
 assert.deepEqual(participationChanges(students,'v',{'a|v':{participated:null,row_version:1}},{p_a:'Unknown'}),[]);
 assert.deepEqual(participationChanges(students,'v',{'a|v':{participated:true,row_version:2}},{p_a:''}),[{enrolment:'a',event:'v',participated:null,expected:2}]);
 assert.deepEqual(participationChanges(students,'v',{}, {p_b:'Not attended'}),[{enrolment:'b',event:'v',participated:false,expected:0}]);
});
