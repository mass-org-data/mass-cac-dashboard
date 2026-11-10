import test from 'node:test';
import assert from 'node:assert/strict';
import {profileRows} from '../../src/live/profile-list.js';

const students = [
  {id:'2',studentId:'CAC-10',name:'Zoya',centre:'b',grade:'2',enrolled:'2026-06-01'},
  {id:'1',studentId:'CAC-2',name:'Anita',centre:'a',grade:'10',enrolled:'2026-07-01'},
  {id:'3',studentId:'CAC-3',name:'Bhavna',centre:'a',grade:'2',enrolled:'2026-05-01'},
];
const centreLabel = id => ({a:'Aralimatti',b:'Bastwad'})[id];

test('profile search covers authorized name, ID and centre label',()=>{
  assert.deepEqual(profileRows(students,{query:'cac-10',centreLabel}).map(row=>row.id),['2']);
  assert.deepEqual(profileRows(students,{query:'aralimatti',centreLabel}).map(row=>row.id),['1','3']);
  assert.deepEqual(profileRows(students,{query:'bhav',centreLabel}).map(row=>row.id),['3']);
});

test('profile rows support stable user-selected sorting',()=>{
  assert.deepEqual(profileRows(students,{sort:'id',centreLabel}).map(row=>row.studentId),['CAC-2','CAC-3','CAC-10']);
  assert.deepEqual(profileRows(students,{sort:'grade',centreLabel}).map(row=>row.id),['3','2','1']);
  assert.deepEqual(profileRows(students,{sort:'newest',centreLabel}).map(row=>row.id),['1','2','3']);
});
