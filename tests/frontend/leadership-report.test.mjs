import test from 'node:test';
import assert from 'node:assert/strict';
import {sortCentreRows,combineMonthlyAttendance,attendanceLineChart} from '../../src/live/leadership-report.js';

test('centre rows sort numeric metrics descending and names deterministically',()=>{
  const rows=[{name:'Centre 10',students:4},{name:'Centre 2',students:8},{name:'Centre 1',students:8}];
  assert.deepEqual(sortCentreRows(rows,'students').map(row=>row.name),['Centre 1','Centre 2','Centre 10']);
  assert.deepEqual(sortCentreRows(rows,'name').map(row=>row.name),['Centre 1','Centre 2','Centre 10']);
});

test('annual attendance combines recorded P A L observations without averaging percentages',()=>{
  const combined=combineMonthlyAttendance([{attendance:{p:8,a:2,l:0}},{attendance:{p:1,a:1,l:8}},{pending:'loading'}]);
  assert.deepEqual({p:combined.p,a:combined.a,l:combined.l,loaded:combined.loaded},{p:9,a:3,l:8,loaded:2});
  assert.equal(combined.percentage,45);
});

test('attendance line chart leaves unknown months as gaps and exposes an accessible summary',()=>{
  const html=attendanceLineChart([{label:'Apr',value:75},{label:'May',value:null},{label:'Jun',value:50}],value=>value);
  assert.match(html,/Attendance by month: Apr: 75\.0%, May: unknown, Jun: 50\.0%/);
  assert.equal((html.match(/<polyline/g)||[]).length,2);
});
