// Administrative pseudonymous export is a PRIVATE input, never a repository fixture.
// This script performs no network calls/writes and prints only aggregate results.
import fs from 'node:fs';
import {programmePopulation} from '../../src/live/population.js';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))[0].data;
const centres=input.centres.map(c=>({id:c.id,donor:c.donor}));
const students=input.students.map(s=>({id:s.enrolment_id,childId:s.id,studentId:s.student_id,centre:s.centre,grade:s.grade,shift:s.shift,gender:s.gender,enrolled:s.starts_on,exitDate:s.ends_before}));
let tested=0,failed=0;
for(const c of centres)for(const month of ['2026-07','2026-08','2026-09','2026-10'])for(const shift of ['','Morning','Evening'])for(const grade of ['',...Array.from({length:10},(_,i)=>String(i+1))])for(const gender of ['','Girl','Boy']){
 const monthEnd=new Date(Date.UTC(2026,Number(month.slice(5)),0)).toISOString().slice(0,10),on=monthEnd<'2026-10-29'?monthEnd:'2026-10-29';const expected=input.students.filter(s=>s.centre===c.id&&s.starts_on<=on&&(!s.ends_before||s.ends_before>on)&&(!shift||s.shift===shift)&&(!grade||s.grade===grade)&&(!gender||s.gender===gender)).length;
 const actual=programmePopulation(students,centres,{page:'overview',today:'2026-10-29',month,centre:c.id,grade,gender,shift}).length;
 tested++;if(actual!==expected)failed++;
}
console.log(JSON.stringify({tested,failed,passed:tested-failed,boundary:'Actual shared UI population function versus independent private administrative export; not hosted staff Auth or browser certification.'}));
if(failed)process.exitCode=1;
