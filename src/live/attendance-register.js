import {escapeHtml as esc} from './html.js';

export const attendanceCodes = ['P','A','L','MM','WO'];
const labels = {P:'Present',A:'Absent',L:'Leave',MM:'Monthly meeting',WO:'Weekly Off'};
export function changedAttendance(roster, saved, draft) {
 return roster.filter(s=>(attendanceCodes.includes(draft[s.id])||(saved[s.id]&&draft[s.id]==null))&&draft[s.id]!==saved[s.id])
  .map(s=>({enrolment:s.id,code:draft[s.id]??null}));
}
export function attendanceSummaryDisplay(row) {
 const ratio=`${row.present}/${row.total??'—'}`;
 const percentage=row.percentage===null?'—':`${Number(row.percentage).toFixed(1)}% (${row.present}/${row.eligible})`;
 return {ratio,percentage,incomplete:row.total!=null&&Number(row.recorded??row.eligible)<Number(row.total)};
}
export function registerSummaryKey(state, centres) {
 return JSON.stringify([state.month,state.shift||'',state.grade||'',state.gender||'',centres.map(c=>c.id).sort()]);
}

export function createAttendanceRegister({rpc,context,capabilities,refresh,rerender,getRole=()=>null}) {
 let epoch=0,editor=null;
 const summaries=new Map();
 const writable=context.centres.filter(c=>c.can_write&&(context.operational_roles_enabled===true||!context.centres.some(x=>x.roles.includes('Leadership'))));
 const allowedCentres=()=>writable.filter(c=>!getRole()||(getRole()!=='Leadership'&&c.roles.includes(getRole())));
 const canWrite=centre=>capabilities.enabled===true&&allowedCentres().some(c=>!centre||c.id===centre);
 const invalidate=()=>{epoch++;summaries.clear();};
 function table(state,centres) {
  if(!capabilities.version)return '<section class="card"><h2>Attendance register</h2><p>The attendance register API is not installed.</p></section>';
  const key=registerSummaryKey(state,centres);
  if(!summaries.has(key)) {
   const current=epoch;
   summaries.set(key,{pending:true});
   const from=state.month+'-01',end=new Date(from+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);
   const request=centres.length?rpc(capabilities.version>=3?'attendance_register_summary_v3':capabilities.version>=2?'attendance_register_summary_v2':'attendance_register_summary',{p_centres:centres.map(c=>c.id),p_from:from,p_until:end.toISOString().slice(0,10),p_shift:state.shift||null,p_grade:state.grade||null,p_gender:state.gender||null}):Promise.resolve([]);
   void request.then(rows=>{if(current===epoch){summaries.set(key,{rows});rerender();}}).catch(error=>{if(current===epoch){summaries.set(key,{error:error.message});rerender();}});
  }
  const value=summaries.get(key),rows=[...(value.rows||[])].sort((a,b)=>b.attendance_date.localeCompare(a.attendance_date)||(centres.find(c=>c.id===a.centre_id)?.name||'').localeCompare(centres.find(c=>c.id===b.centre_id)?.name||'')||a.shift_code.localeCompare(b.shift_code));
  const content=value.pending?'<p role="status">Loading saved attendance…</p>':value.error?`<p role="alert">${esc(value.error)}</p><button class="btn" type="button" data-register-retry>Retry attendance table</button>`:rows.length?`<div class="table-scroll"><table><thead><tr><th>Centre</th><th>Shift</th><th>Date</th><th>No. of students present</th><th>% students present</th><th>Created by</th><th>Last edited by</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(centres.find(c=>c.id===r.centre_id)?.name||r.centre_id)}</td><td>${esc(r.shift_code)}</td><td>${esc(r.attendance_date)}</td><td>${esc(attendanceSummaryDisplay(r).ratio)}</td><td>${esc(attendanceSummaryDisplay(r).percentage)}${attendanceSummaryDisplay(r).incomplete?'<div class="subtext">Incomplete attendance</div>':''}</td><td>${esc(r.created_by||'Not recorded')}</td><td>${esc(r.last_edited_by||'Not recorded')}</td><td>${canWrite(r.centre_id)?`<button type="button" class="text-button" data-register-edit="${esc([r.centre_id,r.shift_code,r.attendance_date].join('|'))}">Edit attendance</button>`:'<span class="subtext">View only</span>'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No saved attendance for this selection.</p>';
  return `<section class="card table-card attendance-register"><div class="table-head"><div><h2>Attendance register</h2><p>Saved records · one row per centre, shift and date</p></div></div><p class="chart-note register-definition">Count = present/enrolled on that date. Percentage = P ÷ (P + A + L) × 100, with the marked-student fraction shown. MM and WO are excluded; unmarked students remain unknown. Edit opens the full register, including students outside the chart filters.</p>${content}</section>`;
 }
 async function open(t,selection) {
  if(!canWrite(selection?.centre))throw Error('Your role does not permit attendance entry in this centre.');
  const allowed=allowedCentres();
  const requested=selection||{centre:allowed.some(c=>c.id===t.state.centre)?t.state.centre:allowed[0]?.id,shift:t.state.shift||'Morning',date:t.state.date||t.TODAY};
  if(!selection&&!requested.date.startsWith(t.state.month))requested.date=t.state.month===t.TODAY.slice(0,7)?t.TODAY:t.state.month+'-01';
  const e={...requested,roster:[],saved:{},draft:{},loaded:false,loading:false,dirty:false,committed:false,deleting:false,request:crypto.randomUUID(),sequence:0,notes:'',savedNotes:''};editor=e;
  const select=(name,label,values,value)=>`<label class="field"><span>${label}</span><select name="${name}" data-register-context="${name}">${values.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
  t.modal(selection?'Edit attendance':'Add attendance','Mark students below, then click Save Attendance.',`<div data-attendance-editor><div class="form-grid register-context">${getRole()==='Teacher'&&allowed.length===1?`<div class="field"><span>Centre</span><strong>${esc(allowed[0].label)}</strong><input type="hidden" name="centre" value="${esc(e.centre)}"></div>`:select('centre','Centre',allowed.map(c=>[c.id,c.label]),e.centre)}${select('shift','Shift',[['Morning','Morning'],['Evening','Evening']],e.shift)}<label class="field"><span>Date</span><input name="date" data-register-context="date" type="date" max="${esc(t.TODAY)}" value="${esc(e.date)}" required></label></div><div id="register-existing"></div><div id="register-roster" role="region" aria-label="Student attendance"><p role="status">Loading students…</p></div><label class="field"><span>Notes</span><textarea name="notes" maxlength="2000" ${capabilities.version<3?'disabled placeholder="Notes become available after the register metadata update."':''}></textarea></label><label class="field register-reason" hidden><span>Reason for correction or deletion</span><input name="reason" maxlength="300" placeholder="Required when changing saved attendance"></label><div id="register-delete"></div><p class="form-help">Changes stay in this popup until you save. Clear removes a saved mark only after Save Attendance; it becomes unknown, not absent. P = Present · A = Absent · L = Leave · MM = Monthly meeting · WO = Weekly Off (currently Sunday in the installed backend).</p></div>`,async values=>{
   if(editor!==e||e.loading||!e.loaded)throw Error('Wait for the selected roster to load.');
   if(e.committed)throw Error('This operation is already saved. Reload the page to refresh the charts.');
   const rows=changedAttendance(e.roster,e.saved,e.draft);
   const correcting=rows.some(r=>e.saved[r.enrolment]);
   if((e.deleting||correcting)&&!values.reason?.trim())throw Error('Enter a reason for this correction or deletion.');
   if(e.deleting&&values.confirmDelete!=='DELETE')throw Error('Tick the confirmation to delete this entire centre, shift and date register.');
   const notesChanged=capabilities.version>=3&&values.notes!==e.savedNotes;
   if(!e.deleting&&!rows.length&&!notesChanged)throw Error('No attendance changes selected.');
   if(notesChanged&&e.recorded&&!values.reason?.trim())throw Error('Enter a reason for updating saved notes.');
   const args={p_request:e.request,p_centre:e.centre,p_shift:e.shift,p_date:e.date,p_token:e.token,p_reason:values.reason?.trim()||'Attendance entered'};
   if(!e.deleting){args.p_rows=rows;if(capabilities.version>=3)args.p_notes=values.notes||'';}
   await rpc(e.deleting?(capabilities.version>=3?'delete_attendance_register_v3':'delete_attendance_register'):capabilities.version>=3?'save_attendance_register_v3':'save_attendance_register',args,true);
   e.committed=true;e.dirty=false;invalidate();
   // A successful write is never retried if the subsequent read fails.
   try{await refresh();rerender();t.toast(e.deleting?'Attendance deleted. History retained.':'Attendance saved and charts refreshed.');}
   catch{throw Error('Attendance was saved, but refreshed data could not be loaded. Reload this page; do not submit again.');}
  },true,'Save Attendance');
  const form=document.querySelector('#dialog-form');
  form.dataset.attendanceRegister='true';
  const isCurrent=()=>editor===e&&form.isConnected;
  const setSubmit=()=>{const button=form.querySelector('.modal-actions [type=submit]');button.disabled=e.loading||!e.loaded||e.committed;button.textContent='Save Attendance';button.hidden=e.deleting;};
  function draw() {
   if(!isCurrent())return;
   const body=form.querySelector('#register-roster');
   body.innerHTML=e.roster.length?`<div class="register-toolbar"><div><strong>${e.roster.length} students</strong><span id="register-count" role="status"></span></div><div class="bulk-actions"><button type="button" class="btn tiny" data-register-all="P">Mark all present</button><button type="button" class="btn tiny" data-register-all="A">Mark all absent</button></div></div><div class="table-scroll register-students"><table><thead><tr><th>Student</th><th>Grade</th><th>Attendance</th></tr></thead><tbody>${e.roster.map(s=>`<tr><td>${esc(s.name||'Name not recorded')}<div class="subtext">${esc(s.student_id)}</div></td><td>${esc(s.grade)}</td><td><div class="mark-group" role="group" aria-label="Attendance for ${esc(s.name||s.student_id)}">${attendanceCodes.map(code=>`<button type="button" title="${labels[code]}" aria-label="${labels[code]} for ${esc(s.name||s.student_id)}" aria-pressed="${e.draft[s.id]===code}" class="mark-btn ${code.toLowerCase()} ${e.draft[s.id]===code?'selected':''}" data-register-mark="${esc(s.id)}|${code}">${code}</button>`).join('')}<button type="button" class="text-button register-clear" data-register-clear="${esc(s.id)}">Clear</button></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No enrolled students for this centre, shift and date.</p>';
   form.querySelector('[data-register-delete]')?.remove();
   form.querySelector('.register-reason').hidden=!e.recorded;
   form.querySelector('#register-existing').innerHTML=e.recorded?'<p class="notice">Already logged. This is the saved record. <button type="button" class="btn tiny" data-register-existing>Edit existing attendance</button></p>':'';
   form.querySelector('#dialog-title').textContent=e.recorded?'Edit attendance':'Add attendance';
   form.querySelector('#register-delete').innerHTML=e.recorded?`<div class="register-danger"><h3>Delete attendance</h3><p>Remove all ${e.recorded} saved marks for this centre, shift and date. Original records remain in restricted audit history.</p><button type="button" class="btn danger" data-register-delete>Delete Attendance</button><div id="register-confirm" hidden><p>This removes the whole register, including marks outside chart filters.</p><label class="field-checkbox"><input name="confirmDelete" type="checkbox" value="DELETE"> I confirm deletion of this entire register.</label><button type="submit" class="btn danger">Confirm deletion</button><button type="button" class="text-button" data-register-keep>Keep attendance</button></div></div>`:'';
   const deletion=form.querySelector('[data-register-delete]');if(deletion)form.querySelector('.modal-actions').prepend(deletion);
   paint();setSubmit();
  }
  function paint() {
   e.dirty=changedAttendance(e.roster,e.saved,e.draft).length>0||e.notes!==e.savedNotes;
   for(const button of form.querySelectorAll('[data-register-mark]')){const [id,code]=button.dataset.registerMark.split('|');button.setAttribute('aria-pressed',String(e.draft[id]===code));button.classList.toggle('selected',e.draft[id]===code);}
   const count=form.querySelector('#register-count');if(count)count.textContent=` · ${Object.values(e.draft).filter(Boolean).length} marked · ${e.dirty?'Unsaved changes':'Saved marks loaded'}`;
  }
  async function load() {
   const sequence=++e.sequence;e.loading=true;e.loaded=false;setSubmit();
   form.querySelector('#register-roster').innerHTML='<p role="status">Loading students…</p>';
   form.querySelector('#register-delete').innerHTML='';
   try {
    const value=await rpc(capabilities.version>=3?'read_attendance_register_v3':'read_attendance_register',{p_centre:e.centre,p_shift:e.shift,p_date:e.date});
    if(!isCurrent()||sequence!==e.sequence)return;
    e.notes=value.notes||'';e.savedNotes=e.notes;form.elements.notes.value=e.notes;
    e.roster=value.roster;e.saved=Object.fromEntries(value.marks.map(r=>[r.enrolment,r.code]));e.draft={...e.saved};e.token=value.token;e.marksToken=value.marks_token||value.token;e.recorded=value.recorded;e.loaded=true;e.deleting=false;e.request=crypto.randomUUID();e.loading=false;draw();
   } catch(error) {if(isCurrent()&&sequence===e.sequence){e.loading=false;form.querySelector('#register-roster').innerHTML=`<p role="alert">${esc(error.message)}</p><button type="button" class="btn" data-register-reload>Retry roster</button>`;setSubmit();}}
  }
  form.addEventListener('input',event=>{if(event.target.name==='notes'){e.notes=event.target.value;paint();}});
  form.addEventListener('change',event=>{
   const field=event.target.closest('[data-register-context]');if(!field)return;
   if(e.dirty&&!window.confirm('Discard unsaved attendance changes and change the selection?')){field.value=e[field.name];return;}
   e[field.name]=field.value;e.dirty=false;e.saved={};e.draft={};e.deleting=false;void load();
  });
  form.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button||form.dataset.saving||e.committed)return;
   if(button.dataset.registerExisting!==undefined){form.querySelector('[data-register-mark]')?.focus();return;}
   if(button.dataset.registerReload!==undefined){void load();return;}
   if(!e.loaded||e.loading)return;
   if(button.dataset.registerMark){const [id,code]=button.dataset.registerMark.split('|');e.draft[id]=code;paint();}
   if(button.dataset.registerClear){delete e.draft[button.dataset.registerClear];paint();}
   if(button.dataset.registerAll){for(const s of e.roster)e.draft[s.id]=button.dataset.registerAll;paint();}
   if(button.dataset.registerDelete!==undefined){e.deleting=true;form.querySelector('#register-confirm').hidden=false;setSubmit();form.querySelector('#register-confirm').scrollIntoView({block:'nearest'});form.querySelector('[name=confirmDelete]').focus();}
   if(button.dataset.registerKeep!==undefined){e.deleting=false;form.querySelector('#register-confirm').hidden=true;setSubmit();}
  });
  await load();
 }
 return {table,open,canWrite,invalidate,discard:()=>{editor=null;},canClose:()=>!editor?.dirty||editor.committed||window.confirm('Discard unsaved attendance changes?')};
}
