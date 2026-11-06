// Private snapshots and authorized read-only results only. No account or DDL calls.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {reviewedCalculations} from '../../src/live/reviewed-calculations.js';
const folder=process.argv[2];
if(!folder||path.resolve(folder).startsWith(path.resolve('.')+path.sep))throw Error('Private output directory outside repository required');
const read=n=>JSON.parse(fs.readFileSync(path.join(folder,n+'.backend.private.json'),'utf8'));
const p=read('programme')[0].data,d=read('directory')[0].data;
const centres=d.centres.map(c=>({id:c.id,name:c.label,donor:c.donor_id,officers:[...new Set(d.assignments.filter(a=>a.centre_id===c.id&&a.role_code==='Cluster Officer').map(a=>a.staff_member_id))]}));
const year=p.years.find(y=>y.starts_on==='2026-04-01');assert(year);
const details={};for(const a of p.assessments){const def=p.definitions.find(d=>d.id===a.definition_id),q=p.periods.find(q=>q.id===def.period_id);details[a.enrolment_id+'|F'+q.quarter]={...a,academicYear:q.academic_year_id,maxMarks:def.max_score};}
const db={students:p.students,academicYear:year.id,assessmentDetails:details,references:{academic_years:p.years,assessment_periods:p.periods,assessment_definitions:p.definitions},attendanceRecords:Object.fromEntries(p.attendance.map(a=>[a.id,a])),attendance:Object.fromEntries(p.attendance.map(a=>[a.enrolment_id+'|'+a.attendance_date,a.code])),calendar:p.calendar.map(c=>({centre:c.centre_id,shift:c.shift_code,date:c.session_date,status:c.is_scheduled?'Planned':'Not Scheduled'})),events:[],participationRecords:{},sessions:[],morarjiHistory:[]};
const contexts=[{kind:'all',centres:centres.map(c=>c.id)}];
for(const c of centres)contexts.push({kind:'centre',centres:[c.id]});
for(const donor of [...new Set(centres.map(c=>c.donor))])contexts.push({kind:'donor',centres:centres.filter(c=>c.donor===donor).map(c=>c.id)});
for(const officer of [...new Set(centres.flatMap(c=>c.officers))])contexts.push({kind:'officer',centres:centres.filter(c=>c.officers.includes(officer)).map(c=>c.id)});
const cases=[];for(const scope of contexts){const filters=scope.kind==='all'?['','1','5','6','10'].flatMap(grade=>['','Morning','Evening'].flatMap(shift=>['','Girl','Boy','Unknown'].map(gender=>({grade,shift,gender})))):scope.kind==='centre'?[{}]:['','Morning','Evening'].flatMap(shift=>['','Girl','Boy','Unknown'].map(gender=>({shift,gender})));
 for(const month of ['2026-04','2026-10'])for(const filter of filters)for(const [earlier,later]of scope.kind==='all'?[[1,2],[2,1]]:[[1,2]]){const m=Number(month.slice(5)),on_date=new Date(Date.UTC(2026,m,0)).toISOString().slice(0,10),until_date=new Date(Date.UTC(2026,m,1)).toISOString().slice(0,10);cases.push({case_id:cases.length,centres:scope.centres,kind:scope.kind,on_date,from_date:month+'-01',until_date,year_id:year.id,grade:filter.grade||null,shift:filter.shift||null,gender:filter.gender||null,earlier,later});}}
const query=fs.readFileSync(new URL('../../tests/reviewed-calculations/hosted-readonly.sql',import.meta.url),'utf8'),all=[];
for(let i=0;i<cases.length;i+=20){const batch=cases.slice(i,i+20);const response=spawnSync('python',[new URL('./read_only_query.py',import.meta.url).pathname],{input:JSON.stringify({read_only:true,query:query.replace('__CASES__',"'"+JSON.stringify(batch).replaceAll("'","''")+"'")}),encoding:'utf8',maxBuffer:4*1024*1024,timeout:100000});if(response.status!==0)throw Error('Read-only query unavailable; no private provider response printed');all.push(...JSON.parse(response.stdout));}
fs.writeFileSync(path.join(folder,'reviewed-live-results.private.json'),JSON.stringify({cases,all}),{mode:0o600});
const keys=['enrolments','children','grades','ambiguousGrades','genders','attendance'];const failures=[];
function equal(a,b,p=''){if(typeof a==='number'&&typeof b==='number'){assert(Math.abs(a-b)<1e-9,p);return;}if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),p);for(const k of Object.keys(a))equal(a[k],b[k],p+'.'+k);return;}assert.equal(a,b,p);}
for(const row of all){const c=cases[row.case_id],m=reviewedCalculations(db,centres.filter(x=>c.centres.includes(x.id)),{page:'overview',today:'2026-11-03',month:c.from_date.slice(0,7),academicYear:c.year_id,grade:c.grade||'',shift:c.shift||'',gender:c.gender||'',fromExam:'F'+c.earlier,toExam:'F'+c.later});try{for(const k of keys)equal(m[k],row.result[k],k);for(const q of row.result.quarters){const jq=m.quarters.find(j=>j.quarter===q.quarter);for(const k of Object.keys(q))equal(jq[k],q[k],'quarter.'+k);}for(const k of Object.keys(row.result.changes))equal(m.changes[k],row.result.changes[k],'change.'+k);}catch(e){failures.push({case:row.case_id,kind:c.kind,error:e.message});}}
assert.equal(all.length,cases.length);const summary={cases:cases.length,passed:cases.length-failures.length,failed:failures.length,contexts:Object.fromEntries(['all','centre','donor','officer'].map(k=>[k,contexts.filter(c=>c.kind===k).length])),months:['2026-04','2026-10'],boundary:'Privileged read-only SQL versus frontend math; not a staff-session or protected Preview test.',firstFailures:failures.slice(0,5)};
fs.writeFileSync(path.join(folder,'reviewed-live-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));if(failures.length)process.exitCode=1;
