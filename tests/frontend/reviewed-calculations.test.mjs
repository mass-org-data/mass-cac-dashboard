import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedCalculations} from '../../src/live/reviewed-calculations.js';
const centres=[{id:'a',donor:'d'},{id:'b',donor:'other'}];
const state={page:'overview',month:'2026-10',today:'2026-11-03',academicYear:'year',fromExam:'F1',toExam:'F2'};
const student=(id,childId=id,extra={})=>({id,childId,enrolmentId:id,centre:'a',grade:'5',shift:'Morning',gender:'Girl',enrolled:'2026-04-01',exitDate:null,...extra});
const db=students=>({students,academicYear:'year',attendance:{},attendanceRecords:{},calendar:[],events:[],participationRecords:{},assessmentDetails:{},sessions:[],morarjiHistory:[]});
test('monthly activity participants and category participants deduplicate by child, not event or episode',()=>{
 const data=db([student('e1','child'),student('e2','child'),student('e3','other')]);
 data.events=[{id:'v1',centre:'a',shift:'Morning',date:'2026-10-01',status:'Held',category:'Sports'},{id:'v2',centre:'a',shift:'Morning',date:'2026-10-02',status:'Held',category:'Sports'},{id:'v3',centre:'a',shift:'Morning',date:'2026-10-03',status:'Held',category:'Cultural'},{id:'v4',centre:'a',shift:'Morning',date:'2026-10-04',status:'Planned',category:'Sports'}];
 data.participationRecords={a:{enrolment_id:'e1',event_id:'v1',participated:true},b:{enrolment_id:'e1',event_id:'v2',participated:true},c:{enrolment_id:'e2',event_id:'v3',participated:true},d:{enrolment_id:'e3',event_id:'v1',participated:false},e:{enrolment_id:'e3',event_id:'v4',participated:true}};
 const m=reviewedCalculations(data,centres,state);assert.equal(m.enrolments,3);assert.equal(m.children,2);assert.equal(m.activity.participants,1);assert.equal(m.activity.rate,50);assert.deepEqual(m.activity.categories,{Sports:1,Cultural:1});assert.equal(m.grades['5'],2);
 assert.equal(reviewedCalculations({...data,events:[]},centres,state).activity.rate,null);
});
test('same-child paired exams retain zero, use scoped historical episodes and never match names',()=>{
 const data=db([student('old','child',{exitDate:'2026-07-01'}),student('new','child',{enrolled:'2026-07-01'}),student('missing','missing')]);
 data.assessmentDetails={'old|F1':{enrolment_id:'old',score:0,academicYear:'year',maxMarks:25},'new|F2':{enrolment_id:'new',score:10,academicYear:'year',maxMarks:25},'missing|F2':{enrolment_id:'missing',score:25,academicYear:'year',maxMarks:25}};
 const m=reviewedCalculations(data,centres,state);assert.equal(m.changes.n,1);assert.equal(m.changes.meanChange,10);assert.equal(m.quarters.find(q=>q.quarter===2).mean,17.5);assert.equal(m.quarters.find(q=>q.quarter===1).n,0);
 assert.equal(reviewedCalculations(data,centres,{...state,grade:'6'}).changes.n,0);
 assert.equal(reviewedCalculations(data,centres,state,{assessmentReady:false}).changes,null);
});
test('unknown recorded gender remains separate and masked genders are never inferred',()=>{
 const data=db([student('a','a',{gender:null}),student('b')]);const m=reviewedCalculations(data,centres,state);assert.deepEqual(m.genders,{Unknown:1,Girl:1});
 assert.equal(reviewedCalculations(data,centres,{...state,gender:'Unknown'}).children,1);
 assert.equal(reviewedCalculations(data,centres,state,{profileReadable:false}).genders,null);
 assert.match(reviewedCalculations(data,centres,{...state,gender:'Girl'},{profileReadable:false}).unavailable,/aggregate API/);
});
test('fractional scores remain in the available-score mean, but are not rounded into integer bands',()=>{
 const data=db([student('a'),student('b'),student('c')]);data.assessmentDetails={'a|F1':{score:0,academicYear:'year',maxMarks:25},'b|F1':{score:8.5,academicYear:'year',maxMarks:25}};
 const q=reviewedCalculations(data,centres,state).quarters[0];assert.equal(q.n,2);assert.equal(q.mean,4.25);assert.equal(q.low,1);assert.equal(q.precision_review,1);
});
test('grade chart counts each child once and holds conflicting active grades without choosing a winner',()=>{
 const data=db([student('a','same'),student('b','same',{grade:'6'})]);const m=reviewedCalculations(data,centres,state);assert.deepEqual(m.grades,{});assert.equal(m.ambiguousGrades,1);assert.equal(m.children,1);assert.equal(m.enrolments,2);
});
test('approved attendance formula excludes confirmed holidays and classification requires complete calendar',()=>{
 const data=db([student('a')]);for(const [i,code]of ['P','A','L','WO','MM','P'].entries()){const date='2026-10-0'+(i+1);data.attendance['a|'+date]=code;data.attendanceRecords[i]={enrolment_id:'a',attendance_date:date,shift_code:'Morning',code};}
 data.calendar=[{centre:'a',shift:'Morning',date:'2026-10-06',status:'Not Scheduled'}];const m=reviewedCalculations(data,centres,state);assert.equal(m.attendance.percentage,100/3);assert.equal(m.bands.available,false);
});
test('more than25 recorded present days do not silently enter the21–25 band',()=>{
 const data=db([student('a')]);for(let i=1;i<=31;i++){const date='2026-10-'+String(i).padStart(2,'0');data.calendar.push({centre:'a',shift:'Morning',date,status:'Planned'});data.attendance['a|'+date]='P';}
 const m=reviewedCalculations(data,centres,state);assert.equal(m.bands.classified,1);assert.equal(m.bands.counts.above25,1);assert.equal(m.bands.counts.days21to25,0);
});
test('Grade5 historical cohort counts retain unknown outcomes and use verified years only',()=>{
 const data=db([student('old','child',{exitDate:'2026-07-01'}),student('new','child',{grade:'6',enrolled:'2026-07-01'}),student('other')]);
 data.morarjiHistory=[{s:data.students[0],cohort_id:'c',cohort:'Verified cohort',cohortAcademicYear:'year',applied:true,attended:true,passed:true},{s:data.students[2],cohort_id:'c',cohort:'Verified cohort',cohortAcademicYear:'year',applied:null,attended:null,passed:null},{s:data.students[1],cohort_id:'wrong',cohort:'Grade6 excluded',cohortAcademicYear:'year',passed:true},{s:data.students[2],cohort_id:'undated',cohort:'Undated cohort',passed:null}];
 const m=reviewedCalculations(data,centres,state);assert.deepEqual(m.morarjiYears,[{academicYear:'year',members:2,passed:1,knownPassed:1}]);assert.equal(m.morarji.find(c=>c.cohortId==='undated').passed,null);assert.equal(m.morarji.some(c=>c.cohortId==='wrong'),false);
});
