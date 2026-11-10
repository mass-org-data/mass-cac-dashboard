// Synthetic, local browser -> RPC -> isolated PostgreSQL integration. No hosted data.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {fixture,centre,user} from './fixture.mjs';
const {chromium:playwright}=await import(process.env.MASS_PLAYWRIGHT_MODULE||'playwright');
let executablePath=process.env.MASS_CHROMIUM_EXECUTABLE;
let launchArgs=[];
if(process.env.MASS_CHROMIUM_MODULE){const {default:chromium}=await import(process.env.MASS_CHROMIUM_MODULE);executablePath=await chromium.executablePath();launchArgs=chromium.args;}
const {db,rpc}=await fixture();
if(process.env.MASS_TEST_MULTI_ROLE==='1'){
 await db.query("INSERT INTO mass_core.staff_operational_access(user_id,approval_reference,approved_by) VALUES($1,'Synthetic browser multi-role approval',$2)",[user(8),user(6)]);
 await db.exec('SET ROLE mass_core_admin;');
 await db.query("INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at) VALUES($1,$2,'Cluster Officer','2026-01-01',$3,now())",[user(8),centre,user(6)]);await db.exec('RESET ROLE;SET ROLE mass_core_owner;');
 const staff=randomUUID(),directory=randomUUID();
 await db.query("INSERT INTO mass_core.staff_members(id,display_name,source_name,auth_user_id) VALUES($1,'Synthetic operational account','Synthetic Auth account',$2)",[staff,user(8)]);
 await db.query("INSERT INTO mass_core.centre_staff_assignments(id,centre_id,staff_member_id,role_code,verification_reference) VALUES($1,$2,$3,'Cluster Officer','Synthetic verified Auth assignment')",[directory,centre,staff]);
 await db.query("INSERT INTO mass_core.officer_assignments(scope_grant_id,directory_assignment_id,starts_on,shift_scope,verification_reference) SELECT id,$1,'2026-01-01','Both shifts','Synthetic browser assignment' FROM mass_core.user_scope_grants WHERE user_id=$2 AND centre_id=$3 AND role_code='Cluster Officer'",[directory,user(8),centre]);await db.exec('RESET ROLE;');
}

// More than ten synthetic learners catches accidental pagination inside entry forms.
await db.exec("SET ROLE mass_core_owner; UPDATE mass_activation.features SET enabled=true,approval_reference='TEST RECORD fixture preparation' WHERE feature='registration'; RESET ROLE;");
for(let index=0;index<12;index++)await rpc('register_student_once',{p_request:randomUUID(),p_centre:centre,p_grade:'1',p_shift:'Morning',p_start:'2026-04-01',p_name:'TEST RECORD learner '+index,p_gender:null});
await db.exec("SET ROLE mass_core_owner; UPDATE mass_activation.features SET enabled=false WHERE feature='registration'; RESET ROLE;");

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
if(process.env.MASS_MANUAL_BROWSER==='1'){console.log('SYNTHETIC_ACCEPTANCE_URL='+origin);await new Promise(()=>{});}
const browser=await playwright.launch({executablePath,args:launchArgs,headless:true});let checks=0;
const check=(condition)=>{assert.ok(condition);checks++;};
const writes=()=>calls.filter(c=>['save_attendance_register','save_attendance_register_v3','delete_attendance_register_v3','delete_attendance_register','record_attendance','record_attendance_batch'].includes(c.name));
const screenshots=process.env.MASS_ATTENDANCE_SCREENSHOTS;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('Browser script error:',error.stack);});
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(origin+'/?actor=1');await page.locator('[data-nav=attendance]').first().waitFor();check(!calls.some(c=>c.name==='read_students'));check(await page.locator('[data-action=export-explain]').count()>0);check(await page.locator('.account-bar [data-action=sign-out]').isVisible());check(await page.locator('.account-bar').evaluate(el=>el.getBoundingClientRect().bottom<=window.innerHeight));if(screenshots){await fs.mkdir(screenshots,{recursive:true});await page.screenshot({path:path.join(screenshots,'teacher-overview-desktop.png'),fullPage:true});}await page.locator('[data-nav=attendance]').first().click();
 await page.getByRole('heading',{name:'Attendance Register',exact:true}).waitFor();
 check(await page.locator('[data-mark]').count()===0);
 check(await page.locator('[data-chart]').count()>=4);
 await page.locator('[data-filter=month]').selectOption('2026-05');
 await page.getByRole('button',{name:'Add Attendance',exact:true}).click();
 await page.locator('[data-register-context=date]').fill('2026-05-14');await page.locator('[data-register-context=date]').dispatchEvent('change');
 await page.locator('[data-register-mark]').first().waitFor();
 const roster=(await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).roster;
 const first=roster[0].id,second=roster[1].id;
 check(await page.locator(`[data-register-mark^="${first}|"]`).evaluateAll(nodes=>nodes.map(n=>n.textContent).join(','))==='A,P,H,MM');
 check(await page.locator('[name=notes]').isEnabled());await page.locator('[name=notes]').fill('TEST RECORD browser notes');
 const before=writes().length;
 await page.locator(`[data-register-mark="${first}|P"]`).click();await page.locator(`[data-register-mark="${second}|A"]`).click();
 check(writes().length===before);
 check((await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).recorded===0);
 if(screenshots){await fs.mkdir(screenshots,{recursive:true});await page.screenshot({path:path.join(screenshots,'attendance-popup-desktop.png'),fullPage:true});}
 // A rejected save keeps marks and notes in the popup; retry is explicit.
 await page.route('**/rest/v1/rpc/save_attendance_register_v3',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'TEST RECORD unavailable'})}));
 await page.getByRole('button',{name:'Save Attendance',exact:true}).click();await page.locator('#form-error').filter({hasText:/./}).waitFor();
 check(await page.locator(`[data-register-mark="${first}|P"]`).getAttribute('aria-pressed')==='true');check(await page.locator('[name=notes]').inputValue()==='TEST RECORD browser notes');
 check((await rpc('read_attendance_register',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).recorded===0);
 await page.unroute('**/rest/v1/rpc/save_attendance_register_v3');
 await page.getByRole('button',{name:'Save Attendance',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await page.locator(`[data-register-edit="${centre}|Morning|2026-05-14"]`).waitFor();
 check(writes().length===before+1);check((await rpc('read_attendance_register_v3',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-14'})).notes==='TEST RECORD browser notes');
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
 // Holiday is an explicit draft code and excluded after the atomic save.
 await page.getByRole('button',{name:'Add Attendance',exact:true}).click();await page.locator('[data-register-context=date]').fill('2026-05-13');await page.locator('[data-register-context=date]').dispatchEvent('change');await page.locator('[data-register-mark]').first().waitFor();
 await page.locator(`[data-register-mark="${first}|P"]`).click();await page.locator(`[data-register-mark="${second}|H"]`).click();await page.getByRole('button',{name:'Save Attendance',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await page.locator(`[data-register-edit="${centre}|Morning|2026-05-13"]`).waitFor();check((await page.locator(`[data-register-edit="${centre}|Morning|2026-05-13"]`).locator('..').locator('..').innerText()).includes('100.0%'));
 check((await rpc('read_attendance_register_v3',{p_centre:centre,p_shift:'Morning',p_date:'2026-05-13'})).marks.some(r=>r.code==='H'));
 // CO uses the same workflow with masked student labels; Leadership only sees aggregates.
 await page.goto(origin+'/?actor=3');await page.locator('[data-nav=attendance]').first().waitFor();await page.locator('[data-nav=attendance]').first().click();await page.getByRole('button',{name:'Add Attendance',exact:true}).click();await page.locator('[data-register-mark]').first().waitFor();check((await page.locator('#register-roster').innerText()).includes('Synthetic corrected profile'));check((await page.locator('#register-roster .subtext').count())>0);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.goto(origin+'/?actor=4');await page.locator('[data-nav=attendance]').first().waitFor();await page.locator('[data-nav=attendance]').first().click();await page.getByRole('heading',{name:'Attendance Register',exact:true}).waitFor();check(await page.getByRole('button',{name:'Add Attendance',exact:true}).count()===0);check(await page.locator('[data-register-edit]').count()===0);
 await page.goto(origin+'/?actor=1');await page.locator('[data-nav=attendance]').first().waitFor();await page.setViewportSize({width:390,height:844});await page.locator('[data-nav=attendance]').last().click();await page.getByRole('button',{name:'Add Attendance',exact:true}).click();await page.locator('[data-register-mark]').first().waitFor();check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 if(screenshots)await page.screenshot({path:path.join(screenshots,'attendance-popup-mobile.png'),fullPage:true});
 // Profile paging/search operates over the full permitted selection.
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-nav=children]').first().click();await page.locator('#student-search').waitFor();await page.waitForFunction(()=>document.querySelector('#student-id-search')&&Math.abs(document.querySelector('#student-id-search').getBoundingClientRect().y-document.querySelector('#student-search').getBoundingClientRect().y)<2);checks++;
 const profilePager=page.locator('[data-profile-jump],[data-page-jump]').last();await profilePager.waitFor();check(await profilePager.count()===1);await profilePager.fill('2');await profilePager.dispatchEvent('change');
 await page.locator('[data-profile-jump],[data-page-jump]').last().waitFor();check(await page.locator('[data-profile-jump],[data-page-jump]').last().inputValue()==='2');
 await page.locator('#student-search').fill('TEST RECORD learner 11');await page.waitForFunction(()=>document.querySelectorAll('.profile-table-tools').length&&[...document.querySelectorAll('.content tbody tr')].some(row=>row.textContent.includes('TEST RECORD learner 11')));
 check(await page.locator('.content tbody tr:not([hidden])').count()===1);
 await page.locator('#student-search').fill('');await page.locator('[data-filter=profileSort]').selectOption('gender');await page.locator('[data-filter=profileSort]').selectOption('shift');
 await page.locator('[data-action=new-child]').click();await page.getByRole('heading',{name:'Add student',exact:true}).waitFor();check(await page.locator('#dialog-form [type=submit]').isDisabled());await page.getByRole('button',{name:'Cancel',exact:true}).click();
 if(screenshots)await page.screenshot({path:path.join(screenshots,'student-profiles-desktop.png'),fullPage:true});
 if(process.env.MASS_TEST_MULTI_ROLE==='1'){
  await page.setViewportSize({width:1440,height:1000});
  const detailReads=calls.filter(c=>c.name==='read_students').length;await page.goto(origin+'/?actor=8');await page.locator('#role:not([disabled])').waitFor();check(calls.filter(c=>c.name==='read_students').length===detailReads);
  check(await page.locator('#role').inputValue()==='Leadership');check(await page.locator('[data-action=export-explain]').count()>0);check(await page.locator('.metric-top').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=15));check(await page.locator('.metric-value').evaluateAll(nodes=>nodes.slice(0,3).every(n=>Math.abs(n.getBoundingClientRect().y-nodes[0].getBoundingClientRect().y)<2)));
  check(await page.locator('[data-nav=overview].active').count()>0);if(screenshots)await page.screenshot({path:path.join(screenshots,'leadership-overview-desktop.png'),fullPage:true});
  await page.locator('#role').selectOption('Cluster Officer');await page.locator('#role:not([disabled])').waitFor();check(await page.locator('[data-action=export-explain]').count()>0);
  await page.locator('[data-nav=attendance]').first().click();await page.getByRole('button',{name:'Add Attendance',exact:true}).click();await page.locator('[data-register-mark]').first().waitFor();
  const key=await page.locator('[data-register-mark]').first().getAttribute('data-register-mark');
  await page.locator(`[data-register-mark="${key.split('|')[0]}|P"]`).click();await page.getByRole('button',{name:'Save Attendance',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});checks++;
  await page.locator('[data-nav=learning]').first().click();await page.locator('[data-filter=centre]').selectOption(centre);await page.locator('[data-filter=exam]').selectOption('F1');
  const learner=await page.evaluate(centre=>globalThis.__massLiveReviewData.students.find(s=>s.centre===centre&&s.enrolled<='2026-05-15'&&!s.exitDate&&!globalThis.__massLiveReviewData.assessmentDetails[s.id+'|F1'])?.id,centre);
  check(Boolean(learner));await page.locator('[data-action=enter-marks]').click();await page.locator('[name=date]').fill('2026-08-15');await page.locator('[data-assessment-round]').filter({hasText:'F2'}).waitFor();checks++;await page.locator('[name=date]').fill('2026-05-15');await page.locator('[data-assessment-round]').filter({hasText:'F1'}).waitFor();checks++;await page.locator('#dialog-form [type=submit]').click();await page.getByRole('heading',{name:'Enter F1 marks',exact:true}).waitFor();check(await page.locator('.assessment-roster tbody tr').count()>10);check(await page.locator('.assessment-roster tbody tr[hidden]').count()===0);check(await page.locator('#overlay .pagination').count()===0);if(screenshots)await page.screenshot({path:path.join(screenshots,'assessment-roster-desktop.png'),fullPage:true});check((await page.locator('.assessment-roster').innerText()).includes('TEST RECORD learner'));await page.locator(`[name="score_${learner}"]`).fill('22');check(await page.locator('[data-roster-search=id]').evaluate(el=>Math.abs(el.getBoundingClientRect().y-el.closest('.student-search-row').querySelector('[data-roster-search=name]').getBoundingClientRect().y)<2));await page.locator('[data-roster-search=name]').fill('no matching TEST RECORD');check(await page.locator('.assessment-roster tr[data-student-id]:not([hidden])').count()===0);await page.locator('[data-roster-search=name]').fill('');check(await page.locator(`[name="score_${learner}"]`).inputValue()==='22');await page.getByRole('button',{name:'Save assessment',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  check(await page.evaluate(id=>globalThis.__massLiveReviewData.scores[id].F1===22,learner));
  await page.locator(`[data-assessment-group="${centre}|F1|2026-05-15"]`).click();await page.getByRole('heading',{name:'Edit F1 marks',exact:true}).waitFor();check(await page.locator(`[name="score_${learner}"]`).inputValue()==='22');check(await page.locator('#dialog-form [type=submit]').isDisabled());await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('[data-nav=visits]').first().click();await page.locator('[data-action=new-visit]').click();await page.locator('[name=status]').selectOption('Completed');await page.locator('[name=feedback]').fill('Synthetic explicitly authorized mixed-role visit');await page.locator('#dialog-form [type=submit]').click();await page.getByRole('dialog').waitFor({state:'detached'});checks++;
  await page.locator('#role').selectOption('Leadership');await page.locator('[data-nav=attendance]').first().click();check(await page.getByRole('button',{name:'Add Attendance',exact:true}).count()===0);
  await page.locator('#role').selectOption('Teacher');await page.locator('#role:not([disabled])').waitFor();await page.locator('[data-nav=attendance]').first().click();await page.getByRole('button',{name:'Add Attendance',exact:true}).click();await page.locator('[data-register-mark]').first().waitFor();
  check(await page.locator('[data-register-context=centre]').count()===0);check(await page.locator('input[name=centre]').inputValue()==='10000000-0000-4000-8000-000000000002');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('[data-nav=learning]').first().click();await page.locator('[data-filter=exam]').selectOption('F1');
  const teacherLearner=await page.evaluate(()=>globalThis.__massLiveReviewData.students.find(s=>s.centre==='10000000-0000-4000-8000-000000000002'&&s.enrolled<='2026-05-15'&&!s.exitDate&&!globalThis.__massLiveReviewData.assessmentDetails[s.id+'|F1'])?.id);
  check(Boolean(teacherLearner));await page.locator('[data-action=enter-marks]').click();await page.locator('[name=date]').fill('2026-05-15');await page.locator('#dialog-form [type=submit]').click();await page.getByRole('heading',{name:'Enter F1 marks',exact:true}).waitFor();await page.locator(`[name="score_${teacherLearner}"]`).fill('20');await page.getByRole('button',{name:'Save assessment',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});checks++;

 }
 check(errors.length===0);check(process.env.MASS_TEST_MULTI_ROLE==='1'?await page.locator('#role:not([disabled])').count()===1:await page.locator('[data-register-mark]').count()>0);
 console.log(`PASS ${checks} browser assertions: chart-first landing, draft-only clicks, atomic Save, refreshed summary, correction, reload persistence, discard, audited deletion, scoped CO and read-only Leadership, mobile layout.`);
}catch(error){console.error(error);if(screenshots){await fs.mkdir(screenshots,{recursive:true});for(const [index,page] of browser.contexts().flatMap(c=>c.pages()).entries())await page.screenshot({path:path.join(screenshots,'failure-'+index+'.png'),fullPage:true});}console.error('Last RPCs',calls.slice(-8).map(c=>c.name));process.exitCode=1;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();await fs.rm(output,{recursive:true,force:true});}
