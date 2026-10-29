import {programmePopulation} from './population.js';
import {attendanceTotals,monthWindow} from './model.js';

// Minimized summaries of data ALREADY returned by authenticated, centre-scoped
// read RPCs. Never broadens profile access or manufactures gender/quarter data.
export function baselineAggregates(db,centres,state) {
 if(state.gender)throw Error('Gender-filtered reporting needs the approved demographic aggregate API.');
 const {from,until}=monthWindow(state.month);
 const episodeCentres=new Map(db.students.map(s=>[s.id,s.centre]));
 const byCentre=new Map(centres.map(c=>[c.id,[]]));
 for(const fact of Object.values(db.attendanceRecords)){
  if(fact.attendance_date<from||fact.attendance_date>=until)continue;
  const centre=episodeCentres.get(fact.enrolment_id);
  if(!byCentre.has(centre))throw Error('Attendance has an unavailable authorized enrolment. Reload the complete scope.');
  byCentre.get(centre).push(fact);
 }
 return centres.map(c=>{
  const students=programmePopulation(db.students,centres,{...state,centre:c.id,gender:'',donor:'',officer:'',query:''});
  const episodes=new Set(students.map(s=>s.id));
  const facts=byCentre.get(c.id).filter(r=>episodes.has(r.enrolment_id)).map(r=>({...r,centre_id:c.id}));
  const calendar=(db.calendar||[]).filter(r=>r.centre===c.id).map(r=>({centre_id:r.centre,shift_code:r.shift,session_date:r.date,is_scheduled:r.status!=='Not Scheduled'}));
  const attendance=attendanceTotals(facts,calendar),grades={};
  for(const student of students)grades[student.grade]=(grades[student.grade]||0)+1;
  return {centre_id:c.id,students:students.length,grades,genders:{},attendance:{p:attendance.p,a:attendance.a,l:attendance.l,excluded:attendance.excluded},quarters:[],changes:[]};
 });
}
