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
test('original horizontal and grouped-column chart types and demographic quick filters are retained',()=>{
 const positive={...metrics,bands:{available:true,classified:1,unclassified:0,counts:{below15:1,exactly15:0,days16to20:0,days21to25:0,above25:0}},quarters:[{quarter:1,n:1,low:1,developing:0,good:0,strong:0,precision_review:0}],activity:{available:true,eligible:1,categories:{Sports:1}},genders:{Girl:1},morarji:[{cohort:'Synthetic cohort',cohortId:'c',academicYear:'y',members:1,attended:1,passed:1,knownPassed:1,applied:1}],morarjiYears:[{academicYear:'y',members:1,passed:1}]};
 const t={...tools,bar:(label,n)=>`<div class="bar-row">${label}: ${n??'—'}</div>`,columns:(rows,options={})=>`<div class="column-chart" data-gender-controls="${Boolean(options.gender)}">${JSON.stringify(rows)}</div>`};
 const v=n=>reviewedChartView(n,{state:{...state,morarjiYear:'Synthetic cohort'},metrics:positive,db:{...db,references:{academic_years:[{id:'y',starts_on:'2026-04-01',ends_before:'2027-04-01'}]}},selected,tools:t}).body;
 for(const n of [3,6,11,18]){assert.match(v(n),/class="bar-row"/);assert.doesNotMatch(v(n),/column-chart/);}
 assert.match(v(16),/column-chart/);assert.match(v(15),/data-year="Synthetic cohort"/);assert.match(v(23),/data-gender-controls="true"/);assert.match(v(25),/engagement-stack/);assert.match(v(25),/data-centre="a"/);
});
