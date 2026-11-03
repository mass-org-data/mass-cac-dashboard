import fs from 'node:fs';
import assert from 'node:assert/strict';
import {reviewedCalculations} from '../../src/live/reviewed-calculations.js';
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),cases=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const results=fs.readFileSync(process.argv[4],'utf8').split('\n').filter(s=>s.startsWith('{"case":')).map(s=>JSON.parse(s));
assert.equal(results.length,cases.length,'SQL result coverage');
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]]));
function canonical(m){return {
 ...pick(m,['enrolments','children','grades','ambiguousGrades','genders','attendance','activity','changes','delivery','bands']),
 quarters:m.quarters.sort((a,b)=>a.quarter-b.quarter).map(q=>pick(q,['quarter','n','mean','low','developing','good','strong','precision_review','above20'])),
 centres:m.centres.sort((a,b)=>a.id.localeCompare(b.id)).map(c=>({...pick(c,['id','enrolments','children','attendance']),activity:pick(c.activity,['eligible','available','participants','rate']),quarters:c.quarters.sort((a,b)=>a.quarter-b.quarter).map(q=>pick(q,['quarter','n','mean']))})),
 morarji:m.morarji.sort((a,b)=>a.cohortId.localeCompare(b.cohortId)),morarjiYears:m.morarjiYears.sort((a,b)=>a.academicYear.localeCompare(b.academicYear))};}
function equal(a,b,path=''){
 if(typeof a==='number'&&typeof b==='number'){if(Math.abs(a-b)>1e-9)throw Error(path+' numeric mismatch');return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path+' keys');for(const key of Object.keys(a))equal(a[key],b[key],path+'.'+key);return;}
 assert.equal(a,b,path);
}
const failures=[];
for(const row of results){const c=cases[row.case],centres=data.centres.filter(x=>c.context.centres.includes(x.id));const m=reviewedCalculations(data.db,centres,{page:'overview',today:'2026-11-03',academicYear:data.db.academicYear,month:c.month,grade:c.grade,shift:c.shift,gender:c.gender,fromExam:'F'+c.earlier,toExam:'F'+c.later,...c.context});try{equal(canonical(m),canonical(row.result));}catch(error){failures.push({case:row.case,kind:c.context.kind,month:c.month,grade:c.grade,shift:c.shift,gender:c.gender,error:error.message});}}
console.log(JSON.stringify({cases:cases.length,passed:cases.length-failures.length,failed:failures.length,firstFailures:failures.slice(0,8),boundary:'Independent JavaScript calculation module versus authenticated scoped SQL proposal on synthetic isolated PG17; not hosted deployment.'}));
if(failures.length)process.exitCode=1;
