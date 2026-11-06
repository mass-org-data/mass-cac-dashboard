export function reportingOn(state){if(state.page==='daily')return state.date;if(!state.today)return state.month+'-01';const [y,m]=state.month.split('-').map(Number);const end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);return end<state.today?end:state.today;}
// One episode-aware selection shared by the original tables, KPIs and exports.
export function programmePopulation(students,centres,state,{ignoreGender=false}={}) {
  const allowed=new Set(centres.filter(c=>(!state.centre||c.id===state.centre)&&(!state.donor||c.donor===state.donor)&&(!state.officer||(c.officers||[c.officer]).includes(state.officer))).map(c=>c.id));
  const on=reportingOn(state);
  return students.filter(s=>allowed.has(s.centre)&&s.enrolled<=on&&(!s.exitDate||on<s.exitDate)&&(!state.grade||s.grade===state.grade)&&(!state.shift||s.shift===state.shift)&&(ignoreGender||!state.gender||(state.gender==='Unknown'?!s.gender:s.gender===state.gender))&&(!state.query||`${s.name||''} ${s.studentId||''}`.toLowerCase().includes(state.query.toLowerCase())));
}
// Directory scope is authorized by get_context. Do not infer centre associations
// from another centre's students, and do not infer shifts from missing values.
export function filterCentres(centres,state) {
  return centres.filter(c=>(!state.donor||c.donor===state.donor)&&(!state.officer||(c.officers||[c.officer]).includes(state.officer)));
}
export function filterOptions(students,centres,state,{profileReadable=true}={}) {
  // Visit shifts are approved record enums, not student timetable assertions.
  if(state.page==='visits')return {shift:['Evening','Morning'],grade:[],gender:[]};
  // Shift is upstream of Grade: ignoring the old grade lets staff switch shifts.
  // Grade respects the selected shift. Gender is a protected facet, never a
  // masked-profile inference. Text search filters rows, not reference choices.
  const base={...state,query:'',gender:profileReadable?state.gender:''};
  const rowsFor=key=>programmePopulation(students,centres,{...base,[key]:'',...(key==='shift'?{grade:''}:{})});
  return Object.fromEntries(['shift','grade','gender'].map(key=>{
    const rows=key==='gender'&&!profileReadable?[]:rowsFor(key);
    const values=rows.map(s=>key==='gender'?(s.gender||'Unknown'):s[key]).filter(Boolean);
    return [key,[...new Set(values)].sort((a,b)=>key==='grade'?Number(a)-Number(b):a.localeCompare(b))];
  }));
}
export function reconcilePopulationFilters(students,centres,state,{profileReadable=true,changed=''}={}) {
  const next={...state};
  if(next.donor&&!centres.some(c=>c.donor===next.donor))next.donor='';
  if(next.officer&&!centres.some(c=>(!next.donor||c.donor===next.donor)&&(c.officers||[c.officer]).includes(next.officer)))next.officer='';
  if(next.centre&&!filterCentres(centres,next).some(c=>c.id===next.centre))next.centre='';
  if(next.page==='visits')return {...next,shift:['Morning','Evening'].includes(next.shift)?next.shift:'',grade:'',gender:''};
  // First validate upstream choices without an obsolete downstream demographic.
  // A freshly selected gender is authoritative for its available grade facet.
  let options=filterOptions(students,centres,{...next,gender:changed==='gender'?next.gender:''},{profileReadable});
  if(next.shift&&!options.shift.includes(next.shift))next.shift='';
  options=filterOptions(students,centres,{...next,gender:changed==='gender'?next.gender:''},{profileReadable});
  if(next.grade&&!options.grade.includes(next.grade))next.grade='';
  if(profileReadable&&next.gender&&!filterOptions(students,centres,next,{profileReadable}).gender.includes(next.gender))next.gender='';
  // With private profiles masked, gender validity must be established by the
  // authorized aggregate loader, not by treating masked NULL as Unknown.
  return next;
}
export function resetPopulationFilters(state,years,today) {
  const year=years.find(y=>y.id===state.academicYear);
  const within=year&&year.starts_on<=today&&today<year.ends_before;
  const date=year&&!within?year.starts_on:today;
  return {...state,centre:'',shift:'',grade:'',gender:'',officer:'',donor:'',query:'',concerns:false,engagementFilter:'',month:date.slice(0,7),date,exam:'F2',comparison:'F1|F2',fromExam:'F1',toExam:'F2'};
}
export function safeCsvCell(value){const s=String(value??'');return '"'+(/^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}
export function visitMetrics(rows,centres,{month,shift='',officer=''}={}){
 const ids=new Set(centres.map(c=>c.id));const completed=rows.filter(v=>ids.has(v.centre)&&v.date.startsWith(month)&&v.status==='Completed'&&(!officer||v.officer===officer));
 const morning=completed.filter(v=>v.shift==='Morning').length,evening=completed.filter(v=>v.shift==='Evening').length;
 const target=centres.length*(shift?2:4),actual=shift==='Morning'?morning:shift==='Evening'?evening:completed.length;
 const achieved=centres.filter(c=>['Morning','Evening'].every(s=>completed.filter(v=>v.centre===c.id&&v.shift===s).length>=2)).length;
 return {morning,evening,target,actual,percentage:target?100*actual/target:null,achieved};
}
