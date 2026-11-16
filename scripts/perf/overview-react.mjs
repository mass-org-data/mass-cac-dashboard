// Times sign-in to a fully loaded Overview in the new React interface, in a real browser, and records every
// Supabase request (path, timing, status). Never records headers, bodies, tokens or programme records.
// Credentials come from the git-ignored .env.preview-test-account. Usage:
//   node scripts/perf/overview-react.mjs --runs 5 --role leadership|teacher|officer [--label x] [--base-url https://...]
// By default it serves ./dist locally with the production headers (CSP included). For a protected Vercel preview,
// pass --share-url-env NAME (the value is a Vercel shareable link; it is opened once per run to set the access cookie and
// is never printed), or --bypass-env NAME: the value of that environment variable is sent as x-vercel-protection-bypass on the
// page navigation only, never to Supabase.
//   T1: sign-in submit to the first five scorecards showing a value.   T2: everything in the first screen settled
//   (no skeleton, nothing in flight).   T3: after scrolling to the end, everything including lazy content settled.
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

/* global performance, document, window, clearInterval */
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true);};
const runs=Number(arg('runs',3)),label=String(arg('label','run')),role=String(arg('role','leadership')),baseArg=arg('base-url',null),bypassEnv=arg('bypass-env',null),shareEnv=arg('share-url-env',null),timeoutMs=Number(arg('timeout',120000));

const env={};for(const line of (await readFile(path.join(root,'.env.preview-test-account'),'utf8')).split('\n')){const m=/^([A-Z_]+)=(.*)$/.exec(line);if(m)env[m[1]]=m[2];}
const account={leadership:['PREVIEW_TEST_EMAIL','PREVIEW_TEST_PASSWORD'],teacher:['PREVIEW_TEACHER_EMAIL','PREVIEW_TEACHER_PASSWORD'],officer:['PREVIEW_OFFICER_EMAIL','PREVIEW_OFFICER_PASSWORD']}[role];
if(!account)throw new Error('Unknown role.');
const [email,password]=[env[account[0]],env[account[1]]];

async function serveDist(){
  const vercel=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
  const headers=Object.fromEntries(vercel.headers[0].headers.map(h=>[h.key,h.value]));
  delete headers['Strict-Transport-Security'];headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace('; upgrade-insecure-requests','');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.json':'application/json'};
  const server=http.createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';res.writeHead(200,{...headers,'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(await readFile(path.join(root,'dist',p)));}catch{res.writeHead(404);res.end('Not found');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}

// Runs in the page: t0 is the sign-in submit. Returns epoch milliseconds so they line up with the request log.
const measure=({timeout,needSubmit})=>new Promise(resolve=>{
  const epoch=()=>performance.timeOrigin+performance.now();
  let t0=needSubmit?null:epoch(),t1=null,quiet=null,settledAt=null,done=false;
  if(needSubmit)document.addEventListener('submit',()=>{t0=epoch();},{capture:true,once:true});
  const cards=()=>[...document.querySelectorAll('main [role=group][aria-label][aria-busy]')];
  const loading=()=>[...document.querySelectorAll('main [role=status]')].some(el=>el.getAttribute('aria-busy')==='true'||/loading/i.test(el.textContent));
  const failed=()=>[...document.querySelectorAll('main [role=alert]')].filter(el=>/Unavailable/.test(el.textContent)).length;
  const finish=reason=>{if(done)return;done=true;clearInterval(timer);resolve({t0,t1,t2:reason==='complete'?settledAt:null,reason,cards:cards().length,failedCards:failed(),cardText:cards().map(c=>c.getAttribute('aria-label')+' = '+(c.querySelector('p.text-4xl')?.textContent||'').trim().slice(0,16))});};
  const timer=setInterval(()=>{
    if(t0===null)return;
    const list=cards();
    if(t1===null&&list.length>=5&&list.slice(0,5).every(c=>c.getAttribute('aria-busy')==='false'))t1=epoch();
    const complete=list.length>0&&!loading()&&list.every(c=>c.getAttribute('aria-busy')==='false');
    // T2 is when everything first settled; the one-second quiet window only confirms nothing else started.
    if(complete){if(quiet===null){quiet=performance.now();settledAt=epoch();}if(performance.now()-quiet>=1000)finish('complete');}else{quiet=null;settledAt=null;}
    if(epoch()-t0>timeout)finish('timeout');
  },50);
});

const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor((s.length-1)/2)]:null;};
const p75=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.ceil(0.75*s.length)-1)]:null;};

const local=baseArg?null:await serveDist();
const base=(baseArg||local.url).replace(/\/$/,'');
const baseOrigin=new URL(base).origin;
const share=shareEnv?process.env[shareEnv]:null;
if(shareEnv&&!share)throw new Error('The share-link variable is empty.');
const bypass=bypassEnv?process.env[bypassEnv]:null;
if(bypassEnv&&!bypass)throw new Error('The bypass variable is empty.');
const browser=await chromium.launch();const results=[];
try{
  for(let run=1;run<=runs;run++){
    const context=await browser.newContext();const page=await context.newPage();
    if(bypass)await context.route(u=>u.origin===baseOrigin,route=>{const r=route.request();return r.resourceType()==='document'?route.continue({headers:{...r.headers(),'x-vercel-protection-bypass':bypass,'x-vercel-set-bypass-cookie':'true'}}):route.continue();});
    const log=[];const csp=[];
    page.on('console',m=>{if(/Content Security Policy|Refused to connect/i.test(m.text()))csp.push(1);});
    page.on('request',r=>{if(r.url().includes('/rest/v1/rpc/')||r.url().includes('/auth/v1/'))r.__start=Date.now();});
    page.on('response',async r=>{const q=r.request();if(q.__start===undefined)return;try{await r.finished();}catch{/* aborted */}log.push({name:new URL(r.url()).pathname.split('/').pop(),start:q.__start,end:Date.now(),status:r.status()});});
    // A shareable link sets the access cookie for this browser context and redirects; it is not part of the timing.
    if(share){await page.goto(share,{waitUntil:'domcontentloaded'});await page.waitForSelector('#email',{timeout:60000});}
    const t_nav=Date.now();
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#email',{timeout:60000});
    const tPage=Date.now()-t_nav;
    await page.fill('#email',email);await page.fill('#password',password);
    const first=page.evaluate(measure,{timeout:timeoutMs,needSubmit:true});
    await page.getByRole('button',{name:'Sign in'}).click();
    const r=await first;
    const second=await (async()=>{await page.evaluate(()=>{for(const el of [document.scrollingElement,document.querySelector('main')])if(el)el.scrollTop=el.scrollHeight;});return page.evaluate(measure,{timeout:timeoutMs,needSubmit:false});})();
    const rel=ms=>ms===null?null:Math.round(ms-r.t0);
    const reqs=log.filter(q=>q.name!=='token'&&!q.name.startsWith('user')).map(q=>({...q,start:q.start-r.t0,ms:q.end-q.start}));
    let peak=0;for(const q of reqs){peak=Math.max(peak,reqs.filter(o=>o.start<q.start+q.ms&&q.start<o.start+o.ms).length);}
    const byName={};for(const q of reqs){const e=byName[q.name]||={count:0,totalMs:0,maxMs:0};e.count++;e.totalMs+=q.ms;e.maxMs=Math.max(e.maxMs,q.ms);}
    const t3=second.t2===null?null:Math.round(second.t2-r.t0);
    results.push({run,pageReadyMs:tPage,t1:rel(r.t1),t2:rel(r.t2),t3,reason:r.reason,cards:r.cards,failedCards:r.failedCards,failedRequests:reqs.filter(q=>q.status>=400).length,requestCount:reqs.length,peakConcurrent:peak,maxRequestMs:Math.round(Math.max(0,...reqs.map(q=>q.ms))),byName,cardText:r.cardText,cspBlocked:csp.length});
    console.log(`run ${run}: sign-in page ${tPage}ms | T1=${rel(r.t1)}ms T2=${rel(r.t2)}ms T3=${t3}ms (${r.reason}) failedCards=${r.failedCards} failedRequests=${reqs.filter(q=>q.status>=400).length} requests=${reqs.length} peak=${peak} slowest=${Math.round(Math.max(0,...reqs.map(q=>q.ms)))}ms cspBlocked=${csp.length}`);
    await context.close();
  }
}finally{await browser.close();local?.server.close();}
const col=k=>results.map(x=>x[k]).filter(Number.isFinite);
const summary={label,role,base:baseArg?new URL(baseArg).host:'local dist',runs,t1:{median:median(col('t1')),p75:p75(col('t1'))},t2:{median:median(col('t2')),p75:p75(col('t2'))},t3:{median:median(col('t3')),p75:p75(col('t3'))},requests:median(col('requestCount')),failedCards:results.reduce((n,x)=>n+x.failedCards,0),failedRequests:results.reduce((n,x)=>n+x.failedRequests,0),slowestRequestMs:Math.max(...col('maxRequestMs'))};
console.log(JSON.stringify(summary,null,1));
const out=path.join(root,'perf-results');await mkdir(out,{recursive:true});await writeFile(path.join(out,`react-${label}-${role}.json`),JSON.stringify({summary,results},null,1));
