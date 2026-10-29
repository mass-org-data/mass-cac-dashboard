import {test} from 'node:test';
import assert from 'node:assert/strict';
import {programmePopulation,filterOptions,safeCsvCell,visitMetrics} from '../../src/live/population.js';
const centres=[{id:'a',donor:'d',officers:['o']},{id:'b',donor:'e',officers:['p']}];
const rows=[{id:'e1',childId:'c',studentId:'ST_AA_1_01',name:'Synthetic learner',centre:'a',grade:'1',shift:'Morning',gender:'Girl',enrolled:'2026-04-01',exitDate:'2026-07-01'}, {id:'e2',childId:'c',studentId:'ST_AA_1_01',name:'Synthetic learner',centre:'b',grade:'2',shift:'Evening',gender:'Girl',enrolled:'2026-07-01',exitDate:''}];
const state={month:'2026-04',page:'overview'};
test('one population applies grade, gender, donor, centre, shift, search and officer',()=>{
 for(const filters of [{grade:'2'},{gender:'Boy'},{donor:'e'},{centre:'b'},{shift:'Evening'},{query:'no match'},{officer:'p'}])assert.equal(programmePopulation(rows,centres,{...state,...filters}).length,0);
 assert.equal(programmePopulation(rows,centres,{...state,query:'ST_AA_1_01'}).length,1);
});
test('historical episodes respect start and exclusive end without overwriting identity',()=>{assert.deepEqual(programmePopulation(rows,centres,{...state,month:'2026-07'}).map(s=>s.id),['e2']);assert.equal(rows[0].childId,rows[1].childId);assert.equal(programmePopulation(rows,centres,{...state,month:'2026-03'}).length,0);});
test('daily date and cascading centre options use the same eligible episodes',()=>{assert.equal(programmePopulation(rows,centres,{...state,page:'daily',date:'2026-07-01'})[0].centre,'b');assert.deepEqual(filterOptions(rows,centres,{...state,centre:'a'}),{grade:['1'],shift:['Morning'],gender:['Girl']});});
test('CSV quoting also prevents spreadsheet formula injection',()=>{for(const value of ['=1+1',' +1','-2','@SUM(A1)'])assert.ok(safeCsvCell(value).startsWith('"\''));assert.equal(safeCsvCell('plain "text"'),'"plain ""text"""');});
test('four morning visits never hide missing evening coverage; actual counts are uncapped',()=>{const make=(shift,status='Completed')=>({centre:'a',date:'2026-10-01',shift,status,officer:'o'});const a=Array.from({length:4},()=>make('Morning'));assert.equal(visitMetrics(a,[centres[0]],{month:'2026-10'}).achieved,0);const b=visitMetrics([...a,make('Evening'),make('Evening'),make('Evening','Planned')],[centres[0]],{month:'2026-10'});assert.deepEqual({actual:b.actual,target:b.target,percentage:b.percentage,achieved:b.achieved},{actual:6,target:4,percentage:150,achieved:1});});
