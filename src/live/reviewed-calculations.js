import {programmePopulation,reportingOn} from './population.js';
import {monthWindow,attendanceTotals} from './model.js';

export const reviewedDecisionStatus=Object.freeze({1:'Approved',2:'Approved with changes',3:'Approved',4:'Approved with changes',5:'Approved',6:'Approved with changes',7:'Approved with changes',8:'Approved',9:'Approved',10:'Needs source',11:'Approved',12:'Approved',13:'Approved',14:'Approved through comments',15:'Approved through comments',16:'Confirmed existing cohort-count contract',18:'Needs source',19:'Needs source',20:'Approved through comments',21:'Approved through comments',22:'Approved through comments',23:'Approved',24:'Approved',25:'Approved; colour boundaries pending'});
const child=s=>s.childId||s.id;
const enrolment=s=>s.enrolmentId||s.id;
const sum=(xs,key)=>xs.reduce((n,x)=>n+Number(x[key]||0),0);
const unique=xs=>[...new Set(xs)];
function selectedCentres(centres,state){return centres.filter(c=>(!state.centre||state.centre===c.id)&&(!state.donor||state.donor===c.donor)&&(!state.officer||(c.officers||[c.officer]).includes(state.officer)));}
function participation(pop,events,records){
 const byEpisode=new Map(pop.map(s=>[enrolment(s),s])),byEvent=new Map(events.map(e=>[e.id,e]));
 const observed=records.filter(r=>{const s=byEpisode.get(r.enrolment_id),e=byEvent.get(r.event_id);return s&&e&&s.centre===e.centre&&(!e.shift||e.shift==='Both shifts'||s.shift===e.shift)&&s.enrolled<=e.date&&(!s.exitDate||e.date<s.exitDate)&&typeof r.participated==='boolean';});
 const participants=new Set(),respondents=new Set(),categories={};
 for(const r of observed){const s=byEpisode.get(r.enrolment_id),id=child(s);respondents.add(id);if(!r.participated)continue;participants.add(id);const key=byEvent.get(r.event_id).category||'Uncategorised';(categories[key]??=new Set()).add(id);}
 const eligible=unique(pop.map(child)).length,available=events.length>0&&observed.length>0;
 return {eligible,available,participants:available?participants.size:null,rate:available&&eligible?100*participants.size/eligible:null,respondents:respondents.size,withoutResponse:Math.max(0,eligible-respondents.size),categories:available?Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,v.size])):{},heldEvents:events.length};
}
function gradeCounts(rows){
 const assignments=new Map();for(const s of rows)(assignments.get(child(s))||assignments.set(child(s),new Set()).get(child(s))).add(s.grade||'Unknown');
 const counts={};let ambiguous=0;for(const grades of assignments.values()){if(grades.size!==1){ambiguous++;continue;}const grade=[...grades][0];counts[grade]=(counts[grade]||0)+1;}
 return {counts,ambiguous};
}
function completeAttendanceBands(pop,db,state){
 const {from,until}=monthWindow(state.month),on=reportingOn(state),calendar=new Map((db.calendar||[]).map(r=>[r.centre+'|'+r.shift+'|'+r.date,r.status]));
 const counts={below15:0,exactly15:0,days16to20:0,days21to25:0,above25:0};let classified=0;
 for(const s of pop){let complete=true,present=0,scheduled=0;const start=s.enrolled>from?s.enrolled:from,end=[until,s.exitDate||until,new Date(new Date(on+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10)].sort()[0];
  for(let d=start;d<end;d=new Date(new Date(d+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10)){
   const status=calendar.get(s.centre+'|'+s.shift+'|'+d),mark=db.attendance?.[s.id+'|'+d];
   if(status==='Not Scheduled'||['WO','MM'].includes(mark))continue;
   if(status!=='Planned'){complete=false;continue;}scheduled++;
   if(!['P','A','L'].includes(mark)){complete=false;continue;}if(mark==='P')present++;
  }
  if(!complete||!scheduled)continue;classified++;counts[present<15?'below15':present===15?'exactly15':present<=20?'days16to20':present<=25?'days21to25':'above25']++;
 }
 return {counts,classified,unclassified:pop.length-classified,available:classified>0};
}
export function reviewedCalculations(db,centres,state,{profileReadable=true,assessmentReady=true,detailsReady=true}={}){
 if(!profileReadable&&state.gender)return {unavailable:'A scoped gender-filtered aggregate API is required; masked genders cannot be inferred.'};
 const selected=selectedCentres(centres,state),ids=new Set(selected.map(c=>c.id)),pop=programmePopulation(db.students,centres,state),popIds=new Set(pop.map(enrolment)),popChildren=new Set(pop.map(child)),{from,until}=monthWindow(state.month);
 const inMonth=d=>d>=from&&d<until;
 const calendar=(db.calendar||[]).map(r=>({centre_id:r.centre,shift_code:r.shift,session_date:r.date,is_scheduled:r.status!=='Not Scheduled'}));
 const rowsByEnrolment=new Map(db.students.map(s=>[enrolment(s),s]));
 const marks=Object.values(db.attendanceRecords||{}).filter(r=>popIds.has(r.enrolment_id)&&inMonth(r.attendance_date)).map(r=>({...r,centre_id:rowsByEnrolment.get(r.enrolment_id)?.centre}));
 const events=(db.events||[]).filter(e=>ids.has(e.centre)&&inMonth(e.date)&&e.status==='Held'&&(!state.shift||e.shift===state.shift||e.shift==='Both shifts'));
 const participationRows=Object.values(db.participationRecords||{}),activity=participation(pop,events,participationRows);
 const scoreRows=[];
 for(const [key,r] of Object.entries(db.assessmentDetails||{})){
  const [episode,round]=key.split('|'),s=rowsByEnrolment.get(r.enrolment_id||episode),q=Number(round?.slice(1));
  if(!s||!ids.has(s.centre)||!popChildren.has(child(s))||r.academicYear!==(state.academicYear||db.academicYear)||Number(r.maxMarks)!==25||!q||r.score===null||r.score===undefined)continue;
  const score=Number(r.score);if(!Number.isFinite(score)||score<0||score>25||state.grade&&s.grade!==state.grade||state.shift&&s.shift!==state.shift)continue;
  scoreRows.push({child:child(s),episode:enrolment(s),centre:s.centre,quarter:q,score,definition:r.definition_id||round});
 }
 function quarterSummary(rows,q){const entries=rows.filter(r=>r.quarter===q),byChild=new Map();for(const r of entries)(byChild.get(r.child)||byChild.set(r.child,[]).get(r.child)).push(r);
  const ambiguous=[...byChild.values()].filter(v=>v.length!==1).length,valid=[...byChild.values()].filter(v=>v.length===1).map(v=>v[0]),n=valid.length;
  return {quarter:q,n,mean:n?sum(valid,'score')/n:null,low:valid.filter(r=>Number.isInteger(r.score)&&r.score<=8).length,developing:valid.filter(r=>Number.isInteger(r.score)&&r.score>=9&&r.score<=15).length,good:valid.filter(r=>Number.isInteger(r.score)&&r.score>=16&&r.score<=20).length,strong:valid.filter(r=>Number.isInteger(r.score)&&r.score>=21&&r.score<=25).length,precision_review:valid.filter(r=>!Number.isInteger(r.score)).length,ambiguous,above20:valid.filter(r=>r.score>20).length};
 }
 const activeScores=scoreRows.filter(r=>popIds.has(r.episode)),configured=unique(Object.keys(db.assessmentDetails||{}).map(k=>Number(k.split('|')[1]?.slice(1))).filter(Boolean));
 const periods=db.references?.assessment_periods||[],defs=db.references?.assessment_definitions||[];
 for(const d of defs){const p=periods.find(p=>p.id===d.period_id);if(p?.academic_year_id===(state.academicYear||db.academicYear)&&Number(d.max_score)===25&&!configured.includes(p.quarter))configured.push(p.quarter);}
 const quarters=assessmentReady?configured.sort().map(q=>quarterSummary(activeScores,q)):[];
 const earlier=Number((state.fromExam||'F1').slice(1)),later=Number((state.toExam||'F2').slice(1)),byChild=new Map();
 for(const r of scoreRows)(byChild.get(r.child)||byChild.set(r.child,[]).get(r.child)).push(r);
 const pairs=[];let ambiguousPairs=0;for(const entries of byChild.values()){const a=entries.filter(r=>r.quarter===earlier),b=entries.filter(r=>r.quarter===later);if(a.length>1||b.length>1){ambiguousPairs++;continue;}if(a.length===1&&b.length===1&&earlier!==later)pairs.push({earlier:a[0].score,later:b[0].score,delta:b[0].score-a[0].score});}
 const changes=assessmentReady?{n:pairs.length,meanChange:pairs.length?sum(pairs,'delta')/pairs.length:null,earlierMean:pairs.length?sum(pairs,'earlier')/pairs.length:null,laterMean:pairs.length?sum(pairs,'later')/pairs.length:null,improved:pairs.filter(p=>p.delta>0).length,unchanged:pairs.filter(p=>p.delta===0).length,declined:pairs.filter(p=>p.delta<0).length,ambiguous:ambiguousPairs}:null;
 const grade=gradeCounts(programmePopulation(db.students,centres,{...state,grade:''}).filter(s=>popChildren.has(child(s))));if(state.grade)grade.counts=Object.fromEntries(Object.entries(grade.counts).filter(([g])=>g===state.grade));
 const genders={};if(profileReadable)for(const id of popChildren){const values=unique(pop.filter(s=>child(s)===id).map(s=>s.gender||'Unknown'));if(values.length===1)genders[values[0]]=(genders[values[0]]||0)+1;}
 const perCentre=selected.map(c=>{const rows=pop.filter(s=>s.centre===c.id);return {id:c.id,enrolments:rows.length,children:unique(rows.map(child)).length,attendance:attendanceTotals(marks.filter(r=>r.centre_id===c.id),calendar),activity:participation(rows,events.filter(e=>e.centre===c.id),participationRows),quarters:assessmentReady?configured.map(q=>quarterSummary(activeScores.filter(r=>r.centre===c.id),q)):[]};});
 const sessions=(db.sessions||[]).filter(r=>ids.has(r.centre)&&inMonth(r.date)&&(!state.shift||r.shift===state.shift));
 const delivery={available:detailsReady&&sessions.length>0,held:sessions.filter(r=>r.status==='Held').length,planned:sessions.filter(r=>r.status==='Planned').length,cancelled:sessions.filter(r=>r.status==='Cancelled').length};
 const cohorts=new Map(),yearSets=new Map();for(const r of db.morarjiHistory||[]){const s=r.s;if(!s||s.grade!=='5'||!ids.has(s.centre)||state.shift&&s.shift!==state.shift||state.gender&&(s.gender||'Unknown')!==state.gender||state.grade&&s.grade!==state.grade)continue;const key=r.cohort_id||r.cohort;if(!key)continue;const c=cohorts.get(key)||{cohort:r.cohort,cohortId:r.cohort_id||key,academicYear:r.cohortAcademicYear||null,members:new Set(),passed:new Set(),knownPassed:new Set(),knownApplied:new Set(),knownAttended:new Set(),applied:new Set(),attended:new Set()};const id=child(s);c.members.add(id);if(r.passed===true)c.passed.add(id);if(typeof r.passed==='boolean')c.knownPassed.add(id);if(typeof r.applied==='boolean')c.knownApplied.add(id);if(typeof r.attended==='boolean')c.knownAttended.add(id);if(r.applied===true)c.applied.add(id);if(r.attended===true)c.attended.add(id);cohorts.set(key,c);if(c.academicYear){const y=yearSets.get(c.academicYear)||{academicYear:c.academicYear,members:new Set(),passed:new Set(),knownPassed:new Set()};y.members.add(id);if(r.passed===true)y.passed.add(id);if(typeof r.passed==='boolean')y.knownPassed.add(id);yearSets.set(c.academicYear,y);}}
 return {enrolments:pop.length,children:popChildren.size,grades:grade.counts,ambiguousGrades:grade.ambiguous,genders:profileReadable?genders:null,attendance:attendanceTotals(marks,calendar),activity,quarters,changes,centres:perCentre,delivery,bands:completeAttendanceBands(pop,db,state),morarjiYears:[...yearSets.values()].map(c=>({academicYear:c.academicYear,members:c.members.size,passed:c.knownPassed.size?c.passed.size:null,knownPassed:c.knownPassed.size})),morarji:[...cohorts.values()].map(c=>({cohort:c.cohort,cohortId:c.cohortId,academicYear:c.academicYear,members:c.members.size,passed:c.knownPassed.size?c.passed.size:null,knownPassed:c.knownPassed.size,applied:c.knownApplied.size?c.applied.size:null,attended:c.knownAttended.size?c.attended.size:null})),coverage:'Recorded observations only; missing is unknown. Calendar/category/source completeness is not inferred.'};
}
