import {icon} from './icons.js';
import {createBackendClient,clearStoredSession} from './client.js';
import {createApi} from './api.js';
import {createReadApi} from './reads.js';
import {createDirectoryApi,directoryCentres} from './directory.js';
import {createSessionController} from './session.js';
import {liveToday,monthWindow,roster,matches,filteredFacts,attendanceTotals,quarterLabel,quarterWindow,emptyCentre,eligibleEpisode,activeOn,combineCentres} from './model.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const action=(label,name,attributes='',primary=false)=>`<button class="btn ${primary?'primary':''}" data-work-action="${name}" ${attributes}>${['new-student','new-activity','new-morarji'].includes(name)?icon('plus'):name==='manage'?icon('check'):name==='collapse'?icon('menu'):''}${label}</button>`;
const metric=(label,value,foot='')=>`<div class="card metric"><div class="metric-top">${label}</div><div class="metric-value">${esc(value)}</div><div class="metric-foot">${esc(foot)}</div></div>`;
const section=(title,sub,body,extra='')=>`<section class="card"><div class="section-head"><div><h2>${title}</h2><p>${sub}</p></div>${extra}</div>${body}</section>`;
const choice=(label,name,options,value='',attributes='')=>`<label class="field"><span>${label}</span><select name="${name}" aria-label="${esc(label)}" ${attributes}>${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`;}).join('')}</select></label>`;
const field=(label,name,value='',type='text',attributes='')=>`<label class="field"><span>${label}</span><input name="${name}" type="${type}" aria-label="${esc(label)}" value="${esc(value)}" ${attributes}></label>`;
const triState=value=>value===null||value===undefined?'Unknown':value?'Yes':'No';
const triOptions=[['null','Unknown'],['true','Yes'],['false','No']];
const triValue=value=>value===null||value===undefined?'null':String(value);
const booleanValue=value=>{if(!['null','true','false'].includes(value))throw new Error('Choose Yes, No or Unknown.');return value==='null'?null:value==='true';};

export async function startLiveApp(config) {
  const client=createBackendClient(config),api=createApi(client),reads=createReadApi(client),directory=createDirectoryApi(client);
  const directoryEnabled=config.directoryApi==='directory-v1';
  const root=document.querySelector('#app'),overlay=document.querySelector('#overlay');
  const state={auth:{status:'checking'},context:null,refs:null,directory:[],staff:[],donor:'',data:null,page:'overview',centre:'',month:liveToday().slice(0,7),on:liveToday(),year:'',shift:'',grade:'',gender:'',query:'',definition:'',cohort:'',history:false,reviewView:'',busy:false,saving:false,error:'',notice:'',menu:false,collapsed:false};
  let epoch=0,controller,modalSave=null,lastFocus=null;
  const targetsForDonor=()=>directoryEnabled?directoryCentres(state.context?.centres||[],state.directory,state.donor==='unassociated'?'':state.donor).filter(c=>state.donor!=='unassociated'||c.donor_id===null):state.context?.centres.map(c=>({centre_id:c.id}))||[];
  const centre=()=>state.context?.centres.find(c=>c.id===state.centre);
  const canWrite=()=>Boolean(state.reviewView!=='Leadership' && centre()?.can_write && state.auth.status==='signed-in' && !state.busy && !state.saving);
  const isLeadership=()=>Boolean(state.reviewView==='Leadership'||(!state.reviewView&&state.context?.centres.some(c=>c.roles.includes('Leadership'))));
  const data=()=>state.data || emptyCentre(state.centre);
  const visible=()=>roster(data(),state.on,state);
  const definitions=()=>state.refs?.assessment_definitions.filter(d=>state.refs.assessment_periods.some(p=>p.id===d.period_id&&p.academic_year_id===state.year))||[];
  const name=id=>data().students.find(s=>s.child_id===id)?.full_name || data().students.find(s=>s.child_id===id)?.student_id || id;
  function closeModal(force=false) {
    if(state.saving&&!force)return;
    overlay.replaceChildren();document.body.style.overflow='';modalSave=null;lastFocus?.focus();
  }
  function clearData() {
    ++epoch;controller?.abort();state.data=null;state.staff=[];state.error='';state.busy=false;
    closeModal(true);state.saving=false;
  }
  function clearIdentity() { clearData();state.context=null;state.refs=null;state.directory=[];state.donor='';state.centre='';state.shift='';state.grade='';state.gender='';state.query=''; }
  function notify(message) { state.notice=message;render(); }
  const session=createSessionController(client,{
    onReset:clearData,clearStoredSession:()=>clearStoredSession(config),
    onState(auth) {
      if(auth.status==='signed-out')clearIdentity();
      state.auth=auth;render();
      if(auth.status==='signed-in')void initialize(auth.user.id);
    },
  });
  async function initialize(userId) {
    clearData();state.context=null;state.refs=null;state.directory=[];const own=epoch;state.busy=true;render();controller=new AbortController();
    try {
      const context=await reads.context(controller.signal);
      if(own!==epoch)return;
      if(context?.api_version!=='frontend-reads-v1'||context?.user_id!==userId || !Array.isArray(context.centres))throw new Error('The authenticated scope response could not be verified.');
      state.context=context;
      if(!context.centres.length){state.refs=null;state.busy=false;render();return;}
      const leadership=context.centres.some(c=>c.roles.includes('Leadership'));
      if(!context.centres.some(c=>c.id===state.centre) && !(state.centre==='all' && context.centres.length<=10))state.centre=context.centres[0].id;
      state.refs=await reads.references(controller.signal);
      if(directoryEnabled){
        const rows=await directory.centres({signal:controller.signal});
        if(own!==epoch)return;
        const allowed=new Set(context.centres.map(c=>c.id));
        if(new Set(rows.map(c=>c.centre_id)).size!==rows.length||rows.some(c=>!allowed.has(c.centre_id)))throw new Error('Directory scope response could not be verified.');
        state.directory=rows;
        if(state.donor&&state.donor!=='unassociated'&&!rows.some(c=>c.donor_id===state.donor))state.donor='';
      }
      if(own!==epoch)return;
      const current=state.refs.academic_years.find(y=>y.starts_on<=state.on&&state.on<y.ends_before);
      if(!state.refs.academic_years.some(y=>y.id===state.year))state.year=current?.id||state.refs.academic_years[0]?.id||'';
      if(!state.refs.assessment_definitions.some(d=>d.id===state.definition))state.definition=state.refs.assessment_definitions[0]?.id||'';
      if(!state.refs.programme_cohorts.some(c=>c.id===state.cohort))state.cohort=state.refs.programme_cohorts[0]?.id||'';
      state.busy=false;await load();
    } catch(error) { if(own===epoch)handleError(error); }
  }
  function handleError(error) {
    controller?.abort();state.busy=false;state.error=error.message;
    if(error.sessionExpired) { void session.signOut();return; }
    if(error.status===403) { state.data=null;state.context=null;state.refs=null;state.directory=[];state.donor=''; }
    render();
  }
  async function load() {
    if(!state.context?.centres.length||!state.centre||!state.refs)return;
    clearData();const own=epoch;state.busy=true;render();controller=new AbortController();
    try {
      const window=monthWindow(state.month),year=state.refs.academic_years.find(y=>y.id===state.year);
      const allowed=new Set(targetsForDonor().map(c=>c.centre_id));
      const targets=(state.centre==='all'?state.context.centres:[centre()]).filter(c=>c&&allowed.has(c.id));
      if(!targets.length){state.data=emptyCentre(state.centre);state.staff=[];state.busy=false;render();return;}
      if(!targets[0]||targets.length>10)throw new Error('Select an individual CAC centre to load its records. The current detailed view supports at most ten centres at a time.');
      if(!targets.every(c=>c.can_read_profiles))state.gender='';
      if(!definitions().some(d=>d.id===state.definition))state.definition=definitions()[0]?.id||'';
      const results=[];
      for(const target of targets){if(own!==epoch)return;results.push(await reads.centre({centre:target.id,...window,yearFrom:year?.starts_on||window.from,yearUntil:year?.ends_before||window.until,signal:controller.signal}));}
      if(own!==epoch)return;
      let staff=[];
      if(directoryEnabled&&state.centre!=='all')staff=await directory.staff({centre:state.centre,signal:controller.signal});
      if(own!==epoch)return;
      state.data=combineCentres(results);state.staff=staff;state.busy=false;render();
    } catch(error) { if(own===epoch)handleError(error); }
  }
  async function save(operation,message) {
    if(!canWrite())return;
    const own=epoch;state.saving=true;
    const button=overlay.querySelector('[type=submit]');if(button)button.disabled=true;
    try {
      await operation();
      if(own!==epoch)return;
      state.saving=false;closeModal(true);state.notice=message;await load();
    } catch(error) {
      if(own!==epoch)return;
      state.saving=false;
      if(error.sessionExpired){await session.signOut();return;}
      if(error.status===403){closeModal(true);state.notice=error.message;await initialize(state.auth.user.id);return;}
      if(error.conflict||error.uncertain){closeModal(true);state.notice=error.message;await load();return;}
      const target=overlay.querySelector('[role=alert]');
      if(target)target.textContent=error.message;else{state.error=error.message;render();}
      if(button?.isConnected)button.disabled=false;
    }
  }
  function modal(title,subtitle,body,callback) {
    if(!canWrite())return;
    lastFocus=document.activeElement;modalSave=callback;
    overlay.innerHTML=`<div class="modal-backdrop"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><div><h2 id="dialog-title">${title}</h2><p>${esc(subtitle)}</p></div><button class="modal-close" data-modal-close aria-label="Close dialog">×</button></div><form id="workspace-dialog"><div class="modal-body"><div class="form-grid">${body}</div><p class="field-error" role="alert"></p></div><div class="modal-actions"><button class="btn" type="button" data-modal-close>Cancel</button><button class="btn primary" type="submit">Save changes</button></div></form></section></div>`;
    document.body.style.overflow='hidden';overlay.querySelector('input,select,button')?.focus();
  }
  function details(id) {
    const episodes=data().students.filter(s=>s.child_id===id);if(!episodes.length)return;
    const facts=kind=>data()[kind].filter(r=>r.child_id===id);
    lastFocus=document.activeElement;modalSave=null;
    overlay.innerHTML=`<div class="modal-backdrop"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><div><h2 id="dialog-title">${esc(name(id))}</h2><p>Authorized student history</p></div><button class="modal-close" data-modal-close aria-label="Close dialog">×</button></div><div class="modal-body"><h3>Verified enrolments</h3>${episodes.map(e=>`<p>${esc(state.context.centres.find(c=>c.id===e.centre_id)?.label||'')} · Grade ${esc(e.grade_label)} · ${esc(e.shift_code)} · ${esc(e.starts_on)}${e.ends_before?' to '+esc(e.ends_before)+' (exclusive)':''} · ${esc(e.status_code)}</p>`).join('')}<h3>Reporting-month attendance</h3>${facts('attendance').map(r=>`<p>${esc(r.attendance_date)} · ${esc(r.shift_code)} · ${esc(r.code)}</p>`).join('')||empty('No recorded attendance in this reporting window.')}<h3>Selected academic-year assessments</h3>${facts('assessments').map(r=>`<p>${esc(r.assessed_on)} · ${esc(r.score)} /25</p>`).join('')||empty('No recorded assessments in this year.')}<h3>Reporting-month activities</h3>${facts('participation').map(r=>`<p>${esc(data().activities.find(e=>e.id===r.event_id)?.name||'Activity')} · ${esc(r.activity_date)} · ${triState(r.participated)}</p>`).join('')||empty('No participation responses in this reporting window.')}<h3>Morarji</h3>${facts('morarji').map(r=>`<p>${esc(state.refs.programme_cohorts.find(c=>c.id===r.cohort_id)?.label||'Cohort')} · Applied ${triState(r.applied)} · Attended ${triState(r.attended)} · Passed ${triState(r.passed)}</p>`).join('')||empty('No authorized memberships returned.')}</div><div class="modal-actions"><button class="btn" data-modal-close>Close</button></div></section></div>`;
    document.body.style.overflow='hidden';overlay.querySelector('button')?.focus();
  }
  function addStudent() {
    modal('Add student',centre().label,
      field('Full name','name','','text','required maxlength="160" autocomplete="off"')+
      choice('Grade','grade',Array.from({length:10},(_,i)=>String(i+1)),state.grade||'1')+
      choice('Gender','gender',['Girl','Boy'],'Girl')+choice('Shift','shift',['Morning','Evening'],state.shift||'Morning')+
      field('Enrolment date','start','','date',`required max="${liveToday()}"`)+
      '<label class="field full"><span>Identity review</span><span><input name="different" type="checkbox"> I checked Student Profile and verified this is a different student if a possible match exists.</span></label><p class="form-help full">The server generates the permanent ID. Existing profiles are never merged by name. Notes, board-result changes and profile corrections are not available in this release.</p>',async f=>{
        const normalize=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
        if(data().students.some(s=>s.full_name&&normalize(s.full_name)===normalize(f.name)&&s.grade_label===f.grade)&&!f.different)throw new Error('Possible existing profile. Review identity and confirm this is a different student before registering.');
        await save(()=>api.registerStudent({centre:state.centre,grade:f.grade,gender:f.gender,shift:f.shift,start:f.start,name:f.name}),'Student registered with a permanent generated ID.');
      });
  }
  function addAssignment(id) {
    const child=data().students.find(s=>s.child_id===id&&activeOn(s,state.on))||data().students.find(s=>s.child_id===id);if(!child)return;
    modal('Add historical assignment',name(id),choice('Centre','centre',state.context.centres.filter(c=>c.can_write).map(c=>[c.id,c.label]),state.centre)+
      choice('Grade','grade',Array.from({length:10},(_,i)=>String(i+1)),child.grade_label)+choice('Shift','shift',['Morning','Evening'],child.shift_code)+
      field('Verified assignment start','start','','date',`required max="${liveToday()}"`)+
      '<p class="form-help full">Creates a new verified episode. Existing assignments are not overwritten or automatically closed; this is not a transfer shortcut.</p>',f=>save(()=>api.addEnrolment({child:id,centre:f.centre,grade:f.grade,shift:f.shift,start:f.start,status:'Active'}),'Historical assignment added.'));
  }
  function closeAssignment(id) {
    const row=data().students.find(s=>s.enrolment_id===id);if(!row||row.ends_before)return;
    modal('Close enrolment',name(row.child_id),field('First day no longer enrolled','end','','date',`required max="${liveToday()}"`)+
      choice('Enrolment status','status',['CAC dropout','Left programme'],'Left programme')+
      '<p class="form-help full">Enter the first day outside this episode, not an inferred last attended day. Existing recorded history must remain valid. Reopening and undo are not supported.</p>',f=>save(()=>api.closeEnrolment({id,expected:Number(row.row_version),endsBefore:f.end,status:f.status}),'Enrolment closed; previous assignments and facts preserved.'));
  }
  async function markAttendance(id,code) {
    if(!canWrite())return;
    if(state.on>liveToday())throw new Error('Attendance cannot be entered for a future date.');
    const row=data().students.find(s=>s.enrolment_id===id);if(!row)return;
    const old=data().attendance.find(a=>a.child_id===row.child_id&&a.shift_code===row.shift_code&&a.attendance_date===state.on);
    if(old?.code===code)return; // A repeated tap never clears a mark.
    eligibleEpisode(data(),row.child_id,state.on,row.shift_code);
    await save(()=>api.recordAttendance({enrolment:old?.enrolment_id||id,on:state.on,code,expected:old?Number(old.row_version):0}),'Attendance saved.');
  }
  function assess(childId) {
    const definition=definitions().find(d=>d.id===state.definition);
    if(!definition){notify('An approved assessment definition is required.');return;}
    if(Number(definition.max_score)!==25)throw new Error('The assessment scale needs administrator review.');
    const quarter=quarterWindow(definition,state.refs);
    const old=data().assessments.find(a=>a.child_id===childId&&a.definition_id===definition.id);
    const options=data().students.filter(s=>s.child_id===childId).map(s=>[s.enrolment_id,`Grade ${s.grade_label} · ${s.shift_code} · ${s.starts_on}${s.ends_before?' to '+s.ends_before:''}`]);
    modal('Edit exam marks',`${name(childId)} · ${quarterLabel(definition,state.refs)}`,
      choice('Verified enrolment','enrolment',options,old?.enrolment_id||options[0]?.[0],old?'disabled':'')+
      field('Exam date','on',old?.assessed_on||'','date',`required max="${liveToday()}" ${old?'readonly':''}`)+
      field('Recorded score / 25','score',old?.score??'','number','required min="0" max="25" step="1"')+
      '<p class="form-help full">Zero is a score. Absent, clear-to-unknown, exam-date correction, batch comments and repeat attempts are not supported. Q1–Q4 use actual approved academic references; F aliases are not inferred.</p>',f=>{
        if(!Number.isInteger(Number(f.score)))throw new Error('Enter whole marks from 0 to 25.');
        if(f.on<quarter.from||f.on>=quarter.until)throw new Error('Exam date must fall inside the selected academic quarter.');
        const id=old?.enrolment_id||f.enrolment;
        const episode=data().students.find(e=>e.enrolment_id===id);
        if(!episode||!activeOn(episode,f.on))throw new Error('Exam date must fall within the verified assignment.');
        return save(()=>api.recordAssessment({enrolment:id,definition:definition.id,on:old?.assessed_on||f.on,score:Number(f.score),expected:old?Number(old.row_version):0}),'Assessment saved with revision protection.');
      });
  }
  function addActivity() {
    modal('Add activity session',centre().label,field('Activity name','name','','text','required maxlength="160"')+
      choice('Shift','shift',['Morning','Evening'],state.shift||'Morning')+field('Activity date','on','','date','required')+
      '<p class="form-help full">Named events use one explicit date and shift. No category, Held/Planned/Cancelled status or Saturday schedule is inferred. Details cannot yet be edited or removed.</p>',f=>{
        const id=crypto.randomUUID();return save(()=>api.createActivity({id,centre:state.centre,shift:f.shift,on:f.on,name:f.name}),'Named activity created.');
      });
  }
  function participation(eventId) {
    const event=data().activities.find(e=>e.id===eventId);if(!event)return;
    const eligible=roster(data(),event.activity_date,{shift:event.shift_code});
    const current=data().participation.find(r=>r.event_id===eventId&&r.child_id===eligible[0]?.child_id);
    modal('Record activity participation',`${event.name} · ${event.activity_date} · ${event.shift_code}`,
      choice('Student','child',eligible.map(s=>[s.child_id,s.full_name||s.student_id]),eligible[0]?.child_id,`required data-participation-event="${esc(eventId)}"`)+
      choice('Participation','value',triOptions,triValue(current?.participated))+
      '<p class="form-help full">Save one student at a time. Choose Unknown when participation is not known. Bulk replacement, removal and undo are not available in this release.</p>',f=>{
        const old=data().participation.find(r=>r.event_id===eventId&&r.child_id===f.child);
        const episode=old?data().students.find(e=>e.enrolment_id===old.enrolment_id):eligibleEpisode(data(),f.child,event.activity_date,event.shift_code);
        if(!episode)throw new Error('Verified event enrolment required.');
        const value=booleanValue(f.value);
        if(old&&old.participated===value){closeModal();notify('No participation changes to save.');return;}
        return save(()=>api.recordParticipation({enrolment:episode.enrolment_id,event:eventId,participated:value,expected:old?Number(old.row_version):0}),'Participation saved.');
      });
  }
  function addMorarji() {
    if(!state.refs.programme_cohorts.length){notify('An administrator must configure a verified cohort first.');return;}
    modal('Add to Morarji training',centre().label,choice('Verified cohort','cohort',state.refs.programme_cohorts.map(c=>[c.id,c.label]),state.cohort)+
      choice('Verified enrolment','enrolment',visible().map(s=>[s.enrolment_id,`${s.full_name||s.student_id} · ${s.shift_code} · Grade ${s.grade_label}`]),'','required')+
      '<p class="form-help full">Select a confirmed participant. No grade-only eligibility, cohort year or outcome is inferred.</p>',f=>save(()=>api.addMorarjiMember({enrolment:f.enrolment,cohort:f.cohort}),'Morarji membership added.'));
  }
  function editMorarji(id) {
    const row=data().morarji.find(r=>r.membership_id===id);if(!row)return;
    modal('Morarji follow-up',name(row.child_id),choice('Applied','applied',triOptions,triValue(row.applied))+
      choice('Attended','attended',triOptions,triValue(row.attended))+choice('Passed','passed',triOptions,triValue(row.passed))+
      field('Source-backed school name','school',row.school_name||'','text','maxlength="160"')+
      '<p class="form-help full">Unknown remains unknown. Training days, selection, admission and scholarship outcomes are not part of the approved backend.</p>',f=>save(()=>api.recordMorarji({member:id,applied:booleanValue(f.applied),attended:booleanValue(f.attended),passed:booleanValue(f.passed),school:f.school.trim()||null,expected:row.outcome_id?Number(row.row_version):0}),'Morarji outcomes saved.'));
  }
  function filters() {
    const scoped=targetsForDonor();
    const available=new Set(scoped.map(c=>c.centre_id));
    const donorRows=state.directory.filter(c=>c.donor_id && (!state.centre||state.centre==='all'||c.centre_id===state.centre));
    const options=state.context.centres.filter(c=>available.has(c.id)).map(c=>[c.id,c.label]);
    const episodes=state.data?.students||[];
    const shiftOptions=[...new Set(episodes.map(e=>e.shift_code).filter(Boolean))].sort();
    const gradeOptions=[...new Set(episodes.map(e=>e.grade_label).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
    return `<form class="filters" id="workspace-filters">${state.context?.centres.length===92&&state.context.centres.every(c=>c.roles.includes('Teacher')&&c.roles.includes('Cluster Officer'))?choice('Review view (UI only)','reviewView',[['','Actual assigned roles'],['Leadership','Leadership · read-only preview'],['Teacher','Teacher · data entry'],['Cluster Officer','Cluster Officer · data entry']],state.reviewView):''}${directoryEnabled?choice('Donor','donor',[['','All permitted donors'],['unassociated','No verified association'],...[...new Map(donorRows.map(c=>[c.donor_id,c.donor_label])).entries()]],state.donor):''}${choice('Centre','centre',[...(scoped.length<=10?[['all','All permitted centres']]:[]),...options],state.centre)}${field('Reporting month','month',state.month,'month','required')}${field('Enrolment / attendance date','on',state.on,'date','required')}${choice('Shift','shift',[['','Both shifts'],...shiftOptions],state.shift)}${choice('Grade','grade',[['','All grades'],...gradeOptions],state.grade)}${centre()?.can_read_profiles?choice('Gender','gender',[['','All permitted genders'],'Girl','Boy'],state.gender):''}${field('Search student or ID','query',state.query,'search','maxlength="100" autocomplete="off"')}${state.page==='learning'?choice('Academic year','year',state.refs.academic_years.map(y=>[y.id,`${y.starts_on} to ${y.ends_before} (exclusive)`]),state.year):''}<button type="button" class="reset-filter" data-work-action="reset-filters">Reset filters</button></form>`;
  }
  function directoryPanel() {
    if(state.centre==='all')return '';
    const row=state.directory.find(c=>c.centre_id===state.centre);
    const staff=state.staff.filter(s=>!state.shift||s.shift_code===state.shift||s.shift_code===null);
    return section('Centre directory',esc(`${row?.centre_label||'Selected centre'} · Donor association: ${row?.donor_label||'Not verified'}`),
      `<div class="table-scroll"><table><thead><tr><th>Staff</th><th>Role</th><th>Source-reported shift</th></tr></thead><tbody>${staff.map(s=>`<tr><td>${esc(s.display_name)}</td><td>${esc(s.role_code)}</td><td>${esc(s.shift_code||'Not documented')}</td></tr>`).join('')}</tbody></table></div>${!staff.length?empty('No verified staff assignments returned.'):''}<p class="chart-note">Directory entries do not establish login access or appointment dates. Unknown shifts are shown separately.</p>`);
  }
  function donorPage() {
    const rows=targetsForDonor();
    return section('Donor-to-centre directory','Verified associations within your authorized centres. No amounts, funding periods or financial attribution.',
      `<div class="table-scroll"><table><thead><tr><th>Donor association</th><th>CAC centre</th><th>Programme</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.donor_label||'Not verified')}</td><td>${esc(c.centre_label)}</td><td>${action('View centre','directory-centre',`data-id="${esc(c.centre_id)}"`)}</td></tr>`).join('')}</tbody></table></div>${!rows.length?empty('No authorized centres match this donor selection.'):''}<button class="btn" disabled>Financial reporting unavailable</button>`);
  }
  function profileRows(history=false) {
    const rows=history?data().students.filter(s=>matches(s,state)):visible();
    return `<div class="table-scroll"><table><thead><tr><th>Student / ID</th><th>Grade / shift</th><th>Enrolled</th><th>Status</th><th>Class 10 board</th>${canWrite()?'<th>Actions</th>':''}</tr></thead><tbody>${rows.map(s=>`<tr><td><button class="name-link" data-work-action="detail" data-id="${esc(s.child_id)}">${esc(s.full_name||'Name restricted')}</button><div class="subtext record-id">${esc(s.student_id)}</div></td><td>${esc(s.grade_label)} · ${esc(s.shift_code)}<div class="subtext">${esc(s.gender_code||'Unknown / restricted')}</div></td><td>${esc(s.starts_on)}${s.ends_before?`<div class="subtext">Until ${esc(s.ends_before)} (exclusive)</div>`:''}</td><td>${esc(s.status_code)}</td><td>${triState(s.class10_board_passed)}</td>${canWrite()?`<td>${action('Add assignment','assignment',`data-id="${esc(s.child_id)}"`)} ${!s.ends_before?action('Close enrolment','close-enrolment',`data-id="${esc(s.enrolment_id)}"`):''}</td>`:''}</tr>`).join('')}</tbody></table>${!rows.length?empty('No authorized enrolments match this date and selection.'):''}</div>`;
  }
  function overview() {
    const rows=visible(),totals=attendanceTotals(filteredFacts(data(),'attendance',state),data().calendar);
    const scores=filteredFacts(data(),'assessments',state),participated=filteredFacts(data(),'participation',state).filter(r=>r.participated===true);
    const bars=Array.from({length:10},(_,i)=>String(i+1)).map(g=>{const n=new Set(rows.filter(r=>r.grade_label===g).map(r=>r.child_id)).size;return `<div class="bar-row"><span>Grade ${g}</span><div class="bar-track"><div class="bar-fill" style="width:${rows.length?100*n/rows.length:0}%"></div></div><span>${n}</span></div>`;}).join('');
    return `<div class="grid metrics">${metric('Students enrolled',new Set(rows.map(r=>r.child_id)).size,'Unique permitted students as of selected date')}${metric('Recorded attendance',totals.percentage===null?'—':`${totals.percentage.toFixed(1)}%`,'P / (P + A + L); missing is unknown')}${metric('Assessment records',scores.length,'Selected academic year; 25-mark definitions')}${metric('Recorded participation',participated.length,'Attended responses in the reporting month')}</div><div class="grid two-col">${section('Students by grade','Selected centre, date and filters',bars)}${section('Recorded attendance','Reporting month; all records retain historical assignment context',metric('Present / Absent / Leave',`${totals.p} / ${totals.a} / ${totals.l}`,'WO/MM and confirmed holidays excluded')+`<p class="chart-note">Engagement, dropout classifications, delivered sessions, cultural/sports bands and donor comparisons are not inferred from missing backend definitions.</p>`)}</div>`+section('Student performance summary','Names and other private fields follow the existing RLS profile capability.',profileRows());
  }
  function daily() {
    return section('Daily Attendance',`${state.on} · P Present · A Absent · L Leave · WO Sunday · MM Monthly Meeting`,
      `<div class="table-scroll"><table><thead><tr><th>Student</th><th>Shift / grade</th><th>Recorded status</th>${canWrite()?'<th>Correct status</th>':''}</tr></thead><tbody>${visible().map(s=>{
        const mark=data().attendance.find(a=>a.child_id===s.child_id&&a.shift_code===s.shift_code&&a.attendance_date===state.on);
        return `<tr><td>${esc(s.full_name||s.student_id)}</td><td>${esc(s.shift_code)} · ${esc(s.grade_label)}</td><td>${esc(mark?.code||'Unknown')}</td>${canWrite()?`<td><div class="pill-group">${['P','A','L','WO','MM'].map(code=>`<button data-work-action="mark" data-id="${esc(s.enrolment_id)}" data-code="${code}" class="${mark?.code===code?'active':''}">${code}</button>`).join('')}</div></td>`:''}</tr>`;
      }).join('')}</tbody></table>${!visible().length?empty('No verified enrolments for this date and selection.'):''}</div><p class="chart-note">Tapping the same status keeps it recorded. Clearing a mark, entering H/holidays, bulk marking, removal and undo are not available in this release.</p>`,action('Monthly insights','attendance'));
  }
  function attendancePage() {
    const t=attendanceTotals(filteredFacts(data(),'attendance',state),data().calendar);
    return `<div class="grid metrics">${metric('Recorded attendance',t.percentage===null?'—':`${t.percentage.toFixed(1)}%`,'Present / (Present + Absent + Leave)')}${metric('Present',t.p)}${metric('Absent',t.a)}${metric('Leave',t.l)}</div>`+
      section('Attendance history','Correction uses the stored revision, never a fabricated expected version.',`<div class="table-scroll"><table><thead><tr><th>Student</th><th>Date</th><th>Shift</th><th>Status</th></tr></thead><tbody>${filteredFacts(data(),'attendance',state).map(r=>`<tr><td>${esc(name(r.child_id))}</td><td>${esc(r.attendance_date)}</td><td>${esc(r.shift_code)}</td><td>${esc(r.code)}</td></tr>`).join('')}</tbody></table></div>`,canWrite()?action('Enter attendance','daily'):'')+
      section('Confirmed calendar','Calendar evidence is separate from CAC Held / Planned / Cancelled delivery status.',data().calendar.map(s=>`<p>${esc(s.session_date)} · ${esc(s.shift_code)} · ${s.is_scheduled?'Scheduled':'Confirmed non-scheduled day'}</p>`).join('')||empty('No calendar confirmations returned. Missing calendar rows prove nothing.'));
  }
  function learning() {
    const available=definitions();
    const rows=[...new Map(visible().map(r=>[r.child_id,r])).values()];
    return `<form id="definition-filter" class="filters">${choice('Quarter / configured paper','definition',available.map(d=>[d.id,quarterLabel(d,state.refs)]),state.definition)}<button class="btn" type="submit">Select</button></form>`+
      section('Student exam results','Configured maximum 25. Missing is unknown; a recorded 0 remains zero.',`<div class="table-scroll"><table><thead><tr><th>Student</th>${available.map(d=>`<th>${esc(quarterLabel(d,state.refs))}</th>`).join('')}${canWrite()?'<th>Correction</th>':''}</tr></thead><tbody>${rows.map(s=>`<tr><td>${esc(s.full_name||s.student_id)}</td>${available.map(d=>{const r=data().assessments.find(a=>a.child_id===s.child_id&&a.definition_id===d.id);return `<td>${r?`${esc(r.score)} /25<div class="subtext">${esc(r.assessed_on)}</div>`:'Not recorded'}</td>`;}).join('')}${canWrite()?`<td>${action('Edit marks','assess',`data-id="${esc(s.child_id)}" ${!available.length?'disabled':''}`)}</td>`:''}</tr>`).join('')}</tbody></table>${!rows.length?empty('No students in this selection.'):''}</div><p class="chart-note">The selected correction quarter is shown above. Batch replacement/comments, Absent status, clearing, date retagging, F aliases and removal/undo remain unsupported.</p>`);
  }
  function activities() {
    return section('Activity sessions','Named, dated, single-shift events. No sample catalogue or delivery status is loaded.',data().activities.filter(e=>!state.shift||e.shift_code===state.shift).map(e=>{
      const marks=filteredFacts(data(),'participation',state).filter(r=>r.event_id===e.id),yes=marks.filter(r=>r.participated===true).length;
      return `<div class="attention-item"><div><strong>${esc(e.name)}</strong><p>${esc(e.activity_date)} · ${esc(e.shift_code)} · ${yes} recorded attended responses</p><p>${marks.map(r=>`${esc(name(r.child_id))}: ${triState(r.participated)}`).join(' · ')}</p></div>${canWrite()?action('Record / correct participation','participation',`data-id="${esc(e.id)}"`):''}</div>`;
    }).join('')||empty('No activity events returned for this month.'),canWrite()?action('Add activity session','new-activity','','primary'):'');
  }
  function morarji() {
    const rows=filteredFacts(data(),'morarji',state).filter(r=>!state.cohort||r.cohort_id===state.cohort);
    return `<form id="cohort-filter" class="filters">${choice('Verified cohort','cohort',[['','All verified cohorts'],...state.refs.programme_cohorts.map(c=>[c.id,c.label])],state.cohort)}<button class="btn" type="submit">Select</button></form>`+
      section('Morarji training / admission tracking','Only supplied applied, attended, passed and school observations are stored.',`<div class="table-scroll"><table><thead><tr><th>Student</th><th>Applied</th><th>Attended</th><th>Passed</th><th>School</th>${canWrite()?'<th>Correction</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(name(r.child_id))}</td><td>${triState(r.applied)}</td><td>${triState(r.attended)}</td><td>${triState(r.passed)}</td><td>${esc(r.school_name||'Not recorded')}</td>${canWrite()?`<td>${action('Edit follow-up','morarji-edit',`data-id="${esc(r.membership_id)}"`)}</td>`:''}</tr>`).join('')}</tbody></table>${!rows.length?empty('No Morarji memberships returned.'):''}</div>`,canWrite()?action('Add participant','new-morarji','','primary'):'');
  }
  function management() {
    return section('Correct / remove entries','Available corrections protect against concurrent changes. Removal and undo are not available.',
      `<p>Attendance, recorded marks, participation and Morarji scalar outcomes can be corrected in their corresponding views. Historical assignments can be added or closed explicitly. Student name/gender/board corrections, activity-detail edits, CAC delivery edits, visit/note workflows and every delete/restore operation are not available in this live release. Contact the administrator for these corrections.</p><div class="head-actions">${action('Remove entry','blocked','disabled')}${action('Undo last removal','blocked','disabled')}</div><p class="chart-note">Missing entries remain unknown. Record a genuine programme exit by closing enrolment; contact the administrator about an incorrect profile.</p>`);
  }
  function login() {
    if(state.auth.status==='checking')return `<main class="auth-page"><section class="card auth-card" role="status">${esc(state.auth.message||'Checking your session…')}</section></main>`;
    return `<main class="auth-page"><section class="card auth-card"><img src="mass-logo.jpg" width="100" alt="MASS"><div class="eyebrow">Children’s Activity Centres</div><h1>Sign in</h1><p>Use your authorized MASS account. An administrator verifies staff roles and centre assignments.</p><form id="workspace-login">${field('Email','email','','email','required autocomplete="username"')}${field('Password','password','','password','required autocomplete="current-password"')}<p class="field-error" role="alert">${esc(state.auth.message||'')}</p><button type="submit" class="btn primary">Sign in</button></form><p class="form-help">No staff account or grant is created by signing in. Programme records stay out of browser storage.</p></section></main>`;
  }
  function render() {
    if(state.auth.status!=='signed-in'){root.innerHTML=login();return;}
    const roles=centre()?.roles||[...new Set((state.context?.centres||[]).flatMap(c=>c.roles))],leader=isLeadership(),officer=state.reviewView?state.reviewView==='Cluster Officer':roles.includes('Cluster Officer');
    const nav=leader?[['overview','Overview'],['attendance','Attendance'],['learning','Learning'],['activities','Activities & Engagement'],['morarji','Morarji scholarship prep'],['visits','Officer Visits']]:[['overview',officer?'My Centres':'Overview'],...(officer?[['attendance','Attendance']]:[['daily','Daily Attendance']]),['children','Student Profile'],['learning','Learning'],['activities','Activities'],['morarji','Morarji scholarship prep'],...(officer?[['visits','Visits']]:[])];
    if(leader&&['children','daily','manage'].includes(state.page))state.page='overview';
    const title=nav.find(([id])=>id===state.page)?.[1]||({attendance:'Attendance',manage:'Correct / remove entries',directory:'Donor centres'}[state.page])||'Programme overview';
    let content='';
    if(state.busy)content='<section class="card"><div class="empty" role="status" aria-live="polite">Loading authorized records…</div></section>';
    else if(state.error)content=`<section class="card"><div class="empty" role="alert">${esc(state.error)} ${action('Retry','retry')}</div></section>`;
    else if(!state.context?.centres.length)content=empty('No verified centre assignments are available for this account. Contact the administrator; no sample or unrestricted records will be shown.');
    else if(!state.data)content=empty('No records loaded.');
    else if(state.page==='visits')content=empty('Officer Visits is not available in the live workspace yet.');
    else content=filters()+(directoryEnabled?directoryPanel():'')+({overview,daily,children:()=>section('Student Profile','Permanent IDs and historical assignments; private fields follow server permissions.',profileRows(state.history),action(state.history?'Show as-of roster':'Show historical assignments','history')+(canWrite()?action('Add student','new-student','','primary'):'')),attendance:attendancePage,learning,activities,morarji,manage:management,directory:donorPage}[state.page]||overview)();
    root.innerHTML=`<div class="app ${state.menu?'menu-open':''} ${state.collapsed?'sidebar-collapsed':''}"><aside class="sidebar"><a class="brand" href="#" data-work-action="home"><span class="mass-logo"><img src="mass-logo.jpg" alt="MASS NGO logo" width="201" height="160"></span></a><div class="workspace"><span class="eyebrow">Programme workspace</span><strong>Children’s Activity Centres</strong></div>${action('Collapse menu','collapse','aria-label="Toggle sidebar"')}<div class="nav-label">${esc(roles.join(' / ')||'Authenticated account')}</div><nav class="nav">${nav.map(([id,label])=>`<button data-work-page="${id}" class="${state.page===id?'active':''}">${icon({overview:'home',daily:'calendar',children:'people',attendance:'calendar',learning:'book',activities:'activity',morarji:'chart',visits:'visit'}[id])}<span class="nav-text">${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><a class="text-button" href="MASS-CAC-Vercel-Source.zip" download>Application source</a></div></aside><main class="shell"><header class="topbar"><div><button class="mobile-menu" data-work-action="menu" aria-label="Open navigation">☰</button><span class="mass-logo header-logo"><img src="mass-logo.jpg" alt="MASS NGO" width="201" height="160"></span></div><div class="top-actions"><span class="demo-chip">Authorized programme records</span>${canWrite()?action('Correct / remove','manage') : ''}${action('Sign out','sign-out')}</div></header><div class="content"><div class="page-head"><div><div class="eyebrow">Children’s Activity Centres</div><h1>${esc(title)}</h1><p>${esc(centre()?.label||(state.centre==='all'?'All assigned centres':'Verified account access'))}</p></div><div class="head-actions">${directoryEnabled?action('Donor centres','donor'):leader?action('Donor summary','donor','disabled title="Directory API not enabled."'):''}</div></div>${state.notice?`<div class="integration-notice" role="status">${esc(state.notice)} ${action('Dismiss','dismiss')}</div>`:''}${content}</div></main><nav class="bottom-nav" aria-label="Mobile navigation">${nav.slice(0,4).map(([id,label])=>`<button data-work-page="${id}" class="${state.page===id?'active':''}">${label}</button>`).join('')}<button data-work-action="menu">More</button></nav></div>`;
  }
  let searchDelay;
  root.addEventListener('change',async event=>{
    const form=event.target.closest('#workspace-filters');
    if(!form||state.busy||state.saving)return;
    const changed=event.target.name;
    const f=Object.fromEntries(new FormData(form));
    Object.assign(state,f);
    if(changed==='donor' && !targetsForDonor().some(c=>c.centre_id===state.centre)){
      const permitted=targetsForDonor();
      state.centre=permitted.length<=10?'all':permitted[0]?.centre_id||'';
    }
    if(changed==='centre' && state.donor && state.donor!=='unassociated' &&
      !state.directory.some(c=>c.centre_id===state.centre&&c.donor_id===state.donor))state.donor='';
    if(changed==='month' && state.page==='daily')state.on=`${state.month}-01`;
    if(['donor','centre','month','on','year'].includes(changed))await load();
    else render();
  });
  root.addEventListener('input',event=>{
    if(event.target.name!=='query'||!event.target.closest('#workspace-filters'))return;
    const value=event.target.value;
    clearTimeout(searchDelay);
    searchDelay=setTimeout(()=>{state.query=value;render();},250);
  });
  root.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target;
    if(state.saving)return;
    if(form.id==='workspace-login'){
      const button=form.querySelector('button');button.disabled=true;
      const f=Object.fromEntries(new FormData(form));form.querySelector('[name=password]').value='';
      try{await session.signIn(f.email,f.password);if(new URLSearchParams(window.location.search).get('view')!=='workspace')window.location.reload();}catch(error){const target=root.querySelector('[role=alert]');if(target)target.textContent=error.message;}
      finally{if(button.isConnected)button.disabled=false;}
    }else if(form.id==='workspace-filters'){
      const f=Object.fromEntries(new FormData(form));Object.assign(state,f);
      if(!targetsForDonor().some(c=>c.centre_id===state.centre))state.centre=targetsForDonor().length<=10?'all':targetsForDonor()[0]?.centre_id||'';
      if(state.page==='daily')state.month=state.on.slice(0,7);
      await load();
    }else if(form.id==='definition-filter'){state.definition=new FormData(form).get('definition');render();}
    else if(form.id==='cohort-filter'){state.cohort=new FormData(form).get('cohort');render();}
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest('button,a');if(!button||button.disabled)return;
    if(state.saving&&button.dataset.workAction!=='sign-out')return;
    if(button.dataset.workPage){state.page=button.dataset.workPage;state.menu=false;if(state.page==='daily'&&state.month!==state.on.slice(0,7)){state.month=state.on.slice(0,7);await load();}else render();return;}
    const command=button.dataset.workAction;if(!command)return;event.preventDefault();
    try{
      if(command==='sign-out')await session.signOut();
      else if(command==='retry')await initialize(state.auth.user.id);
      else if(command==='home'){state.page='overview';state.menu=false;render();}
      else if(command==='menu'){state.menu=!state.menu;render();}
      else if(command==='collapse'){state.collapsed=!state.collapsed;render();}
      else if(command==='dismiss'){state.notice='';render();}
      else if(command==='reset-filters'){state.donor='';state.shift='';state.grade='';state.gender='';state.query='';await load();}
      else if(command==='donor'){state.page='directory';render();}
      else if(command==='directory-centre'){if(!targetsForDonor().some(c=>c.centre_id===button.dataset.id))return;state.centre=button.dataset.id;state.page='overview';await load();}
      else if(command==='history'){state.history=!state.history;render();}
      else if(command==='manage'){state.page='manage';render();}
      else if(command==='daily'){state.page='daily';state.month=state.on.slice(0,7);await load();}
      else if(command==='attendance'){state.page='attendance';render();}
      else if(command==='detail')details(button.dataset.id);
      else if(command==='new-student')addStudent();
      else if(command==='assignment')addAssignment(button.dataset.id);
      else if(command==='close-enrolment')closeAssignment(button.dataset.id);
      else if(command==='mark')await markAttendance(button.dataset.id,button.dataset.code);
      else if(command==='assess')assess(button.dataset.id);
      else if(command==='new-activity')addActivity();
      else if(command==='participation')participation(button.dataset.id);
      else if(command==='new-morarji')addMorarji();
      else if(command==='morarji-edit')editMorarji(button.dataset.id);
    }catch(error){notify(error.message);}
  });
  overlay.addEventListener('submit',async event=>{
    if(event.target.id!=='workspace-dialog')return;event.preventDefault();
    if(!canWrite())return;
    try{await modalSave?.(Object.fromEntries(new FormData(event.target)));}
    catch(error){const target=overlay.querySelector('[role=alert]');if(target)target.textContent=error.message;}
  });
  overlay.addEventListener('change',event=>{
    const id=event.target.dataset.participationEvent;if(!id)return;
    const existing=data().participation.find(r=>r.event_id===id&&r.child_id===event.target.value);
    const input=overlay.querySelector('[name=value]');if(input)input.value=triValue(existing?.participated);
  });
  overlay.addEventListener('click',event=>{if(event.target.closest('[data-modal-close]')||event.target.classList.contains('modal-backdrop'))closeModal();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeModal();state.menu=false;render();}
    if(event.key==='Tab'&&overlay.children.length){const nodes=[...overlay.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  render();await session.start();
  return {dispose(){session.stop();clearIdentity();root.replaceChildren();}};
}
