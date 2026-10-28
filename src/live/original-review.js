import {createBackendClient} from './client.js';
import {createReadApi} from './reads.js';
import {createDirectoryApi} from './directory.js';
import {centres} from '../data.js';

// This adapter replaces the original prototype's synthetic data with authorized
// read-only observations. It never writes to Supabase or browser local storage.
export async function startOriginalReview(config) {
  const client=createBackendClient(config);
  const {data:sessionResult}=await client.auth.getSession();
  if (!sessionResult?.session) return (await import('./workspace.js')).startLiveApp(config);
  const {data:identity,error:identityError}=await client.auth.getUser();
  if(identityError||!identity?.user) return (await import('./workspace.js')).startLiveApp(config);
  const root=document.querySelector('#app');
  root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>Loading authorized MASS records</h1><p id="mass-load-status" role="status">Preparing centre directory…</p></section></main>';
  try {
    const reads=createReadApi(client),directory=createDirectoryApi(client);
    const [context,dir,refs]=await Promise.all([reads.context(),directory.centres(),reads.references()]);
    if(context?.user_id!==identity.user.id||!Array.isArray(context.centres))throw Error('Unable to verify the authorized centre scope.');
    const allowed=new Set(context.centres.map(c=>c.id));
    if(!allowed.size)throw Error('No authorized CAC centre assignments found.');
    const dictionary=new Map(dir.filter(r=>allowed.has(r.centre_id)).map(r=>[r.centre_id,r]));
    centres.splice(0,centres.length,...context.centres.map(c=>{
      const d=dictionary.get(c.id);
      return {id:c.id,name:c.label,officer:'',donor:d?.donor_label||''};
    }));
    const db={version:1,students:[],attendance:{},scores:{},participation:{},events:[],visits:[],
      morarji:{},guidance:[],sessions:[],morarjiHistory:[],assessmentDetails:{},
      assessmentBatches:{},followups:{},lastSaved:null};
    const seenStudents=new Set(),seenEvents=new Set(),seenSessions=new Set();
    const observedDates={};
    const from='2026-07-01',until='2026-11-01';
    // All results are read through the existing centre-scoped and RLS-protected RPCs.
    // Limit concurrency to avoid overwhelming the database.
    const ids=context.centres.map(c=>c.id);
    let index=0,completed=0;
    async function worker(){
      while(index<ids.length){
        const id=ids[index++];
        const rows=await reads.centre({centre:id,from,until,yearFrom:from,yearUntil:until});
        for(const s of rows.students){
          if(seenStudents.has(s.child_id))continue;
          seenStudents.add(s.child_id);
          db.students.push({id:s.child_id,studentId:s.student_id||'',name:s.full_name||s.student_id||'',
            centre:id,shift:s.shift_code,grade:s.grade_label,gender:s.gender_code||'',
            enrolled:s.starts_on,active:!s.ends_before||s.ends_before>'2026-10-29',exitDate:s.ends_before||'',note:''});
          db.scores[s.child_id]={F1:null,F2:null,F3:null,F4:null};
        }
        for(const a of rows.attendance){
          db.attendance[a.child_id+'|'+a.attendance_date]=a.code;
          (observedDates[a.attendance_date.slice(0,7)]??=new Set()).add(a.attendance_date);
        }
        for(const e of rows.activities)if(!seenEvents.has(e.id)){
          seenEvents.add(e.id);
          db.events.push({id:e.id,centre:id,date:e.activity_date,category:'',name:e.name,status:''});
        }
        for(const p of rows.participation)db.participation[p.child_id+'|'+p.event_id]=p.participated===null?'Unknown':p.participated?'Attended':'Not attended';
        for(const c of rows.calendar){
          const key=id+'|'+c.session_date+'|'+c.shift_code;
          if(seenSessions.has(key))continue;
          seenSessions.add(key);
          db.sessions.push({centre:id,date:c.session_date,shift:c.shift_code,status:c.is_scheduled?'Held':'Cancelled'});
        }
        completed++;
        const status=document.querySelector('#mass-load-status');
        if(status)status.textContent='Loading verified centres: '+completed+' / '+ids.length;
      }
    }
    await Promise.all(Array.from({length:6},worker));
    globalThis.__massReviewObservedDates=Object.fromEntries(Object.entries(observedDates).map(([k,v])=>[k,[...v].sort()]));
    globalThis.__massReviewToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    globalThis.__massLiveReviewData=db;
    await import('../app.js');
  }catch(error){
    root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>Review data could not be loaded</h1><p role="alert"></p><a href="?view=workspace">Open secure operational workspace</a></section></main>';
    root.querySelector('[role=alert]').textContent=error.message;
  }
}
