// PRIVATE administrative export only. No network calls or personal output.
// Input must include an independently verified calendarRowCount=0 when calendar
// rows are absent. This never treats a missing calendar export as no holidays.
import fs from 'node:fs';
import {baselineAggregates} from '../../src/live/baseline-aggregates.js';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(input.calendarRowCount!==0)throw Error('This fixture requires a verified empty calendar; do not infer it from a missing export.');
const raw=input.data,centres=raw.centres.map(c=>({id:c.id,donor:c.donor}));
const students=raw.students.map(s=>({id:s.enrolment_id,centre:s.centre,grade:s.grade,shift:s.shift,enrolled:s.starts_on,exitDate:s.ends_before}));
const facts=raw.attendance.map(([id,child_id,centre_id,enrolment_id,shift_code,attendance_date,code])=>({id,child_id,centre_id,enrolment_id,shift_code,attendance_date,code}));
const db={students,attendanceRecords:Object.fromEntries(facts.map(r=>[r.id,r])),calendar:[]};
let checked=0,failed=0;
for(const month of ['2026-07','2026-08','2026-09','2026-10'])for(const shift of ['','Morning','Evening'])for(const grade of ['',...Array.from({length:10},(_,i)=>String(i+1))]){
 const on=month==='2026-10'?'2026-10-29':new Date(Date.UTC(2026,Number(month.slice(5)),0)).toISOString().slice(0,10);
 const eligible=raw.students.filter(s=>s.starts_on<=on&&(!s.ends_before||on<s.ends_before)&&(!grade||s.grade===grade)&&(!shift||s.shift===shift));
 const episodeSet=new Set(eligible.map(s=>s.enrolment_id));
 const expected=new Map(centres.map(c=>[c.id,{students:eligible.filter(s=>s.centre===c.id).length,p:0,a:0,l:0,excluded:0}]));
 for(const r of facts){if(!r.attendance_date.startsWith(month)||!episodeSet.has(r.enrolment_id))continue;const e=expected.get(r.centre_id);if(['P','A','L'].includes(r.code))e[r.code.toLowerCase()]++;else if(['WO','MM'].includes(r.code))e.excluded++;}
 const actual=baselineAggregates(db,centres,{month,today:'2026-10-29',page:'overview',shift,grade});
 for(const r of actual){checked++;const e=expected.get(r.centre_id);if(r.students!==e.students||['p','a','l','excluded'].some(k=>r.attendance[k]!==e[k]))failed++;}
}
console.log(JSON.stringify({checked,failed,passed:checked-failed,boundary:'New baseline summaries versus independent private administrative source rows; not hosted staff Auth or Preview verification.'}));
if(failed)process.exitCode=1;
