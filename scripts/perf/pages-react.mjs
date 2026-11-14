// Times how long each of the eight screens of the React interface takes to load, for each of the three test roles.
// A screen a role cannot open (it is greyed or hidden in the menu) is reported as not applicable and is never loaded.
// Never records headers, bodies, tokens or programme records. Credentials: git-ignored .env.preview-test-account.
//   node scripts/perf/pages-react.mjs --runs 3 [--label x] [--base-url https://...] [--share-url-env NAME]
// COLD: a new browser, the page address is opened first, then sign-in; the clock runs from the sign-in click until the
//   screen has settled (no loading marker, nothing in flight, stable for 600 ms). Includes sign-in and identity checks.
// WARM: one signed-in session per run, the Overview settled first, then each screen opened from the side menu; the clock
//   runs from the click until the screen has settled. Shows what moving around the application costs.
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

/* global document */
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true);};
const runs=Number(arg('runs',3)),label=String(arg('label','run')),baseArg=arg('base-url',null),shareEnv=arg('share-url-env',null),timeoutMs=Number(arg('timeout',90000));
const share=shareEnv?process.env[shareEnv]:null;
if(shareEnv&&!share)throw new Error('The share-link variable is empty.');

const env={};for(const line of (await readFile(path.join(root,'.env.preview-test-account'),'utf8')).split('\n')){const m=/^([A-Z_]+)=(.*)$/.exec(line);if(m)env[m[1]]=m[2];}
const ROLES={leadership:['PREVIEW_TEST_EMAIL','PREVIEW_TEST_PASSWORD','Leadership'],teacher:['PREVIEW_TEACHER_EMAIL','PREVIEW_TEACHER_PASSWORD','Teacher'],officer:['PREVIEW_OFFICER_EMAIL','PREVIEW_OFFICER_PASSWORD','Cluster Officer']};
const PAGES=[['overview',1,'Overview'],['attendance',2,'Attendance'],['profiles',3,'Student profiles'],['assessments',4,'Assessments'],['visits',5,'Visits'],['morarji',6,'Morarji scholarship'],['donors',7,'Annual donor summary'],['about',8,'About']];
// The same rule as the side menu (greyed out there): Leadership cannot open Student profiles (private records); only Leadership has the Annual donor summary; Teachers cannot open Visits.
const notApplicable=(role,id)=>(role==='leadership'&&id==='profiles')||(role!=='leadership'&&id==='donors')||(role==='teacher'&&id==='visits');

async function serveDist(){
  const vercel=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
  const headers=Object.fromEntries(vercel.headers[0].headers.map(h=>[h.key,h.value]));
  delete headers['Strict-Transport-Security'];headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace('; upgrade-insecure-requests','');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.json':'application/json'};
  const server=http.createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';res.writeHead(200,{...headers,'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(await readFile(path.join(root,'dist',p)));}catch{res.writeHead(404);res.end('Not found');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}
const local=baseArg?null:await serveDist();
const base=(baseArg||local.url).replace(/\/$/,'');
const browser=await chromium.launch();

// In the page: is anything on the screen still loading, and which heading is showing?
const domState=()=>{
  const main=document.querySelector('main');if(!main)return {ready:false,busy:true,h1:''};
  const busy=[...main.querySelectorAll('[aria-busy="true"]')].length>0||[...main.querySelectorAll('[role=status]')].some(el=>/loading|preparing|checking/i.test(el.textContent||''));
  const alerts=[...main.querySelectorAll('[role=alert]')].filter(el=>(el.textContent||'').trim().length>0).map(el=>(el.textContent||'').trim().slice(0,90));
  return {ready:true,busy,h1:(main.querySelector('h1')?.textContent||'').trim(),alerts};
};

// Measures from `t0` until the heading is right, nothing is loading, nothing is in flight, stable for 600 ms.
async function settle(page,tracker,number,t0){
  const quietNeeded=600;let since=null,settledAt=null;
  for(;;){
    if(Date.now()-t0>timeoutMs)return {ms:null,reason:'timeout'};
    const s=await page.evaluate(domState).catch(()=>({ready:false,busy:true,h1:''}));
    const done=s.ready&&!s.busy&&s.h1.startsWith(`${number}. `)&&tracker.inflight===0;
    if(done){if(since===null){since=Date.now();settledAt=since;}if(Date.now()-since>=quietNeeded)return {ms:settledAt-t0,reason:'settled',alerts:s.alerts,failed:tracker.failed};}
    else{since=null;settledAt=null;}
    await page.waitForTimeout(40);
  }
}
function track(page){
  const t={inflight:0,failed:0,count:0};
  page.on('request',r=>{if(r.url().includes('/rest/v1/rpc/')){t.inflight++;t.count++;}});
  page.on('requestfinished',r=>{if(r.url().includes('/rest/v1/rpc/'))t.inflight--;});
  page.on('requestfailed',r=>{if(r.url().includes('/rest/v1/rpc/')){t.inflight--;t.failed++;}});
  page.on('response',r=>{if(r.url().includes('/rest/v1/rpc/')&&r.status()>=400)t.failed++;});
  return t;
}
async function newPage(){
  const context=await browser.newContext();const page=await context.newPage();
  if(share){await page.goto(share,{waitUntil:'domcontentloaded'});await page.waitForSelector('#email',{timeout:60000});}
  return {context,page};
}
async function signIn(page,role){
  await page.fill('#email',env[ROLES[role][0]]);await page.fill('#password',env[ROLES[role][1]]);
  await page.getByRole('button',{name:'Sign in'}).click();
}

const cold={},warm={};
for(const role of Object.keys(ROLES)){cold[role]={};warm[role]={};for(const [id] of PAGES){cold[role][id]=[];warm[role][id]=[];}}
const notes={};

for(const role of Object.keys(ROLES)){
  // COLD: every screen in a fresh browser.
  for(const [id,number] of PAGES){
    if(notApplicable(role,id))continue;
    for(let run=1;run<=runs;run++){
      const {context,page}=await newPage();const tracker=track(page);
      await page.goto(`${base}/#/${id}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#email',{timeout:60000});
      await page.fill('#email',env[ROLES[role][0]]);await page.fill('#password',env[ROLES[role][1]]);
      const t0=Date.now();await page.getByRole('button',{name:'Sign in'}).click();
      const r=await settle(page,tracker,number,t0);
      cold[role][id].push({ms:r.ms,reason:r.reason,requests:tracker.count,failed:tracker.failed,alerts:r.alerts||[]});
      console.log(`cold ${role} ${number}.${id} run ${run}: ${r.ms===null?'TIMEOUT':r.ms+' ms'} requests=${tracker.count} failed=${tracker.failed}`);
      await context.close();
    }
  }
  // WARM: one session per run, screens opened from the menu one after another (the Overview is revisited last).
  for(let run=1;run<=runs;run++){
    const {context,page}=await newPage();const tracker=track(page);
    await page.goto(`${base}/`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#email',{timeout:60000});
    await signIn(page,role);
    const first=await settle(page,tracker,1,Date.now());if(first.ms===null){console.log(`warm ${role} run ${run}: the Overview did not settle`);await context.close();continue;}
    const order=PAGES.filter(([id])=>!notApplicable(role,id)&&id!=='overview').concat([PAGES[0]]);
    for(const [id,number,name] of order){
      const before=tracker.count;
      const link=page.getByRole('link',{name:`${number}. ${name}`});
      const t0=Date.now();await link.click();
      const r=await settle(page,tracker,number,t0);
      warm[role][id].push({ms:r.ms,reason:r.reason,requests:tracker.count-before,alerts:r.alerts||[]});
      console.log(`warm ${role} ${number}.${id} run ${run}: ${r.ms===null?'TIMEOUT':r.ms+' ms'} requests=${tracker.count-before}`);
    }
    await context.close();
  }
}
await browser.close();local?.server.close();

const median=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);return s.length?s[Math.floor((s.length-1)/2)]:null;};
const worst=a=>{const s=a.filter(Number.isFinite);return s.length?Math.max(...s):null;};
const sec=ms=>ms===null?'—':(ms/1000).toFixed(1)+' s';
const lines=[];
for(const [title,data] of [['Cold: sign-in click to settled screen (new browser each time)',cold],['Warm: menu click to settled screen (already signed in)',warm]]){
  lines.push(`\n### ${title}\n`,'| Screen | Leadership | Cluster Officer | Teacher |','|---|---|---|---|');
  for(const [id,number,name] of PAGES){
    const cell=role=>notApplicable(role,id)?'N/A (no access)':(()=>{const v=data[role][id];const m=median(v.map(x=>x.ms)),w=worst(v.map(x=>x.ms));const reqs=median(v.map(x=>x.requests));const bad=v.filter(x=>x.ms===null).length+v.filter(x=>(x.failed||0)>0).length;return v.length?`${sec(m)} (worst ${sec(w)}, ${reqs} req${bad?`, ${bad} problem run${bad>1?'s':''}`:''})`:'—';})();
    lines.push(`| ${number}. ${name} | ${cell('leadership')} | ${cell('officer')} | ${cell('teacher')} |`);
  }
}
// A separate table of database requests per screen (median of the runs), with the total for one visit to every screen the role can open.
for(const [title,data] of [['Database requests per screen, cold',cold],['Database requests per screen, warm',warm]]){
  lines.push(`\n### ${title}\n`,'| Screen | Leadership | Cluster Officer | Teacher |','|---|---|---|---|');
  const totals={leadership:0,officer:0,teacher:0};
  for(const [id,number,name] of PAGES){
    const cell=role=>{if(notApplicable(role,id))return 'N/A';const v=data[role][id].map(x=>x.requests);if(!v.length)return '—';const m=median(v);totals[role]+=m;const lo=Math.min(...v),hi=Math.max(...v);return lo===hi?String(m):`${m} (${lo}–${hi})`;};
    lines.push(`| ${number}. ${name} | ${cell('leadership')} | ${cell('officer')} | ${cell('teacher')} |`);
  }
  lines.push(`| **All applicable screens, added up** | **${totals.leadership}** | **${totals.officer}** | **${totals.teacher}** |`);
}
console.log(lines.join('\n'));
const out=path.join(root,'perf-results');await mkdir(out,{recursive:true});
await writeFile(path.join(out,`pages-${label}.json`),JSON.stringify({label,base:baseArg?new URL(baseArg).host:'local dist',runs,cold,warm},null,1));
await writeFile(path.join(out,`pages-${label}.md`),lines.join('\n'));
