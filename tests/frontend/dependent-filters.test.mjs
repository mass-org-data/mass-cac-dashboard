import test from 'node:test';
import assert from 'node:assert/strict';
import {programmePopulation,filterOptions,filterCentres,reconcilePopulationFilters,resetPopulationFilters} from '../../src/live/population.js';
import {reviewedCalculations} from '../../src/live/reviewed-calculations.js';
const centres=[{id:'a',donor:'d1',officers:['o1']},{id:'b',donor:'d2',officers:['o2']},{id:'empty',donor:'d1',officers:['o1']}];
const state={page:'overview',today:'2026-11-04',month:'2026-10',academicYear:'y',donor:'',centre:'',officer:'',shift:'',grade:'',gender:'',query:''};
const row=(id,centre,shift,grade,extra={})=>({id,enrolmentId:id,childId:id,centre,shift,grade,gender:'Girl',enrolled:'2026-04-01',exitDate:null,...extra});
const students=[row('a1','a','Morning','1'),row('a5','a','Morning','5'),row('a6','a','Evening','6'),row('a5e','a','Evening','5'),row('b9','b','Evening','9'),row('old','a','Morning','3',{exitDate:'2026-10-01'}),row('future','a','Morning','10',{enrolled:'2026-11-01'}),row('null','b',null,null),row('duplicate','a','Morning','5',{childId:'a5'})];
test('Morning grades use distinct actual eligible associations, excluding past/future assignments',()=>assert.deepEqual(filterOptions(students,centres,{...state,shift:'Morning'}).grade,['1','5']));
test('Evening grades differ and preserve shared grades',()=>assert.deepEqual(filterOptions(students,centres,{...state,shift:'Evening'}).grade,['5','6','9']));
test('Donor→Centre→Shift→Grade shares the authorized directory and population',()=>{
 const s={...state,donor:'d1',centre:'a',shift:'Evening'};
 assert.deepEqual(filterCentres(centres,s).map(c=>c.id),['a','empty']);assert.deepEqual(filterOptions(students,centres,s).grade,['5','6']);
 assert.deepEqual(filterOptions(students,centres,{...s,donor:'d2',centre:'b'}).grade,['9']);
});
test('Centre and officer scope exclude another centre even when names/grades overlap',()=>{
 assert.deepEqual(filterOptions(students,centres,{...state,centre:'b'}).grade,['9']);
 assert.deepEqual(filterOptions(students,centres,{...state,officer:'o2'}).shift,['Evening']);
 assert.deepEqual(filterOptions(students,centres.slice(0,1),{...state,shift:'Evening'}).grade,['5','6']);
});
test('Historical snapshot and exclusive assignment end govern options',()=>{
 assert.deepEqual(filterOptions(students,centres,{...state,month:'2026-09',centre:'a',shift:'Morning'}).grade,['1','3','5']);
 assert.deepEqual(filterOptions(students,centres,{...state,month:'2026-11',centre:'a',shift:'Morning'}).grade,['1','5','10']);
 assert.deepEqual(filterOptions(students,centres,{...state,page:'daily',date:'2026-09-30',centre:'a',shift:'Morning'}).grade,['1','3','5']);
});
test('Changing shift clears an invalid grade and retains a still-valid grade',()=>{
 assert.equal(reconcilePopulationFilters(students,centres,{...state,shift:'Evening',grade:'1'},{changed:'shift'}).grade,'');
 assert.equal(reconcilePopulationFilters(students,centres,{...state,shift:'Evening',grade:'5'},{changed:'shift'}).grade,'5');
 assert.deepEqual(filterOptions(students,centres,{...state,grade:'1'}).shift,['Evening','Morning']);
});
test('Donor changes clear stale centre, officer, shift and grade without inventing replacements',()=>{
 const s=reconcilePopulationFilters(students,centres,{...state,donor:'d2',centre:'a',officer:'o1',shift:'Morning',grade:'1'},{changed:'donor'});
 assert.equal(s.centre,'');assert.equal(s.officer,'');assert.equal(s.shift,'');assert.equal(s.grade,'');assert.deepEqual(filterOptions(students,centres,s).grade,['9']);
});
test('Reset stays inside the selected verified academic year',()=>{
 const years=[{id:'past',starts_on:'2025-04-01',ends_before:'2026-04-01'},{id:'y',starts_on:'2026-04-01',ends_before:'2027-04-01'}];
 assert.equal(resetPopulationFilters({...state,academicYear:'past',shift:'Morning',grade:'1'},years,state.today).month,'2025-04');
 const s=resetPopulationFilters({...state,centre:'a',shift:'Morning',grade:'1',gender:'Girl'},years,state.today);assert.equal(s.month,'2026-11');for(const key of ['centre','shift','grade','gender','donor','officer'])assert.equal(s[key],'');
});
test('Missing grade/shift and empty combinations do not create placeholder associations',()=>{
 assert.deepEqual(filterOptions([row('n','a',null,null)],centres,state),{shift:[],grade:[],gender:['Girl']});
 assert.deepEqual(filterOptions(students,centres,{...state,centre:'empty'}).grade,[]);
 assert.equal(programmePopulation(students,centres,{...state,centre:'a',shift:'Evening',grade:'1'}).length,0);
 const visits=reconcilePopulationFilters([],centres,{...state,page:'visits',shift:'Evening',grade:'5'});assert.equal(visits.shift,'Evening');assert.equal(visits.grade,'');assert.deepEqual(filterOptions([],centres,visits).shift,['Evening','Morning']);
});
test('Gender facets respect source data; masked values never supply a gender filter',()=>{
 const ss=[row('g1','a','Morning','1'),row('b2','a','Morning','2',{gender:'Boy'})];
 assert.deepEqual(filterOptions(ss,centres,{...state,gender:'Girl'}).grade,['1']);
 assert.deepEqual(filterOptions(ss,centres,{...state,gender:'Girl'},{profileReadable:false}).grade,['1','2']);
 assert.deepEqual(filterOptions(ss,centres,state,{profileReadable:false}).gender,[]);
});
test('Any-order changes converge; source refresh reconciles invalid choices and preserves valid ones',()=>{
 let s={...state,grade:'1'};s=reconcilePopulationFilters(students,centres,{...s,shift:'Evening'},{changed:'shift'});s=reconcilePopulationFilters(students,centres,{...s,donor:'d2'},{changed:'donor'});assert.equal(s.grade,'');assert.equal(s.shift,'Evening');
 s=reconcilePopulationFilters([row('replacement','b','Morning','2')],centres,{...s,grade:'9'});assert.equal(s.grade,'');assert.equal(s.shift,'');
});
test('Charts/KPIs/table-export population have identical combined selection with UUID deduplication',()=>{
 const s=reconcilePopulationFilters(students,centres,{...state,donor:'d1',centre:'a',shift:'Morning',grade:'5'});
 const population=programmePopulation(students,centres,s),m=reviewedCalculations({students,academicYear:'y'},centres,s);
 assert.deepEqual(population.map(s=>s.id),['a5','duplicate']);assert.equal(m.enrolments,2);assert.equal(m.children,1);assert.equal(m.grades['5'],1);assert.equal(m.centres.find(c=>c.id==='a').enrolments,population.length);
});
