import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedChartView,reviewedMetric} from '../../src/live/reviewed-chart-view.js';
import {reviewedCalculations,reviewedDecisionStatus} from '../../src/live/reviewed-calculations.js';
const tools={bar:(label,value)=>`${label}: ${value??'unavailable'}`,columns:rows=>JSON.stringify(rows),empty:text=>text,esc:text=>text};
const state={month:'2026-10',today:'2026-11-03',academicYear:'y',page:'overview',exam:'F1',fromExam:'F1',toExam:'F2'};
const selected=[{id:'a',name:'Synthetic centre'}],db={students:[],calendar:[],attendanceRecords:{},assessmentDetails:{},events:[],participationRecords:{},morarjiHistory:[],sessions:[]};
const metrics=reviewedCalculations(db,selected,state);
test('all24 numbered charts have reviewed contracts and render precise source/empty states',()=>{
 assert.equal(Object.keys(reviewedDecisionStatus).length,24);
 for(const number of Object.keys(reviewedDecisionStatus))assert(reviewedChartView(Number(number),{state,metrics,db,selected,tools}));
 assert.equal(reviewedDecisionStatus[20],'Approved through comments');
 assert.match(reviewedChartView(25,{state,metrics,db,selected,tools}).body,/colour-band boundaries/);
 assert.match(reviewedChartView(9,{state,metrics,db,selected,tools}).body,/same-child pair/);
 assert.doesNotMatch(reviewedChartView(9,{state,metrics,db,selected,tools}).body,/comparability.*pending/);
});
test('paired score KPI is a descriptive mark difference and unavailable masks never become zero',()=>{
 const m={...metrics,changes:{n:2,meanChange:2.5}};const k=reviewedMetric('Average score improvement',m,{periodAssessments:true});assert.equal(k.value,'+2.5 marks');
 assert.equal(reviewedMetric('Student attendance rate',{unavailable:'Scoped aggregate required'}).value,'—');
});
