// Synthetic, local browser -> RPC -> isolated PostgreSQL integration. No hosted data.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {build} from 'esbuild';
import {fixture,centre,user} from './fixture.mjs';
const {chromium:playwright}=await import(process.env.MASS_PLAYWRIGHT_MODULE||'playwright');
let executablePath=process.env.MASS_CHROMIUM_EXECUTABLE;
let launchArgs=[];
if(process.env.MASS_CHROMIUM_MODULE){const {default:chromium}=await import(process.env.MASS_CHROMIUM_MODULE);executablePath=await chromium.executablePath();launchArgs=chromium.args;}
const {db,rpc}=await fixture();
const root=path.resolve(new URL('../..',import.meta.url).pathname),output=await fs.mkdtemp(path.join(os.tmpdir(),'mass-register-browser-'));
await build({entryPoints:[path.join(root,'tests/release/browser-entry.js')],outfile:path.join(output,'fixture.js'),bundle:true,format:'esm',platform:'browser',plugins:[{name:'local-fixture-auth',setup(b){b.onResolve({filter:/^\.\/client\.js$/},()=>({path:path.join(root,'tests/release/browser-client.js')}));}}]});
const calls=[];
const normalize=v=>v instanceof Date?v.toISOString().slice(0,10):Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalize(x)])):v;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/identity.js'){
   const actor=Number(url.searchParams.get('actor')||1);const id=user(actor),token='e30.'+Buffer.from(JSON.stringify({sub:id})).toString('base64url')+'.synthetic';
   res.setHeader('Content-Type','application/javascript');res.end(`globalThis.__fixtureUser=${JSON.stringify(id)};globalThis.__fixtureToken=${JSON.stringify(token)};`);return;
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1),chunks=[];for await(const chunk of req)chunks.push(chunk);
   const args=JSON.parse(Buffer.concat(chunks).toString()||'{}');
   const jwt=String(req.headers.authorization||'').split('.')[1];const actor=JSON.parse(Buffer.from(jwt,'base64url').toString()).sub;
   calls.push({name,args,actor});
   try{const value=await rpc(name,args,actor);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(normalize(value)));}
   catch(e){res.writeHead(e.code==='42501'?403:e.code==='PT409'?409:400,{'Content-Type':'application/json'});res.end(JSON.stringify({code:e.code,message:e.message}));}return;
  }
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(file.includes('..'))throw Error('Invalid test path');
  let bytes=await fs.readFile(file==='fixture.js'?path.join(output,file):path.join(root,'src',file));
  if(file==='index.html')bytes=Buffer.from(bytes.toString().replace('<script type="module" src="entry.js"></script>',`<script src="/identity.js?actor=${Number(url.searchParams.get('actor')||1)}"></script><script type="module" src="fixture.js"></script>`));
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.jpg')?'image/jpeg':'text/html');res.end(bytes);
 }catch(e){res.writeHead(500);res.end(String(e.message));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await playwright.launch({executablePath,args:launchArgs,headless:true});let checks=0;
const check=(condition)=>{assert.ok(condition);checks++;};
const writes=()=>calls.filter(c=>['save_attendance_register','delete_attendance_register','record_attendance','record_attendance_batch'].includes(c.name));
const screenshots=process.env.MASS_ATTENDANCE_SCREENSHOTS;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(origin+'/?actor=1');await page.locator('[data-nav=attendance]').first().waitFor();await page.locator('[data-nav=attendance]').first().click();
 await page.getByRole('heading',{name:'Attendance register',exact:true}).waitFor();
 check(await page.locator('[data-mark]').count()===0);
 check(await page.locator('[data-chart]').count()>=4);
 await page.locator('[data-filter=month]').selectOption('2026-05');
 await page.getByRole('button',{name:'Add Attendance',exact:true}).click();
 await page.locator('[data-register-context=date]').fill('2026-05-14');await page.locator('[data-register-context=date]').dispatchEvent('change');
 await page.locator('[data-register-mark]').first().waitFor();
 const roster=(await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).roster;
 const first=roster[0].id,second=roster[1].id;
 const before=writes().length;
 await page.locator(`[data-register-mark="${first}|P"]`).click();await page.locator(`[data-register-mark="${second}|L"]`).click();
 check(writes().length===before);
 check((await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).recorded===0);
 if(screenshots){await fs.mkdir(screenshots,{recursive:true});await page.screenshot({path:path.join(screenshots,'attendance-popup-desktop.png'),fullPage:true});}
 await page.getByRole('button',{name:'Save Attendance',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`).waitFor();
 check(writes().length===before+1);
 let row=page.locator('tr').filter({has:page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`)});
 check((await row.innerText()).includes('50.0%'));
 await page.waitForFunction(()=>document.querySelector('.metrics .metric-value')?.textContent==='50.0%');checks++;
 await page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`).click();await page.locator(`[data-register-mark="${first}|P"][aria-pressed=true]`).waitFor();
 await page.locator(`[data-register-mark="${first}|A"]`).click();
 await page.locator('[name=reason]').fill('Synthetic browser correction');await page.getByRole('button',{name:'Save Attendance',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await page.waitForFunction(()=>document.querySelector('[data-register-edit]')?.closest('tr')?.textContent.includes('0.0%'));await page.waitForFunction(()=>document.querySelector('.metrics .metric-value')?.textContent==='0.0%');checks++;
 check((await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).marks.find(m=>m.enrolment===first).code==='A');
 await page.reload();await page.locator('[data-nav=attendance]').first().waitFor();await page.locator('[data-nav=attendance]').first().click();await page.locator('[data-filter=month]').selectOption('2026-05');
 await page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`).click();await page.locator(`[data-register-mark="${first}|A"][aria-pressed=true]`).waitFor();checks++;
 const beforeClear=writes().length;
 await page.locator(`[data-register-clear="${first}"]`).click();
 check(writes().length===beforeClear);
 check((await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).marks.some(m=>m.enrolment===first&&m.code==='A'));
 await page.locator('[name=reason]').fill('Clear saved mark');await page.getByRole('button',{name:'Save Attendance',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 check(!(await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).marks.some(m=>m.enrolment===first));
 await page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`).click();await page.locator(`[data-register-clear="${first}"]`).waitFor();
 // Discarding an unsaved draft does not affect Supabase or the table.
 await page.locator(`[data-register-mark="${first}|P"]`).click();const beforeCancel=writes().length;await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});check(writes().length===beforeCancel);
 if(screenshots)await page.screenshot({path:path.join(screenshots,'attendance-page-desktop.png'),fullPage:true});
 await page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`).click();await page.locator('[data-register-delete]').waitFor();
 await page.locator('[data-register-delete]').click();await page.locator('[name=reason]').fill('Synthetic browser deletion');await page.locator('[name=confirmDelete]').check();
 await page.getByRole('button',{name:'Confirm deletion',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});await page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`).waitFor({state:'detached'});
 check((await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).recorded===0);
 // CO uses the same workflow with masked student labels; Leadership only sees aggregates.
 await page.goto(origin+'/?actor=3');await page.locator('[data-nav=attendance]').first().waitFor();await page.locator('[data-nav=attendance]').first().click();await page.getByRole('button',{name:'Add Attendance',exact:true}).click();await page.locator('[data-register-mark]').first().waitFor();check((await page.locator('#register-roster').innerText()).includes('Synthetic corrected profile'));check((await page.locator('#register-roster .subtext').count())>0);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.goto(origin+'/?actor=4');await page.locator('[data-nav=attendance]').first().waitFor();await page.locator('[data-nav=attendance]').first().click();await page.getByRole('heading',{name:'Attendance register',exact:true}).waitFor();check(await page.getByRole('button',{name:'Add Attendance',exact:true}).count()===0);check(await page.locator('[data-register-edit]').count()===0);
 await page.goto(origin+'/?actor=1');await page.locator('[data-nav=attendance]').first().waitFor();await page.setViewportSize({width:390,height:844});await page.locator('[data-nav=attendance]').last().click();await page.getByRole('button',{name:'Add Attendance',exact:true}).click();await page.locator('[data-register-mark]').first().waitFor();check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 if(screenshots)await page.screenshot({path:path.join(screenshots,'attendance-popup-mobile.png'),fullPage:true});
 check(errors.length===0);check(await page.locator('[data-register-mark]').count()>0);
 console.log(`PASS ${checks} browser assertions: chart-first landing, draft-only clicks, atomic Save, refreshed summary, correction, reload persistence, discard, audited deletion, scoped CO and read-only Leadership, mobile layout.`);
}catch(error){console.error(error);for(const page of browser.contexts().flatMap(c=>c.pages()))console.error('Page error:',await page.locator('#form-error').textContent().catch(()=>''));process.exitCode=1;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();await fs.rm(output,{recursive:true,force:true});}
