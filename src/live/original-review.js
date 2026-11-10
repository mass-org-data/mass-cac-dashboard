import {createBackendClient,clearStoredSession} from './client.js';
import {createReadApi} from './reads.js';
import {createDirectoryApi} from './directory.js';
import {createApi,BackendError} from './api.js';
import {createOriginalActions} from './original-actions.js';
import {reportingOn} from './population.js';
import {liveToday,monthWindow} from './model.js';
import {showSignIn,handleRecoveryEntry,scrubImplicitFragment} from './auth-page.js';
import {loadVisitTrends} from './visit-trends.js';
import {discoverCapabilities,BASELINE_READ_NOTICE,safeDiagnosticText} from './backend-capabilities.js';
import {baselineAggregates} from './baseline-aggregates.js';
import {reviewedCalculations} from './reviewed-calculations.js';
import {createAccessVerificationGate,isAuthorizationFailure} from './access-verification.js';
import {createAttendanceRegister} from './attendance-register.js';
import {hydrateRosterNames} from './roster-names.js';
import {authorizedRoles,defaultAuthorizedRole,roleDataPlan} from './role-data.js';

export async function startOriginalReview(config) {
 globalThis.__massReviewToday=liveToday();
 window.addEventListener('hashchange',()=>scrubImplicitFragment());
 const {centres}=await import('../data.js'),client=createBackendClient(config),root=document.querySelector('#app');
 const readController=new AbortController(),reviewedCache=new Map();let dead=false;
 const clear=()=>{dead=true;delete globalThis.__massOperationalRoles;delete globalThis.__massSelectRole;delete globalThis.__massEnsureView;delete globalThis.__massOverviewOnly;delete globalThis.__massProfilePages;delete globalThis.__massAttendance;reviewedCache.clear();delete globalThis.__massReviewedFor;delete globalThis.__massDependentOptions;readController.abort();const db=globalThis.__massLiveReviewData;if(db)for(const key of Object.keys(db))delete db[key];delete globalThis.__massLiveReviewData;delete globalThis.__massOriginalActions;delete globalThis.__massOriginalRefresh;delete globalThis.__massOfficerLabels;delete globalThis.__massAggregateFor;root.replaceChildren();document.querySelector('#overlay')?.replaceChildren();};
 const rpc=async(name,args={})=>{const r=await client.schema('mass_api').rpc(name,args).abortSignal(readController.signal);if(r.error)throw new BackendError(r.error,r.status,false,name);return r.data;};
 const login=()=>{clearStoredSession(config);window.location.reload();};
 root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>Checking your session</h1><p role="status">No programme records have been loaded.</p></section></main>';
 if(await handleRecoveryEntry(client,{root,clearSession:()=>clearStoredSession(config)}))return;
 const session=await client.auth.getSession();
 if(session.error||!session.data?.session)return showSignIn(client,{root,clearSession:()=>clearStoredSession(config)});
 const identity=await client.auth.getUser();
 if(identity.error||!identity.data?.user||identity.data.user.id!==session.data.session.user?.id){clearStoredSession(config);return showSignIn(client,{root,message:'Your session has ended. Sign in again.',clearSession:()=>clearStoredSession(config)});}
 globalThis.__massPublicReview=false;
 root.innerHTML='<main class="loading-shell"><header><img src="mass-logo.jpg" alt="MASS NGO"><strong>Children’s Activity Centres</strong></header><section class="card"><h1>Overview</h1><p id="mass-load-status" role="status">Loading authorized records…</p></section></main>';
 try{
 const reads=createReadApi(client),directory=createDirectoryApi(client),api=createApi(client);
 const [context,dir,refs,capabilities]=await Promise.all([reads.context(readController.signal),directory.centres({signal:readController.signal}),reads.references(readController.signal),discoverCapabilities(rpc)]);
 globalThis.__massBackendCapabilities=capabilities;globalThis.__massBackendNotice=capabilities.baseline?BASELINE_READ_NOTICE:!capabilities.operationalDetails||!capabilities.aggregates?'The installed backend has partial workflow capabilities. Unavailable operational and reporting features require activation; no data or permission is invented.':'';
 if(context?.user_id!==identity.data.user.id||!context.centres?.length)throw Error('No verified centre scope is available. Contact the administrator.');
 globalThis.__massOperationalRoles=context.operational_roles_enabled===true;globalThis.__massActualRoles=authorizedRoles(context);globalThis.__massActualRole=defaultAuthorizedRole(context);
 if(!globalThis.__massActualRole)throw Error('No verified role is available. Contact the administrator.');
 let detailsReady=false,loadedView='overview';
 const setRoleRuntime=role=>{const plan=roleDataPlan(context,role,{aggregateApi:capabilities.aggregates||capabilities.reviewedCharts,view:detailsReady?loadedView:'overview'});globalThis.__massActualRole=role;globalThis.__massAggregateMode=plan.aggregateMode;globalThis.__massOverviewOnly=!detailsReady&&(capabilities.aggregates||capabilities.reviewedCharts);return plan;};
 setRoleRuntime(globalThis.__massActualRole);
 let year=refs.academic_years.find(y=>y.starts_on<=liveToday()&&liveToday()<y.ends_before)||[...refs.academic_years].sort((a,b)=>b.starts_on.localeCompare(a.starts_on))[0];
 if(!year)throw Error('No approved academic year is configured.');
 const db={aggregates:{},version:1,academicYear:year.id,students:[],attendance:{},attendanceRecords:{},scores:{},assessmentDetails:{},participation:{},participationRecords:{},events:[],visits:[],visitSummary:{},visitOfficerSummary:{},visitAvailable:false,visitLoading:false,morarji:{},guidance:[],sessions:[],morarjiHistory:[],assessmentBatches:{},followups:{},lastSaved:null};
 globalThis.__massAcademicYears=refs.academic_years;db.references=refs;
 function setMonths(){globalThis.__massReportingMonths=Array.from({length:12},(_,i)=>{const d=new Date(year.starts_on+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+i);return[d.toISOString().slice(0,7),d.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'Asia/Kolkata'})];});}
 setMonths();

 const dictionary=new Map(dir.map(d=>[d.centre_id,d])),definitions=new Map(refs.assessment_definitions.map(d=>[d.id,d])),periods=new Map(refs.assessment_periods.map(q=>[q.id,q]));
 centres.splice(0,centres.length,...context.centres.map(c=>({id:c.id,name:c.label,roles:[...c.roles],officer:'',officers:[],donor:dictionary.get(c.id)?.donor_label||''})));
 const aggregateLoading=new Set(),aggregateFailed=new Set();let dataEpoch=0;
 let trendsRequested=false,trendOfficer=null,visitSequence=0;
 const officerLabels={};globalThis.__massOfficerLabels=officerLabels;
 async function refresh(){
  globalThis.__massAttendance?.invalidate();
  const reportYear=year;
  // Verify identity and current scope for every refresh; never trust a preview role.
  const [{data:auth,error},scope]=await Promise.all([client.auth.getUser(),reads.context(readController.signal)]);
  if(error||auth?.user?.id!==context.user_id||scope.user_id!==context.user_id||JSON.stringify(scope.centres)!==JSON.stringify(context.centres)){clear();throw Error('Your authorized scope changed. Sign in again.');}
  // Aggregate-capable accounts never need centre-level profile/fact downloads
  // to render programme reporting. Older baselines retain their local fallback.
  const plan=roleDataPlan(context,globalThis.__massActualRole,{aggregateApi:capabilities.aggregates||capabilities.reviewedCharts,view:detailsReady?loadedView:'overview'}),loadCentres=plan.detailedCentres;
  const results=[];let index=0;async function worker(){while(index<loadCentres.length){const c=loadCentres[index++];const [rows,staff,delivery,activityDetails,basis]=await Promise.all([reads.centre({centre:c.id,from:reportYear.starts_on,until:reportYear.ends_before,includeAssessments:capabilities.periodAssessments,view:loadedView,signal:readController.signal}),Promise.resolve([]),capabilities.operationalDetails&&['attendance','student-detail'].includes(loadedView)?reads.rows('read_delivery',{p_centre:c.id,p_from:reportYear.starts_on,p_until:reportYear.ends_before},readController.signal):Promise.resolve([]),capabilities.operationalDetails&&['attendance','activities','student-detail'].includes(loadedView)?reads.rows('read_activity_details',{p_centre:c.id,p_from:reportYear.starts_on,p_until:reportYear.ends_before},readController.signal):Promise.resolve(null),capabilities.aggregates&&['children','student-detail'].includes(loadedView)?reads.rows('read_enrolment_basis',{p_centre:c.id},readController.signal):Promise.resolve([])]);const namedStudents=plan.role!=='Leadership'&&c.can_write?await hydrateRosterNames(rows.students,c.id,args=>rpc('read_attendance_register',args),liveToday()):rows.students;results.push({c,rows:{...rows,students:namedStudents,activities:activityDetails??rows.activities},staff,delivery,basis});const label=document.querySelector('#mass-load-status');if(label)label.textContent=`Loaded ${results.length}/${loadCentres.length} ${plan.role} centres`;}}
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
   for(const r of rows.morarji){const id=r.enrolment_id;if(!byEpisode.has(id))continue;const cohort=refs.programme_cohorts.find(x=>x.id===r.cohort_id);next.morarjiHistory.push({s:byEpisode.get(id),...r,cohort:cohort?.label||'',cohortAcademicYear:cohort?.academic_year_id||null,membershipId:r.membership_id,school:r.school_name,applied:r.applied??null,attended:r.attended??null,passed:r.passed??null,took:r.attended??null,result:r.passed===true?'Passed':r.passed===false?'Not passed':'Not recorded',trainingDays:null,selected:null,admitted:null,scholarship:'Not recorded'});}
  }
  if(dead)throw Error('Session ended during data load.');Object.assign(db,next);db.visitTrends=null;reviewedCache.clear();globalThis.__massProfilePages?.invalidate();db.academicYear=reportYear.id;globalThis.__massConfiguredQuarters=refs.assessment_definitions.filter(d=>periods.get(d.period_id)?.academic_year_id===reportYear.id).map(d=>periods.get(d.period_id).quarter);db.aggregates={};aggregateFailed.clear();dataEpoch++;globalThis.__massReviewObservedDatesByCentre=Object.fromEntries(Object.entries(observed).map(([id,months])=>[id,Object.fromEntries(Object.entries(months).map(([m,dates])=>[m,[...dates].sort()]))]));
  db.visits=[];db.visitSummary={};db.visitOfficerSummary={};db.visitAvailable=false;db.visitLoading=false;
  const reportingMonth=reportYear.starts_on<=liveToday()&&liveToday()<reportYear.ends_before?liveToday().slice(0,7):reportYear.starts_on.slice(0,7);if(globalThis.__massAggregateMode&&!capabilities.reviewedCharts)await loadAggregates({month:reportingMonth});if(trendsRequested&&globalThis.__massActualRole==='Cluster Officer')await refreshVisitTrends();
 }
 function activeCentres(){return roleDataPlan(context,globalThis.__massActualRole,{aggregateApi:capabilities.aggregates||capabilities.reviewedCharts}).centres;}
 async function loadVisits(month,officer=null,force=false){
  if(!capabilities.operationalDetails){db.visitAvailable=false;db.visitError='Visit backend activation pending; existing directory assignments are not visit events.';return;}
  if(db.visitLoading&&!force)return;const sequence=++visitSequence,epoch=dataEpoch;db.visitLoading=true;
  const {from,until}=monthWindow(month);const summaries=[],details=[],officers=[];const selectedOfficer=officer;
  if(globalThis.__massActualRole==='Cluster Officer'&&!officer){try{const assignments=await rpc('get_visit_assignments',{});const ids=[...new Set(assignments.map(a=>a.officer_id))];if(ids.length!==1)throw Error('One verified staff identity is required for officer-specific targets.');officer=ids[0];}catch(error){if(!dead){db.visitAvailable=false;db.visitError=error.message;}db.visitLoading=false;return;}}
  try{const scoped=activeCentres();let index=0;await Promise.all(Array.from({length:Math.min(6,scoped.length)},async()=>{while(index<scoped.length){const c=scoped[index++];const [rows,grouped,staff]=await Promise.all([rpc('visit_summary',{p_centre:c.id,p_from:from,p_until:until,p_officer:officer}),rpc('visit_officer_summary',{p_centre:c.id,p_from:from,p_until:until}),globalThis.__massAggregateMode?directory.staff({centre:c.id,signal:readController.signal}):Promise.resolve([])]);if(staff.length){const centre=centres.find(x=>x.id===c.id);centre.officers=[...new Set(staff.filter(s=>s.role_code==='Cluster Officer').map(s=>{officerLabels[s.staff_member_id]=s.display_name;return s.staff_member_id;}))];centre.officer=centre.officers[0]||'';}summaries.push(...rows);officers.push(...grouped.map(r=>({...r,centre_id:c.id})));if(c.can_write&&c.roles.includes('Cluster Officer')){for(let offset=0;offset<=100000;offset+=100){const page=await rpc('read_visits',{p_centre:c.id,p_from:from,p_until:until,p_limit:100,p_offset:offset});details.push(...page);if(page.length<100)break;if(offset===100000)throw Error('Visit limit exceeded; narrow the scope.');}}}}));if(dead||sequence!==visitSequence||epoch!==dataEpoch)return;
   db.visitSummary[month+'|'+(selectedOfficer||'')]=summaries;db.visitOfficerSummary[month]=officers;db.visits=details.map(v=>({...v,centre:v.centre_id,officer:v.officer_id,shift:v.shift_code,date:v.visit_date,action:v.next_action}));db.visitAvailable=true;
  }catch(error){if(dead||sequence!==visitSequence||epoch!==dataEpoch)return;db.visitAvailable=false;db.visitError=error.message;db.visits=[];}
  db.visitLoading=false;if(!dead)globalThis.__massOriginalRefresh?.();
 }
 function aggregateKey(s){return [s.month,s.grade||'',s.shift||'',s.gender||''].join('|');}
 async function loadAggregates(state){
  if(!globalThis.__massAggregateMode)return;
  const key=aggregateKey(state);if(db.aggregates[key]||aggregateLoading.has(key)||aggregateFailed.has(key))return;aggregateLoading.add(key);const epoch=dataEpoch;
  if(state.gender==='Unknown'){aggregateLoading.delete(key);return;}
  if(!capabilities.aggregates){try{db.aggregates[key]=baselineAggregates(db,centres,{...state,page:'overview',today:liveToday()});}catch(error){db.aggregateError=error.message;aggregateFailed.add(key);}finally{aggregateLoading.delete(key);}return;}
  const {from,until}=monthWindow(state.month),output=[];let index=0;
  const scoped=activeCentres();try{await Promise.all(Array.from({length:Math.min(6,scoped.length)},async()=>{while(index<scoped.length){const c=scoped[index++];output.push(await rpc('programme_aggregate',{p_centre:c.id,p_on:reportingOn({...state,today:liveToday()}),p_from:from,p_until:until,p_year:year.id,p_grade:state.grade||null,p_shift:state.shift||null,p_gender:state.gender||null}));}}));if(!dead&&epoch===dataEpoch)db.aggregates[key]=output;}catch(error){db.aggregateError=error.message;aggregateFailed.add(key);}
  aggregateLoading.delete(key);if(!dead)globalThis.__massOriginalRefresh?.();
 }
 globalThis.__massReviewedFor=(state,selected)=>{
  const key=JSON.stringify([dataEpoch,state.page,state.date,state.month,state.academicYear,state.grade,state.shift,state.gender,state.query,state.fromExam,state.toExam,selected.map(c=>c.id).sort()]);
  if(reviewedCache.has(key))return reviewedCache.get(key);
  if(state.month>liveToday().slice(0,7)){const value={unavailable:'Future reporting periods have no verified observations.'};reviewedCache.set(key,value);return value;}
  if(capabilities.reviewedCharts&&selected.length&&!state.query){
   reviewedCache.set(key,{pending:'Loading authorized reviewed calculations…'});const epoch=dataEpoch;const {from,until}=monthWindow(state.month);
   void rpc('reviewed_chart_metrics',{p_centres:selected.map(c=>c.id),p_on:reportingOn({...state,today:liveToday()}),p_from:from,p_until:until,p_year:year.id,p_grade:state.grade||null,p_shift:state.shift||null,p_gender:state.gender||null,p_earlier:Number(state.fromExam.slice(1)),p_later:Number(state.toExam.slice(1))}).then(value=>{if(!dead&&epoch===dataEpoch){reviewedCache.set(key,value);globalThis.__massOriginalRefresh?.();}}).catch(error=>{if(!dead&&epoch===dataEpoch){reviewedCache.set(key,{unavailable:[error.message,safeDiagnosticText(error)].filter(Boolean).join(' · ')});globalThis.__massOriginalRefresh?.();}});
   return reviewedCache.get(key);
  }
  const value=reviewedCalculations(db,centres,state,{profileReadable:!globalThis.__massAggregateMode,assessmentReady:capabilities.periodAssessments,detailsReady:capabilities.operationalDetails});
  reviewedCache.set(key,value);return value;
 };
 globalThis.__massDependentOptions=(state,selected)=>{
  if(!globalThis.__massAggregateMode)return null;
  const read=(shift,gender=state.gender)=>{
   const facet={...state,shift,gender,grade:'',query:''};
   if(capabilities.reviewedCharts)return globalThis.__massReviewedFor(facet,selected);
   if(!capabilities.aggregates||gender==='Unknown')return {unavailable:true};
   void loadAggregates(facet);return globalThis.__massAggregateFor?.(facet,selected)||{pending:true};
  };
  const unfilteredGender=read(state.shift||'','');
  if(unfilteredGender.pending||unfilteredGender.unavailable)return {pending:true};
  if(state.gender&&!Number(unfilteredGender.genders?.[state.gender]))return {invalidGender:true};
  const active=read(state.shift||''),morning=read('Morning'),evening=read('Evening');
  if([active,morning,evening].some(r=>r.pending||r.unavailable))return {pending:true};
  return {ready:true,grade:Object.entries(active.grades||{}).filter(([,n])=>Number(n)>0).map(([g])=>g).sort((a,b)=>Number(a)-Number(b)),shift:[['Evening',evening],['Morning',morning]].filter(([,r])=>Number(r.children??r.students)>0).map(([shift])=>shift)};
 };
 globalThis.__massLoadAggregates=loadAggregates;
 globalThis.__massSelectRole=async role=>{if(role===globalThis.__massActualRole)return role;const previous=globalThis.__massActualRole,previousDetails=detailsReady,previousView=loadedView;detailsReady=false;loadedView='overview';setRoleRuntime(role);try{await refresh();return role;}catch(error){detailsReady=previousDetails;loadedView=previousView;setRoleRuntime(previous);throw error;}};
 let detailLoad=null;
 globalThis.__massEnsureView=async page=>{
  if(['overview','donor','visits'].includes(page)||globalThis.__massActualRole==='Leadership'||(detailsReady&&loadedView===page))return;
  if(detailLoad)return detailLoad;
  const role=globalThis.__massActualRole,previousView=loadedView,previousDetails=detailsReady;detailsReady=true;loadedView=page;setRoleRuntime(role);
  detailLoad=refresh().catch(error=>{detailsReady=previousDetails;loadedView=previousView;setRoleRuntime(role);throw error;}).finally(()=>{detailLoad=null;});
  return detailLoad;
 };
 globalThis.__massAggregateFor=(state,selected)=>{
  const rows=db.aggregates[aggregateKey(state)];if(!rows)return null;
  const ids=new Set(selected.map(c=>c.id)),values=rows.filter(r=>ids.has(r.centre_id));
  const result={students:0,grades:{},genders:{},attendance:{p:0,a:0,l:0,excluded:0},quarters:{},changes:{},centres:values};
  for(const r of values){result.students+=Number(r.students);for(const key of ['grades','genders','attendance'])for(const [k,v] of Object.entries(r[key]))result[key][k]=(result[key][k]||0)+Number(v);
   for(const q of r.quarters){const out=result.quarters[q.quarter]??={n:0,total:0,low:0,developing:0,good:0,strong:0,above20:0,precision_review:0};for(const k of ['n','low','developing','good','strong','above20','precision_review'])out[k]+=Number(q[k]);out.total+=Number(q.mean||0)*Number(q.n);}
   for(const c of r.changes){const out=result.changes[c.earlier+'|'+c.later]??={n:0,earlier:0,later:0,improved:0,unchanged:0,declined:0};out.n+=Number(c.n);out.earlier+=Number(c.earlier_mean)*Number(c.n);out.later+=Number(c.later_mean)*Number(c.n);for(const k of ['improved','unchanged','declined'])out[k]+=Number(c[k]);}
  }return result;
 };
 globalThis.__massAggregateExport=(state,selected)=>{if(capabilities.reviewedCharts){const m=globalThis.__massReviewedFor(state,selected);if(!m||m.pending||m.unavailable)throw Error('Load the reviewed aggregate before exporting.');return [['Centre','Students','Enrolments','Present student-days','Good engagement','Month','Grade','Shift','Gender'],...m.centres.map(r=>[centres.find(c=>c.id===r.id)?.name||'',r.children,r.enrolments,r.attendance.p,'Unknown: colour boundaries pending',state.month,state.grade,state.shift,state.gender])];}const a=globalThis.__massAggregateFor(state,selected);if(!a)throw Error('Load the authorized aggregate before exporting.');return [['Centre','Students','Present student-days','Good engagement','Month','Grade','Shift','Gender'],...a.centres.map(r=>[centres.find(c=>c.id===r.centre_id)?.name||'',r.students,r.attendance.p,'Unknown: coverage incomplete',state.month,state.grade,state.shift,state.gender])];};
 let yearChanging=false;globalThis.__massSelectAcademicYear=async(id)=>{if(yearChanging)throw Error('Wait for the academic year load.');const selected=refs.academic_years.find(y=>y.id===id);if(!selected)throw Error('Choose an approved academic year.');yearChanging=true;const previous=year;globalThis.__massDataLoading=true;year=selected;setMonths();try{await refresh();return selected;}catch(error){year=previous;setMonths();throw error;}finally{yearChanging=false;globalThis.__massDataLoading=false;}};
 async function refreshVisitTrends(){
  if(!capabilities.operationalDetails){db.visitTrendsError='Visit backend activation pending.';globalThis.__massOriginalRefresh?.();return;}
  const epoch=dataEpoch;db.visitTrendsLoading=true;db.visitTrendsError='';globalThis.__massOriginalRefresh?.();
  try{let officer=trendOfficer;if(!officer&&globalThis.__massActualRole==='Cluster Officer'){const links=await rpc('get_visit_assignments',{});const ids=[...new Set(links.map(a=>a.officer_id))];if(ids.length!==1)throw Error('One verified officer identity is required for monthly trends.');officer=ids[0];}const values=await loadVisitTrends({officer,months:(globalThis.__massReportingMonths||[]).map(([month])=>month).filter(month=>month<=liveToday().slice(0,7)),centres:activeCentres().map(c=>c.id),readSummary:args=>rpc('visit_summary',args)});if(!dead&&epoch===dataEpoch){db.visitTrends=values;db.visitTrendOfficer=trendOfficer;}}
  catch(error){if(!dead&&epoch===dataEpoch){db.visitTrends=null;db.visitTrendsError=error.message;}}
  finally{if(!dead&&epoch===dataEpoch){db.visitTrendsLoading=false;globalThis.__massOriginalRefresh?.();}}
 }
 globalThis.__massLoadVisitTrends=async(officer=null)=>{if(db.visitTrendsLoading)return;trendOfficer=officer;trendsRequested=true;await refreshVisitTrends();};
 globalThis.__massLoadVisitMonth=loadVisits;
 await refresh();globalThis.__massMorarjiCohort=Object.values(db.morarji)[0]?.cohort||db.morarjiHistory[0]?.cohort||'';globalThis.__massLiveReviewData=db;
 globalThis.__massOriginalActions=createOriginalActions({client,api,refs,context,refresh,capabilities,signOut:async()=>{clear();try{await client.auth.signOut({scope:'local'});}finally{clearStoredSession(config);window.location.reload();}}});
 const fingerprint=JSON.stringify(context.centres);let verifying=false;
 const endSession=()=>{clear();login();};
 const verification=createAccessVerificationGate({root,onBlock:()=>{globalThis.__massAttendance?.discard();document.querySelector('#overlay')?.replaceChildren();document.body.style.overflow='';},onRestore:()=>globalThis.__massOriginalRefresh?.(),onRetry:()=>void verifyScope()});
 client.auth.onAuthStateChange((event,session)=>queueMicrotask(async()=>{if(!session||session.user?.id!==context.user_id){endSession();return;}if(event==='TOKEN_REFRESHED'){try{const current=await reads.context(readController.signal);if(current.user_id!==context.user_id||JSON.stringify(current.centres)!==fingerprint){endSession();return;}verification.restore();}catch(error){if(isAuthorizationFailure(error))endSession();else if(!dead)verification.block();}}}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void verifyScope();});
 async function verifyScope(){if(dead||verifying)return;verifying=true;try{const [current,auth]=await Promise.all([reads.context(readController.signal),client.auth.getUser()]);if(auth.error){if(isAuthorizationFailure(auth.error)){endSession();return;}throw auth.error;}if(auth.data?.user?.id!==context.user_id||current.user_id!==context.user_id||JSON.stringify(current.centres)!==fingerprint){endSession();return;}verification.restore();}catch(error){if(isAuthorizationFailure(error))endSession();else if(!dead)verification.block();}finally{verifying=false;}}
 const timer=setInterval(()=>{if(dead)clearInterval(timer);else void verifyScope();},30000);
 let registerCapabilities={version:0,enabled:false};
 try{registerCapabilities=await rpc('get_attendance_register_capabilities');}catch(error){if(!(error.status===404&&error.code==='PGRST202'))throw error;}
 if(registerCapabilities.profile_pages===true){
  const pages=new Map();let selection='';
  globalThis.__massProfilePages={invalidate:()=>{pages.clear();selection='';},read:(state,selected)=>{
   if(globalThis.__massActualRole==='Leadership'||selected.some(c=>!context.centres.find(row=>row.id===c.id)?.can_write))return null;
   const base=JSON.stringify([dataEpoch,globalThis.__massActualRole,selected.map(c=>c.id).sort(),reportingOn({...state,today:liveToday()}),state.query,state.profileSort,state.grade,state.shift,state.gender]);
   if(base!==selection){selection=base;state.profilePage=0;}
   const page=Number.isInteger(state.profilePage)&&state.profilePage>=0?state.profilePage:0,key=base+'|'+page;
   if(!pages.has(key)){
    pages.set(key,{pending:true});const epoch=dataEpoch;
    const request=selected.length?rpc('student_profile_page',{p_centres:selected.map(c=>c.id),p_on:reportingOn({...state,today:liveToday()}),p_query:state.query||'',p_sort:state.profileSort||'name',p_grade:state.grade||null,p_shift:state.shift||null,p_gender:state.gender||null,p_offset:page*10,p_limit:10}):Promise.resolve({ids:[],total:0});
    void request.then(value=>{if(!dead&&epoch===dataEpoch){pages.set(key,value);globalThis.__massOriginalRefresh?.();}}).catch(error=>{if(!dead&&epoch===dataEpoch){pages.set(key,{error:error.message});globalThis.__massOriginalRefresh?.();}});
   }
   return pages.get(key);
  }};
 }
 const registerRpc=async(name,args,writing=false)=>{let result;try{result=await client.schema('mass_api').rpc(name,args).retry(false).abortSignal(readController.signal);}catch{throw new BackendError({message:'network'},0,writing,name);}if(result.error)throw new BackendError(result.error,result.status,writing,name);return result.data;};
 globalThis.__massAttendance=createAttendanceRegister({getRole:()=>globalThis.__massActualRole,rpc:registerRpc,context,capabilities:registerCapabilities,refresh,rerender:()=>{if(!dead)globalThis.__massOriginalRefresh?.();}});
 await import('../app.js');
 }catch(error){clear();root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>Programme data could not be loaded</h1><p role="alert"></p><button type="button" id="retry-verified-load">Retry verified load</button></section></main>';root.querySelector('[role=alert]').textContent=[error.message,safeDiagnosticText(error)].filter(Boolean).join(' · ');root.querySelector('#retry-verified-load').addEventListener('click',()=>window.location.reload());}
}
