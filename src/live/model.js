import {date} from './api.js';

export const liveToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function monthWindow(month) {
  const from=date(`${month}-01`),end=new Date(`${from}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth()+1);
  return {from,until:end.toISOString().slice(0,10)};
}
export function activeOn(row,on) { return row.starts_on<=on && (!row.ends_before || on<row.ends_before); }
export function roster(data,on,filters={}) {
  return data.students.filter(s=>activeOn(s,on) && matches(s,filters));
}
export function matches(row,{shift='',grade='',gender='',query=''}={}) {
  return (!shift || row.shift_code===shift) && (!grade || row.grade_label===grade) &&
    (!gender || row.gender_code===gender) &&
    (!query || `${row.full_name || ''} ${row.student_id}`.toLowerCase().includes(query.toLowerCase()));
}
export function filteredFacts(data,kind,filters={}) {
  const episodes=new Map(data.students.map(e=>[e.enrolment_id,e]));
  return data[kind].filter(r=>{
    const episode=episodes.get(r.enrolment_id);
    return episode && matches(episode,filters);
  });
}
export function attendanceTotals(rows,calendar=[]) {
  const holiday=r=>calendar.some(s=>!s.is_scheduled&&s.centre_id===r.centre_id&&s.shift_code===r.shift_code&&s.session_date===r.attendance_date);
  const count=code=>rows.filter(r=>r.code===code&&!holiday(r)).length;
  const p=count('P'),a=count('A'),l=count('L'),denominator=p+a+l;
  return {p,a,l,excluded:rows.filter(r=>['WO','MM'].includes(r.code)||holiday(r)).length,percentage:denominator?100*p/denominator:null};
}
export function quarterLabel(definition,refs) {
  const period=refs.assessment_periods.find(p=>p.id===definition.period_id);
  const year=refs.academic_years.find(y=>y.id===period?.academic_year_id);
  return period && year?`${year.starts_on.slice(0,4)}–${year.ends_before.slice(0,4)} · Q${period.quarter}`:'Unresolved period';
}
export function quarterWindow(definition,refs) {
  const period=refs.assessment_periods.find(p=>p.id===definition.period_id);
  const year=refs.academic_years.find(y=>y.id===period?.academic_year_id);
  if(!year||!period||!Number.isInteger(period.quarter)||period.quarter<1||period.quarter>4)throw new Error('An approved academic year and quarter are required.');
  const from=new Date(`${date(year.starts_on)}T12:00:00Z`);from.setUTCMonth(from.getUTCMonth()+(period.quarter-1)*3);
  const until=new Date(from);until.setUTCMonth(until.getUTCMonth()+3);
  return {from:from.toISOString().slice(0,10),until:until.toISOString().slice(0,10)};
}
export function emptyCentre(centre) {
  return {centre,students:[],attendance:[],calendar:[],assessments:[],activities:[],participation:[],morarji:[]};
}
export function combineCentres(results) {
  const combined=emptyCentre(results.length===1?results[0].centre:'all');
  for(const result of results)for(const key of Object.keys(combined).filter(k=>k!=='centre')){
    combined[key].push(...result[key].map(row=>({...row,centre_id:result.centre})));
  }
  return combined;
}
export function eligibleEpisode(data,child,on,shift) {
  const rows=data.students.filter(e=>e.child_id===child && e.shift_code===shift && activeOn(e,on));
  if(rows.length!==1) throw new Error('A single verified enrolment for this date and shift is required. Review the historical assignments.');
  return rows[0];
}
