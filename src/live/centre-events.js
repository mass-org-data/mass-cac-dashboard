import {escapeHtml as esc} from './html.js';
import {monthWindow} from './model.js';

export async function discoverCentreEvents(rpc){
 try {const value=await rpc('get_centre_event_capabilities');if(value?.version!==1)throw Error('Centre event API version is not supported.');return true;}
 catch(error){if(error.rpc==='get_centre_event_capabilities'&&error.status===404&&error.code==='PGRST202')return false;throw error;}
}
export const eventIncludesStudent=(event,student)=>student.centre===event.centre&&(event.shift==='Both shifts'||student.shift===event.shift)&&student.enrolled<=event.date&&(!student.exitDate||event.date<student.exitDate);
export function createCentreEventSummary({rpc,rerender}){
 const cache=new Map();let epoch=0;
 return {invalidate(){epoch++;cache.clear();},render(state,centres){
  const key=JSON.stringify([state.month,centres.map(c=>c.id).sort()]);
  if(!cache.has(key)){
   const sequence=epoch,{from,until}=monthWindow(state.month);cache.set(key,{pending:true});
   void (centres.length?rpc('centre_event_summary',{p_centres:centres.map(c=>c.id),p_from:from,p_until:until}):Promise.resolve([])).then(rows=>{if(sequence===epoch){cache.set(key,{rows});rerender();}}).catch(error=>{if(sequence===epoch){cache.set(key,{error:error.message});rerender();}});
  }
  const value=cache.get(key),content=value.pending?'<p role="status">Loading centre events…</p>':value.error?`<p role="alert">${esc(value.error)}</p>`:`<div class="table-scroll"><table><thead><tr><th>Centre</th><th>Activities held / monthly plan</th><th>MM held / monthly plan</th></tr></thead><tbody>${value.rows.map(r=>`<tr><td>${esc(centres.find(c=>c.id===r.centre_id)?.name||r.centre_id)}</td><td>${Number(r.activity_held)} / ${Number(r.activity_planned)}</td><td>${Number(r.meeting_held)} / ${Number(r.meeting_planned)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="card table-card"><div class="table-head"><div><h2>Centre Activities & Monthly Meetings</h2><p>Both shifts together · ${esc(state.month)}</p></div></div><p class="chart-note">Monthly plan: four activities and one MM per centre. Counts show recorded centre-wide events marked Held; zero means none recorded, not proof that none happened. Historical shift-specific events remain in their original records. Student filters do not change the centre-level plan. Participation does not add classroom attendance days.</p>${content}</section>`;
 }};
}
export function participationChanges(students,event,records,values){
 return students.flatMap(s=>{const old=records[s.id+'|'+event],value=values['p_'+s.id],participated=value==='Attended'?true:value==='Not attended'?false:null;return participated===(old?.participated??null)?[]:[{enrolment:s.enrolmentId,event,participated,expected:old?.row_version||0}];});
}
