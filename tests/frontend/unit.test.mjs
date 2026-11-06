import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateConfig} from '../../src/live/config.js';
import {createApi, BackendError} from '../../src/live/api.js';
import {createSessionController} from '../../src/live/session.js';

const ID='10000000-0000-4000-8000-000000000001';
const config={mode:'live',url:'https://pbkwpfdpdtelmvbkzgvx.supabase.co',publishableKey:`sb_publishable_${'x'.repeat(32)}`};
function fakeClient(result={data:[],status:200,error:null}) {
  const calls=[];
  const builder={then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
  for(const method of ['order','eq','range','abortSignal','retry'])builder[method]=(...args)=>{calls.push([method,...args]);return builder;};
  return {calls,schema(name){calls.push(['schema',name]);return {rpc(name,args){calls.push(['rpc',name,args]);return builder;}};}};
}
test('configuration pins the approved project and only accepts publishable keys',()=>{
  assert.equal(validateConfig(config).project,'pbkwpfdpdtelmvbkzgvx');
  for(const key of ['sb_secret_not-allowed','service_role','eyJhbGci.invalid.signature',''])assert.throws(()=>validateConfig({...config,publishableKey:key}));
  for(const url of ['https://other.supabase.co','http://pbkwpfdpdtelmvbkzgvx.supabase.co','https://pbkwpfdpdtelmvbkzgvx.supabase.co.evil.test'])assert.throws(()=>validateConfig({...config,url}));
  assert.deepEqual(validateConfig({mode:'demo'}),{mode:'demo'});
});
test('roster filters and bounded stable pagination stay inside mass_api',async()=>{
  const client=fakeClient({data:Array.from({length:51},(_,i)=>({enrolment_id:String(i)})),status:200});
  const result=await createApi(client).listStudents({centre:ID,on:'2026-04-01',grade:'5',shift:'Morning',page:2});
  assert.equal(result.rows.length,50);assert.equal(result.hasMore,true);
  assert.deepEqual(client.calls,[['schema','mass_api'],['rpc','list_students',{p_centre:ID,p_on:'2026-04-01'}],['order','enrolment_id',{ascending:true}],['eq','shift_code','Morning'],['eq','grade_label','5'],['range',100,150]]);
});
test('invalid dates, identifiers, controlled values and revisions never reach RPC',async()=>{
  const client=fakeClient(),api=createApi(client);
  for(const on of ['2026-02-30','2026-13-01','not-a-date'])await assert.rejects(api.listStudents({centre:ID,on}));
  assert.throws(()=>api.recordAttendance({enrolment:ID,on:'2026-04-01',code:'H',expected:0}));
  assert.throws(()=>api.recordAttendance({enrolment:ID,on:'2026-04-01',code:'P',expected:undefined}));
  assert.throws(()=>api.registerStudent({centre:'C01',grade:'5',shift:'Morning',start:'2026-04-01',name:'Synthetic',gender:'Girl'}));
  assert.throws(()=>api.recordAssessment({enrolment:ID,definition:ID,on:'2026-04-01',score:26,expected:0}));
  assert.throws(()=>api.recordParticipation({enrolment:ID,event:ID,participated:'yes',expected:0}));
  assert.equal(client.calls.filter(c=>c[0]==='rpc').length,0);
});
test('all eleven adapter operations match actual versioned RPC argument names',async()=>{
  const client=fakeClient({data:[{}],status:200}),api=createApi(client);
  await api.listStudents({centre:ID,on:'2026-04-01'});
  await api.attendanceSummary({centre:ID,from:'2026-04-01',until:'2026-05-01'});
  await api.registerStudent({centre:ID,grade:'5',shift:'Morning',start:'2026-04-01',name:'Synthetic record',gender:'Girl'});
  await api.addEnrolment({child:ID,centre:ID,grade:'5',shift:'Morning',start:'2026-04-01',status:'Active'});
  await api.closeEnrolment({id:ID,expected:1,endsBefore:'2026-05-01',status:'Left programme'});
  await api.createActivity({id:ID,centre:ID,shift:'Morning',on:'2026-04-01',name:'Synthetic activity'});
  await api.recordAttendance({enrolment:ID,on:'2026-04-01',code:'L',expected:0});
  await api.recordAssessment({enrolment:ID,definition:ID,on:'2026-04-01',score:0,expected:0});
  await api.recordParticipation({enrolment:ID,event:ID,participated:null,expected:0});
  await api.addMorarjiMember({enrolment:ID,cohort:ID});
  await api.recordMorarji({member:ID,applied:null,attended:false,passed:null,school:null,expected:0});
  const sql=await readFile(new URL('../../supabase/migrations/202610270015_core_api.sql',import.meta.url),'utf8');
  const signatures=new Map([...sql.matchAll(/CREATE FUNCTION mass_api\.(\w+)\(([^)]*)\)/g)].map(m=>[m[1],m[2].split(',').map(a=>a.trim().split(/\s+/)[0])]));
  const calls=client.calls.filter(c=>c[0]==='rpc');assert.equal(calls.length,11);
  for(const [,name,args]of calls)assert.deepEqual(Object.keys(args).sort(),signatures.get(name).sort(),name);
});
test('unknown attendance denominator stays null; no invented absence',async()=>{
  const source={present_count:0,absent_count:0,leave_count:0,excluded_count:2,percentage:null};
  const result=await createApi(fakeClient({data:[source],status:200})).attendanceSummary({centre:ID,from:'2026-04-01',until:'2026-05-01'});
  assert.equal(result.percentage,null);assert.equal(result.absent_count,0);
});
test('conflicts, authorization and uncertain writes are sanitized and never retried',async()=>{
  for(const [status,code,flag]of [[409,'PT409','conflict'],[401,'PGRST301','sessionExpired'],[0,'','uncertain'],[503,'','uncertain']]){
    const client=fakeClient({status,error:{code,message:'private rejected value',details:'private tuple'}});
    await assert.rejects(createApi(client).recordAttendance({enrolment:ID,on:'2026-04-01',code:'P',expected:0}),e=>{
      assert(e instanceof BackendError);assert.equal(e[flag],true);assert(!JSON.stringify(e).includes('private'));assert(!e.message.includes('private'));return true;
    });
    assert.equal(client.calls.filter(c=>c[0]==='rpc').length,1);
    assert.deepEqual(client.calls.find(c=>c[0]==='retry'),['retry',false]);
  }
});
test('restored identity is verified with getUser and browser role metadata is discarded',async()=>{
  const states=[];let verifies=0,clears=0;
  const session={user:{id:ID,user_metadata:{role:'Leadership'}}};
  const client={auth:{onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},async getSession(){return{data:{session}};},async getUser(){++verifies;return{data:{user:session.user}};}}};
  const controller=createSessionController(client,{onState:s=>states.push(s),onReset:()=>++clears});
  await controller.start();assert.equal(verifies,1);assert.deepEqual(states.at(-1),{status:'signed-in',user:{id:ID}});assert.equal(clears,1);
  controller.stop();
});
test('unverified stored session and network-failed sign-out clear private state/storage',async()=>{
  const states=[];let clears=0,purges=0;
  const client={auth:{onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},async getSession(){return{data:{session:{user:{id:ID}}}};},async getUser(){return{error:{message:'invalid'}};},async signOut(){return{error:{message:'network'}};}}};
  const controller=createSessionController(client,{onState:s=>states.push(s),onReset:()=>++clears,clearStoredSession:()=>++purges});
  await controller.start();assert.equal(states.at(-1).status,'signed-out');assert.equal(purges,1);
  await controller.signOut();assert.equal(states.at(-1).status,'signed-out');assert.equal(purges,2);assert(clears>=2);
});
test('late Auth identity response cannot restore an account after sign-out',async()=>{
  let resolveUser;const states=[];
  const client={auth:{onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},async getSession(){return{data:{session:{user:{id:ID}}}};},getUser(){return new Promise(resolve=>{resolveUser=resolve;});},async signOut(){return{};}}};
  const controller=createSessionController(client,{onState:s=>states.push(s),onReset(){}});
  const starting=controller.start();await new Promise(resolve=>setImmediate(resolve));await controller.signOut();
  resolveUser({data:{user:{id:ID}}});await starting;assert.equal(states.at(-1).status,'signed-out');
});
test('sign-out blocks a new login until SDK cleanup and local credential purge complete',async()=>{
  let finish;const states=[];let purges=0;
  const client={auth:{signOut(){return new Promise(resolve=>{finish=resolve;});}}};
  const controller=createSessionController(client,{onState:s=>states.push(s),onReset(){},clearStoredSession(){++purges;}});
  const pending=controller.signOut();assert.equal(states.at(-1).status,'checking');
  finish({error:{message:'network'}});await pending;
  assert.equal(states.at(-1).status,'signed-out');assert.equal(purges,1);
});
