// Measures sign-in to fully loaded Overview in a real browser and records every
// Supabase request (path, timing, status, size). Never records headers, bodies,
// tokens or programme records. Local use only; reads credentials from the
// git-ignored .env.preview-test-account (or PREVIEW_TEST_EMAIL/PASSWORD).
//
//   node scripts/perf/overview-waterfall.mjs --runs 7 --label baseline [--build] [--base-url https://...]
//
// By default it serves ./dist locally with the headers from vercel.json (CSP
// included, minus the two headers that only make sense over HTTPS), so a CSP that
// blocks the configured Supabase host fails here too.
import http from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

/* global performance, document, clearInterval */

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true);};
const runs=Number(arg('runs',3)),label=String(arg('label','run')),baseUrlArg=arg('base-url',null),timeoutMs=Number(arg('timeout',120000));
const PREVIEW_URL='https://nilzfsahxoxibvrwsqkd.supabase.co';

async function credentials(){
  let email=process.env.PREVIEW_TEST_EMAIL,password=process.env.PREVIEW_TEST_PASSWORD;
  if(!email||!password){
    try{for(const line of (await readFile(path.join(root,'.env.preview-test-account'),'utf8')).split('\n')){const m=/^(PREVIEW_TEST_EMAIL|PREVIEW_TEST_PASSWORD)=(.*)$/.exec(line);if(m)(m[1]==='PREVIEW_TEST_EMAIL'?(email=m[2]):(password=m[2]));}}catch{/* handled below */}
  }
  if(!email||!password)throw new Error('Missing preview test credentials (.env.preview-test-account).');
  return {email,password};
}

async function publishableKey(){
  if(process.env.MASS_SUPABASE_PUBLISHABLE_KEY)return process.env.MASS_SUPABASE_PUBLISHABLE_KEY;
  const token=process.env.SUPABASE_ACCESS_TOKEN;
  if(!token)throw new Error('Set MASS_SUPABASE_PUBLISHABLE_KEY (preview) or SUPABASE_ACCESS_TOKEN to look it up.');
  const response=await fetch('https://api.supabase.com/v1/projects/nilzfsahxoxibvrwsqkd/api-keys',{headers:{Authorization:`Bearer ${token}`}});
  const keys=await response.json();
  const key=keys.find?.(k=>k.type==='publishable')?.api_key;
  if(!key)throw new Error('Could not look up the preview publishable key.');
  return key;
}

async function serveDist(){
  const vercel=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
  const headers=Object.fromEntries(vercel.headers.find(r=>r.source==='/(.*)').headers.map(h=>[h.key,h.value]));
  delete headers['Strict-Transport-Security'];
  headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace('; upgrade-insecure-requests','');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.json':'application/json'};
  const dist=path.join(root,'dist');
  const server=http.createServer(async(req,res)=>{
    try{
      let target=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));
      if(!target.startsWith(dist))throw new Error('outside');
      if((await stat(target)).isDirectory())target=path.join(target,'index.html');
      res.writeHead(200,{...headers,'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(await readFile(target));
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}

// Runs inside the page after the post-sign-in reload. Times are ms from navigation start.
const measureInPage=timeout=>new Promise(resolve=>{
  const t0=performance.now();let t1=null,quietSince=null,done=false;const marks={};
  const inflight=()=>(globalThis.__massPerf?.requests||[]).filter(r=>r.end===undefined).length;
  const cards=()=>[...document.querySelectorAll('.metric')];
  // A card is loading when it shows the loading marker, or shows an em dash while requests are still in flight
  // (some cards stay '—' until aggregate reads finish). A dash with nothing in flight is a legitimate unknown.
  const loadingCards=list=>list.filter(c=>c.querySelector('.metric-loading[role=status]')||(/^\s*(—|Loading)/.test(c.querySelector('.metric-value')?.textContent||'—')&&inflight()>0));
  const failedCards=()=>cards().filter(c=>c.querySelector('.metric-loading[role=alert]')).length;
  const statusLoading=()=>[...document.querySelectorAll('#app [role=status]')].some(el=>/loading/i.test(el.textContent));
  const finish=(reason)=>{if(done)return;done=true;clearInterval(timer);
    for(const m of performance.getEntriesByType('mark'))if(m.name.startsWith('mass:'))marks[m.name]=Math.round(m.startTime);
    const pending=[...document.querySelectorAll('.metric-loading,#app [role=status],#mass-load-status')].map(el=>el.textContent.trim().slice(0,80)).slice(0,10);
    const cardText=cards().map(c=>(c.querySelector('.metric-top')?.textContent||'').trim().slice(0,40)+' = '+(c.querySelector('.metric-value')?.textContent||'').trim().slice(0,20));
    resolve({t1,t2:reason==='complete'?Math.round(performance.now()):null,reason,cards:cards().length,failedCards:failedCards(),pending,cardText,marks,requests:globalThis.__massPerf?.requests||[]});};
  const timer=setInterval(()=>{
    const list=cards(),first=list.slice(0,5);
    if(t1===null&&list.length>=5&&loadingCards(first).length===0)t1=Math.round(performance.now());
    const complete=list.length>0&&loadingCards(list).length===0&&!statusLoading()&&!document.querySelector('#mass-load-status')&&inflight()===0;
    if(complete){quietSince??=performance.now();if(performance.now()-quietSince>=750)finish('complete');}else quietSince=null;
    if(performance.now()-t0>timeout)finish('timeout');
  },50);
});

const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor((s.length-1)/2)]:null;};
const p75=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.ceil(0.75*s.length)-1)]:null;};

async function main(){
  const {email,password}=await credentials();
  if(arg('build',false)){
    const key=await publishableKey();
    execFileSync('node',['scripts/build.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,MASS_APP_MODE:'live',MASS_READ_API:'frontend-reads-v1',MASS_DIRECTORY_API:'directory-v1',MASS_SUPABASE_URL:PREVIEW_URL,MASS_SUPABASE_PUBLISHABLE_KEY:key,VERCEL_ENV:'preview'}});
  }
  let local=null,base=baseUrlArg;
  if(!base){local=await serveDist();base=local.url;}
  const browser=await chromium.launch();const results=[];
  try{
    for(let run=1;run<=runs;run++){
      const context=await browser.newContext();const page=await context.newPage();
      const blocked=[];page.on('console',m=>{if(/Content Security Policy|Refused to connect/i.test(m.text()))blocked.push(m.text().slice(0,200));});
      // The original interface (the one this harness times) lives at /vanilla/ since the cutover.
      await page.goto(`${base}/vanilla/?perf=1`,{waitUntil:'domcontentloaded'});
      await page.waitForSelector('#sign-in',{timeout:30000});
      await page.fill('#sign-in [name=email]',email);await page.fill('#sign-in [name=password]',password);
      await Promise.all([page.waitForEvent('framenavigated',{timeout:60000}),page.click('#sign-in [type=submit]')]);
      await page.waitForLoadState('domcontentloaded');
      const r=await page.evaluate(measureInPage,timeoutMs);
      // T3: scroll to the end so content that loads when it comes into view is requested, then wait for it (ms from navigation start).
      await page.evaluate(()=>{for(const el of [document.scrollingElement,document.querySelector('.content'),document.querySelector('main')])if(el)el.scrollTop=el.scrollHeight;});
      const late=await page.evaluate(measureInPage,timeoutMs);
      const reqs=late.requests.filter(q=>q.end!==undefined).map(q=>({name:q.path.split('/').pop(),start:Math.round(q.start),ms:Math.round(q.end-q.start),status:q.status,bytes:q.bytes}));
      const byName={};for(const q of reqs){const e=byName[q.name]||={count:0,totalMs:0,maxMs:0};e.count++;e.totalMs+=q.ms;e.maxMs=Math.max(e.maxMs,q.ms);}
      let peak=0;for(const q of reqs){const c=reqs.filter(o=>o.start<q.start+q.ms&&q.start<o.start+o.ms).length;peak=Math.max(peak,c);}
      results.push({run,t1:r.t1,t2:r.t2,t3:late.t2,reason:r.reason,cards:r.cards,failedCards:r.failedCards,http500:reqs.filter(q=>q.status>=500).length,pending:r.pending,cardText:r.cardText,requestCount:reqs.length,requestCountAtT2:r.requests.filter(q=>q.end!==undefined).length,peakConcurrent:peak,maxRequestMs:Math.max(0,...reqs.map(q=>q.ms)),marks:r.marks,byName,waterfall:reqs.sort((a,b)=>a.start-b.start),cspBlocked:blocked});
      console.log(`run ${run}: T1=${r.t1}ms T2=${r.t2}ms T3=${late.t2}ms (${r.reason}) failedCards=${r.failedCards} http5xx=${reqs.filter(q=>q.status>=500).length} requests=${reqs.length} peak=${peak} cspBlocked=${blocked.length}`);
      await context.close();
    }
  }finally{await browser.close();local?.server.close();}
  const summary={label,base:baseUrlArg||'local dist',runs,t1:{median:median(results.map(r=>r.t1).filter(Number.isFinite)),p75:p75(results.map(r=>r.t1).filter(Number.isFinite))},t2:{median:median(results.map(r=>r.t2).filter(Number.isFinite)),p75:p75(results.map(r=>r.t2).filter(Number.isFinite))},t3:{median:median(results.map(r=>r.t3).filter(Number.isFinite)),p75:p75(results.map(r=>r.t3).filter(Number.isFinite))},requests:{atT2Median:median(results.map(r=>r.requestCountAtT2)),totalMedian:median(results.map(r=>r.requestCount))},timeouts:results.filter(r=>r.reason!=='complete').length,runsWithFailedCards:results.filter(r=>r.failedCards>0).length,totalHttp5xx:results.reduce((n,r)=>n+r.http500,0)};
  await mkdir(path.join(root,'perf-results'),{recursive:true});
  const file=path.join(root,'perf-results',`${label}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  await writeFile(file,JSON.stringify({summary,results},null,1));
  console.log(JSON.stringify(summary));console.log('wrote',path.relative(root,file));
}
main().catch(error=>{console.error(error.message);process.exit(1);});
