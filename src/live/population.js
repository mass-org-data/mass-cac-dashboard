export function reportingOn(state){if(state.page==='daily')return state.date;if(!state.today)return state.month+'-01';const [y,m]=state.month.split('-').map(Number);const end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);return end<state.today?end:state.today;}
// One episode-aware selection shared by the original tables, KPIs and exports.
export function programmePopulation(students,centres,state,{ignoreGender=false}={}) {
  const allowed=new Set(centres.filter(c=>(!state.centre||c.id===state.centre)&&(!state.donor||c.donor===state.donor)&&(!state.officer||(c.officers||[c.officer]).includes(state.officer))).map(c=>c.id));
  const on=reportingOn(state);
  return students.filter(s=>allowed.has(s.centre)&&s.enrolled<=on&&(!s.exitDate||on<s.exitDate)&&(!state.grade||s.grade===state.grade)&&(!state.shift||s.shift===state.shift)&&(ignoreGender||!state.gender||s.gender===state.gender)&&(!state.query||`${s.name||''} ${s.studentId||''}`.toLowerCase().includes(state.query.toLowerCase())));
}
export function filterOptions(students,centres,state) {
  const base={...state,grade:'',shift:'',gender:'',query:''};
  const rows=programmePopulation(students,centres,base);
  return Object.fromEntries(['grade','shift','gender'].map(k=>[k,[...new Set(rows.map(s=>s[k]).filter(Boolean))].sort((a,b)=>k==='grade'?Number(a)-Number(b):a.localeCompare(b))]));
}
export function safeCsvCell(value){const s=String(value??'');return '"'+(/^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}
export function visitMetrics(rows,centres,{month,shift='',officer=''}={}){
 const ids=new Set(centres.map(c=>c.id));const completed=rows.filter(v=>ids.has(v.centre)&&v.date.startsWith(month)&&v.status==='Completed'&&(!officer||v.officer===officer));
 const morning=completed.filter(v=>v.shift==='Morning').length,evening=completed.filter(v=>v.shift==='Evening').length;
 const target=centres.length*(shift?2:4),actual=shift==='Morning'?morning:shift==='Evening'?evening:completed.length;
 const achieved=centres.filter(c=>['Morning','Evening'].every(s=>completed.filter(v=>v.centre===c.id&&v.shift===s).length>=2)).length;
 return {morning,evening,target,actual,percentage:target?100*actual/target:null,achieved};
}
