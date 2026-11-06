class AuthFlowError extends Error {}

// Auth never assigns programme roles. Every successful sign-in still passes the
// server's current identity/scope checks before the original UI can load.
export async function signInVerified(client,email,password,clearSession=()=>{}) {
 const result=await client.auth.signInWithPassword({email:email.trim(),password});
 if(result.error)throw new AuthFlowError('Unable to sign in. Check your credentials and account access.');
 const verified=await client.auth.getUser();
 if(verified.error||!verified.data?.user||verified.data.user.id!==result.data?.session?.user?.id){
  try{await client.auth.signOut({scope:'local'});}finally{clearSession();}
  throw new AuthFlowError('Your session could not be verified. Sign in again.');
 }
 return verified.data.user.id;
}

export function recoveryRedirect(origin) {
 const url=new URL(origin);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new AuthFlowError('Password recovery requires a secure application origin.');
 return new URL('/?auth=recovery',url.origin).href;
}

export function scrubImplicitFragment(location=window.location,history=window.history) {
 const url=new URL(location.href);
 if(!/(?:access_token|refresh_token|token_hash)=/.test(url.hash))return false;
 url.hash='';history.replaceState(history.state,'',url.pathname+url.search);
 return true;
}

export async function verifyRecovery(client,code) {
 const result=await client.auth.exchangeCodeForSession(code);
 if(result.error||result.data?.redirectType!=='recovery'||!result.data.session?.user?.id)throw new AuthFlowError('This recovery link is invalid or expired. Request a new link in the same browser.');
 const verified=await client.auth.getUser();
 if(verified.error||verified.data?.user?.id!==result.data.session.user.id)throw new AuthFlowError('The recovery session could not be verified. Request a new link.');
 return verified.data.user.id;
}

export async function updateRecoveredPassword(client,subject,password,confirmation) {
 if(!password||password!==confirmation)throw new AuthFlowError('Enter matching passwords.');
 const verified=await client.auth.getUser();
 if(verified.error||!subject||verified.data?.user?.id!==subject)throw new AuthFlowError('The recovery session changed or expired. Request a new link.');
 // Strength/length requirements are enforced by the configured Auth provider;
 // this UI does not invent a different MASS password policy.
 const result=await client.auth.updateUser({password});
 if(result.error)throw new AuthFlowError('The password could not be updated. Check the configured password requirements or request a new link.');
}

export function showSignIn(client,{root=document.querySelector('#app'),message='',clearSession=()=>{}}={}) {
 root.innerHTML='<main class="auth-page"><section class="card auth-card"><img src="mass-logo.jpg" alt="MASS" width="100"><h1>MASS CAC Dashboard</h1><p>Sign in to your authorized programme workspace.</p><form id="sign-in"><label class="field">Email<input name="email" type="email" autocomplete="username" required></label><label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label><p role="alert" aria-live="polite"></p><button class="btn primary" type="submit">Sign in</button><button class="text-button" type="button" data-forgot-password>Forgot password?</button></form><p>Access is limited to verified staff assignments. Contact the administrator if you need an account or centre access.</p></section></main>';
 const form=root.querySelector('form'),alert=form.querySelector('[role=alert]');alert.textContent=message;
 const setBusy=busy=>form.querySelectorAll('button').forEach(button=>button.disabled=busy);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(form.dataset.saving)return;form.dataset.saving='true';setBusy(true);alert.textContent='';
  const values=new FormData(form);
  try{await signInVerified(client,String(values.get('email')),String(values.get('password')),clearSession);form.reset();window.location.reload();}
  catch{alert.textContent='Unable to sign in or verify your session. Check your credentials and account access.';}
  finally{form.querySelector('[name=password]').value='';delete form.dataset.saving;setBusy(false);}
 });
 form.querySelector('[data-forgot-password]').addEventListener('click',async()=>{
  const email=form.querySelector('[name=email]');if(!email.reportValidity()||form.dataset.saving)return;
  form.dataset.saving='true';setBusy(true);form.querySelector('[name=password]').value='';alert.textContent='';
  try{
   const result=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:recoveryRedirect(window.location.origin)});
   if(result.error)throw Error();
   alert.textContent='If this address is eligible, a recovery email will arrive. Open it in this browser. If it does not arrive, contact the administrator.';
  }catch{alert.textContent='Recovery email could not be requested. Try again later or contact the administrator. No account access was changed.';}
  finally{delete form.dataset.saving;setBusy(false);}
 });
}

export async function handleRecoveryEntry(client,{root=document.querySelector('#app'),location=window.location,history=window.history,clearSession=()=>{},storage=window.sessionStorage}={}) {
 const url=new URL(location.href),requested=url.searchParams.get('auth')==='recovery';
 const code=url.searchParams.getAll('code'),hasError=url.searchParams.has('error')||url.searchParams.has('error_code');
 const hasCallback=url.searchParams.has('error_description')||['token_hash','access_token','refresh_token'].some(key=>url.searchParams.has(key));
 const implicitToken=/(?:access_token|refresh_token|token_hash)=/.test(url.hash);
 const pendingKey='mass-recovery-pending';
 const pending=storage.getItem(pendingKey)==='1';
 const signOut=async()=>{try{await client.auth.signOut({scope:'local'});}catch{}finally{storage.removeItem(pendingKey);clearSession();}};
 if(!requested&&!code.length&&!hasError&&!hasCallback&&!implicitToken){
  if(!pending)return false;
  // The one-use code was scrubbed on entry. A refresh cannot turn a pending
  // password-reset session into normal programme access or a new reset proof.
  await signOut();showSignIn(client,{root,message:'Password recovery was interrupted. Request a new link in this browser.',clearSession});return true;
 }
 // Scrub one-use codes/errors BEFORE any programme imports, render or RPC.
 for(const key of ['auth','code','error','error_code','error_description','token_hash','access_token','refresh_token'])url.searchParams.delete(key);
 if(implicitToken)url.hash='';
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
 root.innerHTML='<main class="auth-page"><section class="card auth-card"><h1>Verifying recovery link</h1><p role="status">No programme records have been loaded.</p></section></main>';
 let subject;
 try{
  if(!requested||code.length!==1||!code[0]||hasError||hasCallback||implicitToken)throw Error();
  storage.setItem(pendingKey,'1');
  subject=await verifyRecovery(client,code[0]);
 }catch{await signOut();showSignIn(client,{root,message:'This recovery link is invalid, expired or unavailable. Request a new link in the same browser.',clearSession});return true;}
 root.innerHTML='<main class="auth-page"><section class="card auth-card"><img src="mass-logo.jpg" alt="MASS" width="100"><h1>Reset your password</h1><form id="reset-password"><label class="field">New password<input name="password" type="password" autocomplete="new-password" required></label><label class="field">Confirm new password<input name="confirmation" type="password" autocomplete="new-password" required></label><p role="alert" aria-live="polite"></p><button class="btn primary" type="submit">Update password</button><button class="text-button" type="button" data-return-signin>Return to sign in</button></form></section></main>';
 const form=root.querySelector('form');
 form.querySelector('[data-return-signin]').addEventListener('click',async()=>{if(form.dataset.saving)return;await signOut();showSignIn(client,{root,clearSession});});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(form.dataset.saving)return;form.dataset.saving='true';form.querySelectorAll('button').forEach(b=>b.disabled=true);
  const values=new FormData(form);
  try{await updateRecoveredPassword(client,subject,String(values.get('password')),String(values.get('confirmation')));form.reset();await signOut();showSignIn(client,{root,message:'Password updated. Sign in again to verify your programme access.',clearSession});}
  catch(error){form.querySelector('[role=alert]').textContent=error instanceof AuthFlowError?error.message:'Unable to complete password recovery. Request a new link or contact the administrator.';form.reset();}
  finally{delete form.dataset.saving;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
 });
 return true;
}
