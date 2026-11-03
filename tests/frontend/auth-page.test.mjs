import test from 'node:test';
import assert from 'node:assert/strict';
import {signInVerified,recoveryRedirect,verifyRecovery,updateRecoveredPassword,scrubImplicitFragment} from '../../src/live/auth-page.js';
function fixture(){const calls=[];const user={id:'synthetic-user'};return {calls,auth:{signInWithPassword:async args=>{calls.push(['signin',args.email]);return {data:{session:{user}}};},getUser:async()=>({data:{user}}),signOut:async args=>{calls.push(['signout',args.scope]);},exchangeCodeForSession:async()=>({data:{session:{user},redirectType:'recovery'}}),updateUser:async args=>{calls.push(['update',Boolean(args.password)]);return {};}}};}
test('sign-in verifies provider identity and never grants programme roles',async()=>{
 const c=fixture();assert.equal(await signInVerified(c,' synthetic@example.invalid ','synthetic-password'),'synthetic-user');assert.deepEqual(c.calls,[['signin','synthetic@example.invalid']]);
 c.auth.getUser=async()=>({data:{user:{id:'different'}}});let cleared=false;
 await assert.rejects(signInVerified(c,'synthetic@example.invalid','synthetic-password',()=>cleared=true),/could not be verified/);
 assert(cleared);assert.deepEqual(c.calls.at(-1),['signout','local']);
});
test('password errors do not expose provider messages or account existence',async()=>{
 const c=fixture();c.auth.signInWithPassword=async()=>({error:{message:'Synthetic private provider detail'}});
 await assert.rejects(signInVerified(c,'synthetic@example.invalid','bad'),e=>!e.message.includes('private')&&e.message.includes('Unable to sign in'));
});
test('recovery redirect is pinned to a secure current origin, ignoring supplied paths',()=>{
 assert.equal(recoveryRedirect('https://preview.example.invalid/some/path?next=https://other.example.invalid'),'https://preview.example.invalid/?auth=recovery');
 assert.equal(recoveryRedirect('http://127.0.0.1:1234'),'http://127.0.0.1:1234/?auth=recovery');
 for(const url of ['http://public.example.invalid','javascript:alert(1)','file:///tmp/test'])assert.throws(()=>recoveryRedirect(url));
});
test('a URL flag or normal sign-in session cannot authorize recovery',async()=>{
 const c=fixture();assert.equal(await verifyRecovery(c,'synthetic-code'),'synthetic-user');
 c.auth.exchangeCodeForSession=async()=>({data:{session:{user:{id:'synthetic-user'}},redirectType:null}});
 await assert.rejects(verifyRecovery(c,'synthetic-code'),/invalid or expired/);
 c.auth.exchangeCodeForSession=async()=>({data:{session:{user:{id:'another-user'}},redirectType:'recovery'}});
 await assert.rejects(verifyRecovery(c,'synthetic-code'),/could not be verified/);
});
test('password change rechecks recovery identity and delegates strength policy to Auth',async()=>{
 const c=fixture();await assert.rejects(updateRecoveredPassword(c,'synthetic-user','one','two'),/matching/);
 await assert.rejects(updateRecoveredPassword(c,'another-user','synthetic-new-password','synthetic-new-password'),/changed or expired/);
 assert(!c.calls.some(x=>x[0]==='update'));
 await updateRecoveredPassword(c,'synthetic-user','synthetic-new-password','synthetic-new-password');assert.deepEqual(c.calls,[['update',true]]);
 c.auth.updateUser=async()=>({error:{message:'Synthetic private policy detail'}});
 await assert.rejects(updateRecoveredPassword(c,'synthetic-user','short','short'),e=>!e.message.includes('private')&&e.message.includes('requirements'));
});

test('same-document token fragments are scrubbed without consuming or accepting sessions',()=>{
 const states=[];const history={state:{view:'synthetic'},replaceState:(...args)=>states.push(args)};
 assert(scrubImplicitFragment({href:'https://preview.example.invalid/?view=signin#access_token=synthetic&refresh_token=synthetic'},history));
 assert.deepEqual(states[0],[{view:'synthetic'},'', '/?view=signin']);
 assert.equal(scrubImplicitFragment({href:'https://preview.example.invalid/#ordinary-anchor'},history),false);
});
