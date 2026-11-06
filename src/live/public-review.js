import {liveToday} from './model.js';

export const PUBLIC_DATA_NOTICE = 'Access approval pending. Public live reporting needs MASS publication approval. No personal records or demo values are loaded.';

// The existing authenticated RPCs are NOT a public reporting API. Opening the
// original dashboard must not widen those ACLs or download records to hide later.
export function emptyPublicProgramme() {
 return {version:1,academicYear:'',aggregates:{},students:[],attendance:{},attendanceRecords:{},scores:{},assessmentDetails:{},participation:{},participationRecords:{},events:[],visits:[],visitSummary:{},visitOfficerSummary:{},visitAvailable:false,visitError:PUBLIC_DATA_NOTICE,morarji:{},guidance:[],sessions:[],morarjiHistory:[],assessmentBatches:{},followups:{},lastSaved:null};
}

export function showStaffAuthorization(client, message='') {
 const overlay=document.querySelector('#overlay');
 overlay.innerHTML='<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="staff-auth-title"><header><h2 id="staff-auth-title">Authorize programme changes</h2></header><p>Use an existing administrator-verified Supabase account. Permissions remain limited to its approved centres. This does not provision an account or grant access.</p><form id="sign-in"><label class="field">Email<input name="email" type="email" autocomplete="username" required></label><label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label><p role="alert"></p><button class="btn primary" type="submit">Authorize</button><button class="btn" type="button" data-auth-cancel>Cancel</button></form></section></div>';
 const form=overlay.querySelector('form');form.querySelector('[role=alert]').textContent=message;
 const cancel=()=>overlay.replaceChildren();
 overlay.querySelector('[data-auth-cancel]').addEventListener('click',cancel);
 form.querySelector('input').focus();
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(form.dataset.saving)return;
  form.dataset.saving='true';const button=form.querySelector('[type=submit]');button.disabled=true;
  const values=new FormData(form);
  try{
   const result=await client.auth.signInWithPassword({email:String(values.get('email')).trim(),password:String(values.get('password'))});
   if(result.error)throw Error('Authorization failed. Check your existing account access.');
   const identity=await client.auth.getUser();
   if(identity.error||!identity.data?.user||identity.data.user.id!==result.data?.session?.user?.id){await client.auth.signOut({scope:'local'});throw Error('The session could not be verified. No programme access was granted.');}
   form.reset();window.location.reload();
  }catch(error){form.querySelector('[role=alert]').textContent=error.message||'Authorization unavailable. No record was changed.';}
  finally{delete form.dataset.saving;button.disabled=false;form.querySelector('[name=password]').value='';}
 });
}

export async function startPublicReview(client, message='') {
 const {centres}=await import('../data.js');centres.splice(0,centres.length);
 globalThis.__massPublicReview=true;
 globalThis.__massPublicNotice=message||PUBLIC_DATA_NOTICE;
 globalThis.__massActualRole='Leadership';globalThis.__massActualRoles=[];
 globalThis.__massAggregateMode=true;globalThis.__massLiveReviewData=emptyPublicProgramme();
 globalThis.__massAcademicYears=[];globalThis.__massConfiguredQuarters=[];
 const month=liveToday().slice(0,7);globalThis.__massReportingMonths=[[month,new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'Asia/Kolkata'})]];
 globalThis.__massOriginalActions=async()=>showStaffAuthorization(client);
 // No programme RPC, anonymous sign-in, shared token, local demo seed, role
 // grant or personal-data fetch is performed by this public entry point.
 await import('../app.js');
}
