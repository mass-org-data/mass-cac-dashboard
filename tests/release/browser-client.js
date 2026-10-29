// TEST ONLY: local signed fixture identities; not managed Supabase Auth evidence.
import {createClient} from '@supabase/supabase-js';
export function createBackendClient(){
 const remembered=!globalThis.__fixtureUser?JSON.parse(sessionStorage.getItem('fixture-session')||'null'):null;
 const selected=remembered||{access_token:globalThis.__fixtureToken,user:globalThis.__fixtureUser?{id:globalThis.__fixtureUser}:null};
 const c=createClient(location.origin, 'local-synthetic-key', {db:{schema:'mass_api'},auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+selected.access_token}}});
 let session=selected.user?selected:null;
 c.auth.getSession=async()=>({data:{session}});c.auth.getUser=async()=>({data:{user:session?.user||null}});c.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});
 c.auth.signInWithPassword=async({password})=>{if(password!=='synthetic-fixture-only')return {data:{session:null},error:{message:'Synthetic invalid credentials'}};session={access_token:globalThis.__fixtureLoginToken,user:{id:globalThis.__fixtureLoginUser}};sessionStorage.setItem('fixture-session',JSON.stringify(session));return {data:{session},error:null};};
 c.auth.signOut=async()=>{session=null;sessionStorage.removeItem('fixture-session');return {error:null};};return c;
}
export function clearStoredSession(){}
