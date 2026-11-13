import {prepareTableSort} from './table-sort.js';
import {rosterTable} from './roster-table.js';
import {escapeHtml as esc} from './html.js';

export const attendanceCodes = ['A','P'];
const labels = {P:'Present',A:'Absent',H:'Holiday',L:'Leave',MM:'Monthly meeting',WO:'Weekly Off'};
export function changedAttendance(roster, saved, draft) {
 return roster.filter(s=>(attendanceCodes.includes(draft[s.id])||(saved[s.id]&&draft[s.id]==null))&&draft[s.id]!==saved[s.id])
  .map(s=>({enrolment:s.id,code:draft[s.id]??null}));
}
export function attendanceSummaryDisplay(row) {
 if(row.session_type==='Holiday')return {ratio:'Holiday',percentage:'Excluded',incomplete:false};
 const ratio=`${row.present}/${row.total??'—'}`;
 const percentage=row.percentage===null?'—':`${Number(row.percentage).toFixed(1)}% (${row.present}/${row.eligible})`;
 return {ratio,percentage,incomplete:row.total!=null&&Number(row.recorded??row.eligible)<Number(row.total)};
}
export function registerSummaryKey(state, centres) {
 return JSON.stringify([state.month,state.shift||'',state.grade||'',state.gender||'',centres.map(c=>c.id).sort()]);
}

export function createAttendanceRegister({rpc,context,capabilities,refresh,rerender,getRole=()=>null}) {
 let epoch=0,editor=null;
 const summaries=new Map(),pages=new Map(),distributions=new Map();
 const writable=context.centres.filter(c=>c.can_write&&(context.operational_roles_enabled===true||!context.centres.some(x=>x.roles.includes('Leadership'))));
 const allowedCentres=()=>writable.filter(c=>!getRole()||(getRole()!=='Leadership'&&c.roles.includes(getRole())));
 const canWrite=centre=>capabilities.enabled===true&&allowedCentres().some(c=>!centre||c.id===centre);
 const invalidate=()=>{epoch++;summaries.clear();distributions.clear();pages.clear();};
 function table(state,centres) {
  if(!capabilities.version)return '<section class="card"><h2>Attendance register</h2><p>The attendance register API is not installed.</p></section>';
  const base=registerSummaryKey(state,centres)+'|'+getRole(),page=pages.get(base)||{offset:0,sort:'date',reverse:false};pages.set(base,page);
  const key=base+'|'+JSON.stringify(page);
  if(!summaries.has(key)) {
   const current=epoch;
   summaries.set(key,{pending:true});
   const from=state.month+'-01',end=new Date(from+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);
   const args={p_centres:centres.map(c=>c.id),p_from:from,p_until:end.toISOString().slice(0,10),p_shift:state.shift||null,p_grade:state.grade||null,p_gender:state.gender||null};
   const request=capabilities.register_paging?(centres.length?rpc('attendance_register_page',{...args,p_offset:page.offset,p_sort:page.sort,p_reverse:page.reverse}):Promise.resolve({rows:[],total:0})):centres.length?rpc(capabilities.register_timestamps?'attendance_register_summary_v4':capabilities.version>=3?'attendance_register_summary_v3':capabilities.version>=2?'attendance_register_summary_v2':'attendance_register_summary',{p_centres:centres.map(c=>c.id),p_from:from,p_until:end.toISOString().slice(0,10),p_shift:state.shift||null,p_grade:state.grade||null,p_gender:state.gender||null}):Promise.resolve([]);
   void request.then(rows=>{if(current===epoch){summaries.set(key,Array.isArray(rows)?{rows}:rows);rerender();}}).catch(error=>{if(current===epoch){summaries.set(key,{error:error.message});rerender();}});
  }
  const value=summaries.get(key),rows=[...(value.rows||[])];if(!capabilities.register_paging)rows.sort((a,b)=>b.attendance_date.localeCompare(a.attendance_date)||(centres.find(c=>c.id===a.centre_id)?.name||'').localeCompare(centres.find(c=>c.id===b.centre_id)?.name||'')||a.shift_code.localeCompare(b.shift_code));
  const content=value.pending?'<p role="status">Loading saved attendance…</p>':value.error?`<p role="alert">${esc(value.error)}</p><button class="btn" type="button" data-register-retry>Retry attendance table</button>`:rows.length?`<div class="table-scroll"><table ${capabilities.register_paging?'data-paginate="false" data-sortable="false"':''}><thead><tr>${[['centre','Centre'],['shift','Shift'],['date','Date'],['present','No. of students present'],['percentage','% students present']].map(([key,label])=>`<th aria-sort="${page.sort===key?((key==='date')!==page.reverse?'descending':'ascending'):'none'}">${capabilities.register_paging?`<button type="button" class="table-sort" data-register-sort="${key}" data-register-key="${esc(base)}">${label} ↕</button>`:label}</th>`).join('')}<th>Created by</th><th>Last edited by</th><th>Last edited at</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(centres.find(c=>c.id===r.centre_id)?.name||r.centre_id)}</td><td>${esc(r.shift_code)}</td><td>${esc(r.attendance_date)}</td><td>${esc(attendanceSummaryDisplay(r).ratio)}</td><td>${esc(attendanceSummaryDisplay(r).percentage)}${attendanceSummaryDisplay(r).incomplete?'<div class="subtext">Incomplete attendance</div>':''}</td><td>${esc(r.created_by||'Not recorded')}</td><td>${esc(r.last_edited_by||'Not recorded')}</td><td>${esc(r.last_edited_at||'Not recorded')}</td><td>${r.session_type==='Holiday'?'Recorded holiday':canWrite(r.centre_id)?`<button type="button" class="text-button" data-register-edit="${esc([r.centre_id,r.shift_code,r.attendance_date].join('|'))}">Edit attendance</button>`:'<span class="subtext">View only</span>'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No saved attendance for this selection.</p>';
  return `<section class="card table-card attendance-register"><div class="table-head"><div><h2>Attendance register</h2><p>Saved records · one row per centre, shift and date</p></div></div><p class="chart-note register-definition">Count = present/enrolled on that date. Percentage = present ÷ recorded classroom attendance × 100. Holidays and monthly meetings are excluded; unmarked students remain unknown. Historical leave keeps its original treatment. Edit opens the full register, including students outside the chart filters.</p>${content}${capabilities.register_paging&&value.total>10?`<div class="pagination"><span>${page.offset+1}–${Math.min(value.total,page.offset+10)} of ${value.total}</span><button class="btn tiny" type="button" data-register-key="${esc(base)}" data-register-page="${Math.max(0,page.offset-10)}" ${page.offset===0?'disabled':''}>Previous</button><button class="btn tiny" type="button" data-register-key="${esc(base)}" data-register-page="${page.offset+10}" ${page.offset+10>=value.total?'disabled':''}>Next</button></div>`:''}</section>`;
 }
 function distribution(state,centres){
  if(!capabilities.present_distribution)return null;
  const key=registerSummaryKey(state,centres);
  if(!distributions.has(key)){const sequence=epoch,from=state.month+'-01',until=new Date(from+'T12:00:00Z');until.setUTCMonth(until.getUTCMonth()+1);distributions.set(key,{pending:true});void (centres.length?rpc('attendance_present_distribution',{p_centres:centres.map(c=>c.id),p_from:from,p_until:until.toISOString().slice(0,10),p_shift:state.shift||null,p_grade:state.grade||null,p_gender:state.gender||null}):Promise.resolve({days:[],recorded_students:0})).then(value=>{if(epoch===sequence){distributions.set(key,value);rerender();}}).catch(error=>{if(epoch===sequence){distributions.set(key,{error:error.message});rerender();}});}
  return distributions.get(key);
 }
 const onPageClick=event=>{const button=event.target.closest('[data-register-page],[data-register-sort]');if(!button||button.disabled)return;const key=button.dataset.registerKey,page=pages.get(key);if(!page)return;if(button.dataset.registerSort){const sort=button.dataset.registerSort;page.reverse=page.sort===sort?!page.reverse:false;page.sort=sort;page.offset=0;}else page.offset=Number(button.dataset.registerPage);rerender();};document.addEventListener('click',onPageClick);
 async function open(t,selection) {
  if(!canWrite(selection?.centre))throw Error('Your role does not permit attendance entry in this centre.');
  const allowed=allowedCentres();
  const requested=selection||{centre:allowed.some(c=>c.id===t.state.centre)?t.state.centre:allowed[0]?.id,shift:t.state.shift||'Morning',date:t.state.date||t.TODAY};
  if(!selection&&!requested.date.startsWith(t.state.month))requested.date=t.state.month===t.TODAY.slice(0,7)?t.TODAY:t.state.month+'-01';
  const e={...requested,roster:[],saved:{},draft:{},loaded:false,loading:false,dirty:false,committed:false,deleting:false,request:crypto.randomUUID(),sequence:0,notes:'',savedNotes:''};editor=e;
  const select=(name,label,values,value)=>`<label class="field"><span>${label}</span><select name="${name}" data-register-context="${name}">${values.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
  t.modal(selection?'Edit attendance':'Add attendance','Mark students below, then click Save Attendance.',`<div data-attendance-editor><div class="form-grid register-context"><label class="field"><span>Session Type</span><select name="sessionType" data-session-type><option value="Classroom">Classroom Session</option><option value="Monthly meeting">Monthly Meeting</option><option value="Holiday" ${capabilities.session_entry?'':'disabled'}>Holiday</option></select></label>${getRole()==='Teacher'&&allowed.length===1?`<label class="field"><span>Centre</span><select disabled><option>${esc(allowed[0].label)}</option></select><input type="hidden" name="centre" value="${esc(e.centre)}"></label>`:select('centre','Centre',allowed.map(c=>[c.id,c.label]),e.centre)}${select('shift','Shift',[['Morning','Morning'],['Evening','Evening']],e.shift)}<label class="field"><span>Date</span><input name="date" data-register-context="date" type="date" max="${esc(t.TODAY)}" value="${esc(e.date)}" required></label></div><div id="register-existing"></div><div id="register-roster" role="region" aria-label="Student attendance"><p role="status">Loading students…</p></div><label class="field"><span>Notes</span><textarea name="notes" maxlength="2000" ${capabilities.version<3?'disabled placeholder="Notes become available after the register metadata update."':''}></textarea></label><label class="field register-reason" hidden><span>Reason for correction or deletion</span><input name="reason" maxlength="300" placeholder="Required when changing saved attendance"></label><div id="register-delete"></div><p class="form-help">Changes stay in this popup until you save. Mark every eligible student Present or Absent before saving. Monthly Meeting covers both shifts as one event. Holiday is recorded once for the centre, shift and date. Historical marks retain their original meaning.</p></div>`,async values=>{
   if(editor!==e||e.loading||!e.loaded)throw Error('Wait for the selected roster to load.');
   if(e.committed)throw Error('This operation is already saved. Reload the page to refresh the charts.');
   if(e.sessionType==='Holiday'){await rpc('save_centre_holiday',{p_request:e.request,p_centre:e.centre,p_shift:e.shift,p_date:e.date,p_reason:values.notes?.trim()||'Holiday'},true);e.committed=true;e.dirty=false;invalidate();await refresh();rerender();t.toast('Holiday saved.');return;}
   if(!e.deleting&&(!e.roster.length||e.roster.some(s=>!attendanceCodes.includes(e.draft[s.id]))))throw Error('Mark every eligible student Present or Absent.');
   const rows=changedAttendance(e.roster,e.saved,e.draft);
   const correcting=rows.some(r=>e.saved[r.enrolment]);
   if((e.deleting||correcting)&&!values.reason?.trim())throw Error('Enter a reason for this correction or deletion.');
   if(e.deleting&&values.confirmDelete!=='DELETE')throw Error('Tick the confirmation to delete this entire centre, shift and date register.');
   const notesChanged=capabilities.version>=3&&values.notes!==e.savedNotes;
   if(!e.deleting&&!rows.length&&!notesChanged)throw Error('No attendance changes selected.');
   if(notesChanged&&e.recorded&&!values.reason?.trim())throw Error('Enter a reason for updating saved notes.');
   const args={p_request:e.request,p_centre:e.centre,p_shift:e.shift,p_date:e.date,p_token:e.token,p_reason:values.reason?.trim()||'Attendance entered'};
   if(!e.deleting){args.p_rows=capabilities.session_entry?e.roster.map(s=>({enrolment:s.id,code:e.draft[s.id]})):rows;if(capabilities.version>=3)args.p_notes=values.notes||'';}
   await rpc(e.deleting?(capabilities.version>=3?'delete_attendance_register_v3':'delete_attendance_register'):capabilities.session_entry?'save_classroom_register':capabilities.version>=3?'save_attendance_register_v3':'save_attendance_register',args,true);
   e.committed=true;e.dirty=false;invalidate();
   // A successful write is never retried if the subsequent read fails.
   try{await refresh();rerender();t.toast(e.deleting?'Attendance deleted. History retained.':'Attendance saved and charts refreshed.');}
   catch{throw Error('Attendance was saved, but refreshed data could not be loaded. Reload this page; do not submit again.');}
  },true,'Save Attendance');
  const form=document.querySelector('#dialog-form');
  form.dataset.attendanceRegister='true';
  const isCurrent=()=>editor===e&&form.isConnected;
  const setSubmit=()=>{const button=form.querySelector('.modal-actions [type=submit]');button.disabled=e.loading||!e.loaded||e.committed||(e.sessionType!=='Holiday'&&(!e.roster.length||e.roster.some(s=>!attendanceCodes.includes(e.draft[s.id]))));button.textContent='Save Attendance';button.hidden=e.deleting;};
  function draw() {
   if(!isCurrent())return;
   const body=form.querySelector('#register-roster');
   body.innerHTML=e.roster.length?`<div class="register-toolbar"><div><strong>${e.roster.length} students</strong><span id="register-count" role="status"></span></div><div class="bulk-actions"><button type="button" class="btn tiny" data-register-all="P">Mark all present</button><button type="button" class="btn tiny" data-register-all="A">Mark all absent</button></div></div>${rosterTable(['Student','Grade','Attendance'],e.roster.map(s=>`<tr><td>${esc(s.name||'Name not recorded')}</td><td>${esc(s.grade)}</td><td><div class="mark-group" role="group" aria-label="Attendance for ${esc(s.name||'Student')}">${!attendanceCodes.includes(e.saved[s.id])&&e.saved[s.id]?`<span class="legacy-attendance">Saved ${esc(e.saved[s.id])}: ${esc(labels[e.saved[s.id]]||e.saved[s.id])} (historical)</span>`:''}${attendanceCodes.map(code=>`<button type="button" title="${code==='H'&&!capabilities.holiday_code?'Holiday saving needs the attendance update':labels[code]}" aria-label="${labels[code]} for ${esc(s.name||'Student')}" aria-pressed="${e.draft[s.id]===code}" ${code==='H'&&!capabilities.holiday_code?'disabled':''} class="mark-btn ${code.toLowerCase()} ${e.draft[s.id]===code?'selected':''}" data-register-mark="${esc(s.id)}|${code}">${code}</button>`).join('')}</div></td></tr>`),'register-students')}`:'<p class="empty">No enrolled students for this centre, shift and date.</p>';
   const roster=body.querySelector('table');if(roster)prepareTableSort(roster,{key:'attendance-entry',states:{}});
   form.querySelector('[data-register-delete]')?.remove();
   form.querySelector('.register-reason').hidden=!e.recorded;
   form.querySelector('#register-existing').innerHTML=e.recorded?'<p class="notice">Already logged. This is the saved record. <button type="button" class="btn tiny" data-register-existing>Edit existing attendance</button></p>':'';
   form.closest('[role=dialog]').querySelector('#dialog-title').textContent=e.recorded?'Edit attendance':'Add attendance';
   form.querySelector('#register-delete').innerHTML=e.recorded?`<div class="register-danger"><h3>Delete attendance</h3><p>Remove all ${e.recorded} saved marks for this centre, shift and date. Original records remain in restricted audit history.</p><button type="button" class="btn danger" data-register-delete>Delete Attendance</button><div id="register-confirm" hidden><p>This removes the whole register, including marks outside chart filters.</p><label class="field-checkbox"><input name="confirmDelete" type="checkbox" value="DELETE"> I confirm deletion of this entire register.</label><button type="submit" class="btn danger">Confirm deletion</button><button type="button" class="text-button" data-register-keep>Keep attendance</button></div></div>`:'';
   const deletion=form.querySelector('[data-register-delete]');if(deletion)form.querySelector('.modal-actions').prepend(deletion);
   paint();setSubmit();
  }
  function paint() {
   e.dirty=changedAttendance(e.roster,e.saved,e.draft).length>0||e.notes!==e.savedNotes;setSubmit();
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
   if(event.target.matches('[data-session-type]')){const choice=event.target.value;if(choice==='Monthly meeting'){if(e.dirty&&!window.confirm('Discard unsaved marks and open Monthly Meeting?')){event.target.value=e.sessionType||'Classroom';return;}e.dirty=false;form.querySelector('[data-action=close]')?.click();const action=document.createElement('button');action.dataset.action='new-monthly-meeting';void Promise.resolve(globalThis.__massOriginalActions?.(action,t)).catch(error=>t.toast(error.message));return;}e.sessionType=choice;const holiday=choice==='Holiday';form.querySelector('#register-roster').hidden=holiday;form.querySelector('#register-delete').hidden=holiday;form.querySelector('[data-register-delete]')?.setAttribute('hidden','');setSubmit();return;}
   const field=event.target.closest('[data-register-context]');if(!field)return;
   if(e.dirty&&!window.confirm('Discard unsaved attendance changes and change the selection?')){field.value=e[field.name];return;}
   e[field.name]=field.value;e.dirty=false;e.saved={};e.draft={};e.deleting=false;void load();
  });
  form.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button||form.dataset.saving||e.committed)return;
   if(button.dataset.registerExisting!==undefined){form.querySelector('[data-register-mark]')?.focus();return;}
   if(button.dataset.registerReload!==undefined){void load();return;}
   if(!e.loaded||e.loading)return;
   if(button.dataset.registerMark&&!button.disabled){const [id,code]=button.dataset.registerMark.split('|');if(code==='H'&&!capabilities.holiday_code)return;e.draft[id]=code;paint();}
   if(button.dataset.registerClear){delete e.draft[button.dataset.registerClear];paint();}
   if(button.dataset.registerAll){for(const s of e.roster)e.draft[s.id]=button.dataset.registerAll;paint();}
   if(button.dataset.registerDelete!==undefined){e.deleting=true;form.querySelector('#register-confirm').hidden=false;setSubmit();form.querySelector('#register-confirm').scrollIntoView({block:'nearest'});form.querySelector('[name=confirmDelete]').focus();}
   if(button.dataset.registerKeep!==undefined){e.deleting=false;form.querySelector('#register-confirm').hidden=true;setSubmit();}
  });
  await load();
 }
 return {table,distribution,open,canWrite,invalidate,dispose:()=>{document.removeEventListener('click',onPageClick);editor=null;invalidate();},discard:()=>{editor=null;},canClose:()=>!editor?.dirty||editor.committed||window.confirm('Discard unsaved attendance changes?')};
}
