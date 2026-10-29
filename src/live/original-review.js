import {createBackendClient,clearStoredSession} from './client.js';
import {createReadApi} from './reads.js';
import {createDirectoryApi} from './directory.js';
import {createApi,BackendError} from './api.js';
import {createOriginalActions} from './original-actions.js';
import {reportingOn} from './population.js';
import {liveToday,monthWindow} from './model.js';

export async function startOriginalReview(config) {
 globalThis.__massReviewToday=liveToday();
 const {centres}=await import('../data.js'),client=createBackendClient(config),root=document.querySelector('#app');
 const readController=new AbortController();let dead=false;
 const clear=()=>{dead=true;readController.abort();const db=globalThis.__massLiveReviewData;if(db)for(const key of Object.keys(db))delete db[key];delete globalThis.__massLiveReviewData;delete globalThis.__massOriginalActions;delete globalThis.__massOriginalRefresh;delete globalThis.__massOfficerLabels;delete globalThis.__massAggregateFor;root.replaceChildren();document.querySelector('#overlay')?.replaceChildren();};
 const rpc=async(name,args={})=>{const r=await client.schema('mass_api').rpc(name,args).abortSignal(readController.signal);if(r.error)throw new BackendError(r.error,r.status,false);return r.data;};
 const login=message=>{
  root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>MASS CAC Dashboard</h1><form id="sign-in"><label class="field">Email<input name="email" type="email" autocomplete="username" required></label><label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label><p role="alert"></p><button class="btn primary">Sign in</button></form></section></main>';
  root.querySelector('[role=alert]').textContent=message||'';
  root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button');button.disabled=true;const f=new FormData(form);try{const {error}=await client.auth.signInWithPassword({email:String(f.get('email')).trim(),password:f.get('password')});if(error)throw Error('Unable to sign in. Check your account access.');form.reset();window.location.reload();}catch(error){form.querySelector('[role=alert]').textContent=error.message;}finally{button.disabled=false;}});
 };
 const session=await client.auth.getSession();if(!session.data?.session){login();return;}
 const identity=await client.auth.getUser();if(identity.error||!identity.data?.user){clearStoredSession(config);login('Your session has ended.');return;}
 root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>Loading authorized MASS records</h1><p id="mass-load-status" role="status">Preparing verified centre scope…</p></section></main>';
 try{
 const reads=createReadApi(client),directory=createDirectoryApi(client),api=createApi(client);
 const [context,dir,refs,capabilities]=await Promise.all([reads.context(readController.signal),directory.centres({signal:readController.signal}),reads.references(readController.signal),rpc('get_original_capabilities')]);
 if(capabilities?.original_workflows!==20||capabilities?.operational_details!==22||capabilities?.aggregate_api!==23)throw Error('The reviewed backend release is not installed.');
 if(context?.user_id!==identity.data.user.id||!context.centres?.length)throw Error('No verified centre scope is available. Contact the administrator.');
 const roles=new Set(context.centres.flatMap(c=>c.roles));globalThis.__massActualRole=roles.has('Leadership')?'Leadership':roles.has('Cluster Officer')?'Cluster Officer':'Teacher';
 globalThis.__massActualRoles=[...roles];globalThis.__massAggregateMode=globalThis.__massActualRole==='Leadership'||context.centres.some(c=>!c.can_read_profiles);
 let year=refs.academic_years.find(y=>y.starts_on<=liveToday()&&liveToday()<y.ends_before)||[...refs.academic_years].sort((a,b)=>b.starts_on.localeCompare(a.starts_on))[0];
 if(!year)throw Error('No approved academic year is configured.');
 const db={aggregates:{},version:1,academicYear:year.id,students:[],attendance:{},attendanceRecords:{},scores:{},assessmentDetails:{},participation:{},participationRecords:{},events:[],visits:[],visitSummary:{},visitOfficerSummary:{},visitAvailable:false,morarji:{},guidance:[],sessions:[],morarjiHistory:[],assessmentBatches:{},followups:{},lastSaved:null};
 globalThis.__massAcademicYears=refs.academic_years;
 function setMonths(){globalThis.__massReportingMonths=Array.from({length:12},(_,i)=>{const d=new Date(year.starts_on+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+i);return[d.toISOString().slice(0,7),d.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'Asia/Kolkata'})];});}
 setMonths();

 const dictionary=new Map(dir.map(d=>[d.centre_id,d])),definitions=new Map(refs.assessment_definitions.map(d=>[d.id,d])),periods=new Map(refs.assessment_periods.map(q=>[q.id,q]));
 centres.splice(0,centres.length,...context.centres.map(c=>({id:c.id,name:c.label,officer:'',officers:[],donor:dictionary.get(c.id)?.donor_label||''})));
 const aggregateLoading=new Set(),aggregateFailed=new Set();let dataEpoch=0;
 const officerLabels={};globalThis.__massOfficerLabels=officerLabels;
 async function refresh(){
  const reportYear=year;
  // Verify identity and current scope for every refresh; never trust a preview role.
  const [{data:auth,error},scope]=await Promise.all([client.auth.getUser(),reads.context(readController.signal)]);
  if(error||auth?.user?.id!==context.user_id||scope.user_id!==context.user_id||JSON.stringify(scope.centres)!==JSON.stringify(context.centres)){clear();throw Error('Your authorized scope changed. Sign in again.');}
  const results=[];let index=0;async function worker(){while(index<context.centres.length){const c=context.centres[index++];const [rows,staff,delivery,activityDetails,basis]=await Promise.all([reads.centre({centre:c.id,from:reportYear.starts_on,until:reportYear.ends_before,signal:readController.signal}),directory.staff({centre:c.id,signal:readController.signal}),reads.rows('read_delivery',{p_centre:c.id,p_from:reportYear.starts_on,p_until:reportYear.ends_before},readController.signal),reads.rows('read_activity_details',{p_centre:c.id,p_from:reportYear.starts_on,p_until:reportYear.ends_before},readController.signal),reads.rows('read_enrolment_basis',{p_centre:c.id},readController.signal)]);results.push({c,rows:{...rows,activities:activityDetails},staff,delivery,basis});const label=document.querySelector('#mass-load-status');if(label)label.textContent=`Loaded ${results.length}/${context.centres.length} authorized centres`;}}
  await Promise.all(Array.from({length:6},worker));
  // Build privately before swapping: failed loads never silently truncate the scope.
  const next={students:[],attendance:{},attendanceRecords:{},scores:{},assessmentDetails:{},participation:{},participationRecords:{},events:[],sessions:[],calendar:[],morarji:{},morarjiHistory:[]};const byEpisode=new Map(),observed={};
  for(const {c,rows,staff,delivery,basis} of results){const centre=centres.find(x=>x.id===c.id);centre.officers=[...new Set(staff.filter(s=>s.role_code==='Cluster Officer').map(s=>{officerLabels[s.staff_member_id]=s.display_name;return s.staff_member_id;}))];centre.officer=centre.officers[0]||'';
   for(const s of rows.students){const id=s.enrolment_id;if(byEpisode.has(id))continue;const student={id,childId:s.child_id,enrolmentId:id,studentId:s.student_id,name:s.full_name||s.student_id,centre:c.id,shift:s.shift_code,grade:s.grade_label,gender:s.gender_code||'',enrolled:s.starts_on,dateBasis:basis.find(r=>r.enrolment_id===id)?.date_basis||'not documented',active:!s.ends_before||liveToday()<s.ends_before,exitDate:s.ends_before||'',enrolmentStatus:s.status_code,boardPassed:s.class10_board_passed,row_version:s.row_version,note:''};byEpisode.set(id,student);next.students.push(student);next.scores[id]={F1:null,F2:null,F3:null,F4:null};}
   for(const a of rows.attendance){const id=a.enrolment_id;if(!byEpisode.has(id))throw Error('Attendance has an unavailable historical enrolment.');const key=id+'|'+a.attendance_date;next.attendance[key]=a.code;next.attendanceRecords[key]=a;((observed[c.id]??={})[a.attendance_date.slice(0,7)]??=new Set()).add(a.attendance_date);}
   for(const r of rows.assessments){const def=definitions.get(r.definition_id),period=periods.get(def?.period_id);if(!period||period.academic_year_id!==reportYear.id||Number(def.max_score)!==25)continue;const id=r.enrolment_id,key='F'+period.quarter;if(!next.scores[id])throw Error('Assessment has an unavailable historical enrolment.');if(next.assessmentDetails[id+'|'+key])throw Error('Conflicting assessment definitions need review.');next.scores[id][key]=r.score===null?null:Number(r.score);next.assessmentDetails[id+'|'+key]={...r,maxMarks:25,date:r.assessed_on||'',status:'Recorded',academicYear:reportYear.id};}
   for(const e of rows.activities)next.events.push({id:e.id,centre:c.id,date:e.activity_date,name:e.name,shift:e.shift_code,category:e.category||'',status:e.delivery_status||'',row_version:e.row_version});
   for(const p of rows.participation){const key=p.enrolment_id+'|'+p.event_id;next.participation[key]=p.participated===null?'Unknown':p.participated?'Attended':'Not attended';next.participationRecords[key]=p;}
   for(const r of delivery)next.sessions.push({id:r.id,centre:c.id,date:r.session_date,shift:r.shift_code,status:r.status,row_version:r.row_version});
   for(const r of rows.calendar)next.calendar.push({id:r.id,centre:c.id,date:r.session_date,shift:r.shift_code,status:r.is_scheduled?'Planned':'Not Scheduled'});
   for(const r of rows.morarji){const id=r.enrolment_id;if(!byEpisode.has(id))continue;const cohort=refs.programme_cohorts.find(x=>x.id===r.cohort_id);next.morarjiHistory.push({s:byEpisode.get(id),...r,cohort:cohort?.label||'',membershipId:r.membership_id,school:r.school_name,applied:r.applied??null,attended:r.attended??null,passed:r.passed??null,took:r.attended??null,result:r.passed===true?'Passed':r.passed===false?'Not passed':'Not recorded',trainingDays:null,selected:null,admitted:null,scholarship:'Not recorded'});}
  }
  if(dead)throw Error('Session ended during data load.');Object.assign(db,next);db.academicYear=reportYear.id;globalThis.__massConfiguredQuarters=refs.assessment_definitions.filter(d=>periods.get(d.period_id)?.academic_year_id===reportYear.id).map(d=>periods.get(d.period_id).quarter);db.aggregates={};aggregateFailed.clear();dataEpoch++;globalThis.__massReviewObservedDatesByCentre=Object.fromEntries(Object.entries(observed).map(([id,months])=>[id,Object.fromEntries(Object.entries(months).map(([m,dates])=>[m,[...dates].sort()]))]));
  const reportingMonth=reportYear.starts_on<=liveToday()&&liveToday()<reportYear.ends_before?liveToday().slice(0,7):reportYear.starts_on.slice(0,7);await loadVisits(reportingMonth);if(globalThis.__massAggregateMode)await loadAggregates({month:reportingMonth});
 }
 async function loadVisits(month,officer=null){
  const {from,until}=monthWindow(month);const summaries=[],details=[],officers=[];const selectedOfficer=officer;
  if(globalThis.__massActualRole==='Cluster Officer'&&!officer){try{const assignments=await rpc('get_visit_assignments',{});const ids=[...new Set(assignments.map(a=>a.officer_id))];if(ids.length!==1)throw Error('One verified staff identity is required for officer-specific targets.');officer=ids[0];}catch(error){if(dead)return;db.visitAvailable=false;db.visitError=error.message;return;}}
  try{let index=0;await Promise.all(Array.from({length:6},async()=>{while(index<context.centres.length){const c=context.centres[index++];const [rows,grouped]=await Promise.all([rpc('visit_summary',{p_centre:c.id,p_from:from,p_until:until,p_officer:officer}),rpc('visit_officer_summary',{p_centre:c.id,p_from:from,p_until:until})]);summaries.push(...rows);officers.push(...grouped.map(r=>({...r,centre_id:c.id})));if(c.can_write&&c.roles.includes('Cluster Officer')){for(let offset=0;offset<=100000;offset+=100){const page=await rpc('read_visits',{p_centre:c.id,p_from:from,p_until:until,p_limit:100,p_offset:offset});details.push(...page);if(page.length<100)break;if(offset===100000)throw Error('Visit limit exceeded; narrow the scope.');}}}}));if(dead)return;
   db.visitSummary[month+'|'+(selectedOfficer||'')]=summaries;db.visitOfficerSummary[month]=officers;db.visits=details.map(v=>({...v,centre:v.centre_id,officer:v.officer_id,shift:v.shift_code,date:v.visit_date,action:v.next_action}));db.visitAvailable=true;
  }catch(error){if(dead)return;db.visitAvailable=false;db.visitError=error.message;db.visits=[];}
  if(!dead)globalThis.__massOriginalRefresh?.();
 }
 function aggregateKey(s){return [s.month,s.grade||'',s.shift||'',s.gender||''].join('|');}
 async function loadAggregates(state){
  if(!globalThis.__massAggregateMode)return;
  const key=aggregateKey(state);if(db.aggregates[key]||aggregateLoading.has(key)||aggregateFailed.has(key))return;aggregateLoading.add(key);const epoch=dataEpoch;
  const {from,until}=monthWindow(state.month),output=[];let index=0;
  try{await Promise.all(Array.from({length:6},async()=>{while(index<context.centres.length){const c=context.centres[index++];output.push(await rpc('programme_aggregate',{p_centre:c.id,p_on:reportingOn({...state,today:liveToday()}),p_from:from,p_until:until,p_year:year.id,p_grade:state.grade||null,p_shift:state.shift||null,p_gender:state.gender||null}));}}));if(!dead&&epoch===dataEpoch)db.aggregates[key]=output;}catch(error){db.aggregateError=error.message;aggregateFailed.add(key);}
  aggregateLoading.delete(key);if(!dead)globalThis.__massOriginalRefresh?.();
 }
 globalThis.__massLoadAggregates=loadAggregates;
 globalThis.__massAggregateFor=(state,selected)=>{
  const rows=db.aggregates[aggregateKey(state)];if(!rows)return null;
  const ids=new Set(selected.map(c=>c.id)),values=rows.filter(r=>ids.has(r.centre_id));
  const result={students:0,grades:{},genders:{},attendance:{p:0,a:0,l:0,excluded:0},quarters:{},changes:{},centres:values};
  for(const r of values){result.students+=Number(r.students);for(const key of ['grades','genders','attendance'])for(const [k,v] of Object.entries(r[key]))result[key][k]=(result[key][k]||0)+Number(v);
   for(const q of r.quarters){const out=result.quarters[q.quarter]??={n:0,total:0,low:0,developing:0,good:0,strong:0,above20:0,precision_review:0};for(const k of ['n','low','developing','good','strong','above20','precision_review'])out[k]+=Number(q[k]);out.total+=Number(q.mean||0)*Number(q.n);}
   for(const c of r.changes){const out=result.changes[c.earlier+'|'+c.later]??={n:0,earlier:0,later:0,improved:0,unchanged:0,declined:0};out.n+=Number(c.n);out.earlier+=Number(c.earlier_mean)*Number(c.n);out.later+=Number(c.later_mean)*Number(c.n);for(const k of ['improved','unchanged','declined'])out[k]+=Number(c[k]);}
  }return result;
 };
 globalThis.__massAggregateExport=(state,selected)=>{const a=globalThis.__massAggregateFor(state,selected);if(!a)throw Error('Load the authorized aggregate before exporting.');return [['Centre','Students','Present student-days','Good engagement','Month','Grade','Shift','Gender'],...a.centres.map(r=>[centres.find(c=>c.id===r.centre_id)?.name||'',r.students,r.attendance.p,'Unknown: coverage incomplete',state.month,state.grade,state.shift,state.gender])];};
 let yearChanging=false;globalThis.__massSelectAcademicYear=async(id)=>{if(yearChanging)throw Error('Wait for the academic year load.');const selected=refs.academic_years.find(y=>y.id===id);if(!selected)throw Error('Choose an approved academic year.');yearChanging=true;const previous=year;globalThis.__massDataLoading=true;year=selected;setMonths();try{await refresh();return selected;}catch(error){year=previous;setMonths();throw error;}finally{yearChanging=false;globalThis.__massDataLoading=false;}};
 globalThis.__massLoadVisitMonth=loadVisits;
 await refresh();globalThis.__massMorarjiCohort=Object.values(db.morarji)[0]?.cohort||db.morarjiHistory[0]?.cohort||'';globalThis.__massLiveReviewData=db;
 globalThis.__massOriginalActions=createOriginalActions({client,api,refs,context,refresh,signOut:async()=>{clear();try{await client.auth.signOut({scope:'local'});}finally{clearStoredSession(config);window.location.reload();}}});
 const fingerprint=JSON.stringify(context.centres);
 client.auth.onAuthStateChange((event,session)=>queueMicrotask(async()=>{if(!session||session.user?.id!==context.user_id){clear();login('Your session has ended.');return;}if(event==='TOKEN_REFRESHED'){try{const current=await reads.context(readController.signal);if(current.user_id!==context.user_id||JSON.stringify(current.centres)!==fingerprint){clear();login('Your scope changed. Sign in again.');}}catch{clear();login('Unable to verify your current access.');}}}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void verifyScope();});
 async function verifyScope(){if(dead)return;try{const [current,auth]=await Promise.all([reads.context(readController.signal),client.auth.getUser()]);if(auth.error||auth.data?.user?.id!==context.user_id||current.user_id!==context.user_id||JSON.stringify(current.centres)!==fingerprint){clear();login('Your access changed. Sign in again.');}}catch{clear();login('Unable to verify current access.');}}
 const timer=setInterval(()=>{if(dead)clearInterval(timer);else void verifyScope();},30000);
 await import('../app.js');
 }catch(error){clear();root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>Programme data could not be loaded</h1><p role="alert"></p><button onclick="location.reload()">Retry verified load</button></section></main>';root.querySelector('[role=alert]').textContent=error.message;}
}
