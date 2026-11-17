// Captures rendered values only. Never calls reporting RPCs to manufacture the dashboard column.
// Credentials/session state are supplied locally through env; neither is written to audit output.
/* global document */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {CATALOG,CUTOFF,validateScenario} from './core.mjs';
const args=process.argv.slice(2),opt=(n,d=null)=>{const i=args.indexOf('--'+n);return i<0?d:args[i+1];};
if(!opt('reference'))throw Error('--reference is required');
const reference=JSON.parse(await readFile(opt('reference'),'utf8')),scenario=validateScenario(reference.scenario);
const base=opt('base-url',scenario.environment==='production'?'https://mass-cac-dashboard.vercel.app':'https://preview-mass-cac-dashboard.vercel.app').replace(/\/$/,'');
const host=new URL(base);if(host.protocol!=='https:'||!(host.hostname==='mass-cac-dashboard.vercel.app'||host.hostname==='preview-mass-cac-dashboard.vercel.app'||/^mass-cac-dashboard-[a-z0-9-]+-mass-data-dashboard\.vercel\.app$/.test(host.hostname)))throw Error('Use the verified MASS deployment hostname.');
const out=path.resolve(opt('out','audit-runs/october-2026'));await mkdir(out,{recursive:true,mode:0o700});
const result={referenceFingerprint:reference.fingerprint,schemaVersion:1,cutoff:CUTOFF,project:reference.project,scenario,capturedAt:new Date().toISOString(),dashboardUrl:base,dashboardCommit:null,cells:[],issues:[],cachePolicy:'Fresh isolated browser context; hard reload per page; no cached session data reused.'};
const email=process.env.MASS_AUDIT_EMAIL,password=process.env.MASS_AUDIT_PASSWORD,state=process.env.MASS_AUDIT_STORAGE_STATE;
const save=()=>writeFile(path.join(out,'dashboard.json'),JSON.stringify(result,null,2),{mode:0o600});
if(!state&&(!email||!password)){result.issues.push('Authorized dashboard sign-in credentials or storage state are required for actual browser captures. No values were fabricated.');await save();console.log(result.issues[0]);process.exitCode=2;}
else {
 let options={headless:true};
 if(process.env.MASS_CHROMIUM_MODULE){const {default:runtime}=await import(process.env.MASS_CHROMIUM_MODULE);options={...options,executablePath:await runtime.executablePath(),args:runtime.args};}
 if(process.env.MASS_CHROMIUM_EXECUTABLE)options.executablePath=process.env.MASS_CHROMIUM_EXECUTABLE;
 const browser=await chromium.launch(options),context=await browser.newContext({storageState:state||undefined,viewport:{width:1440,height:1000}});
 try {
  // Only block writes; Auth requests remain available for the requested sign-in.
  await context.route('**/rest/v1/rpc/**',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop();
   if(/^(save_|delete_|record_|register_|correct_|add_|transfer_|create_|close_)/.test(name))await route.abort('blockedbyclient');else await route.continue();
  });
  const page=await context.newPage();
  const response=await context.request.get(base+'/release.json');if(!response.ok())throw Error('Deployment protection blocks the exact URL; supply an authenticated deployment URL/session.');
  const release=await response.json();if(release.project!==reference.project)throw Error('Dashboard and reference use different database projects.');
  result.dashboardCommit=release.commit;if(!/^[a-f0-9]{40}$/.test(release.commit||''))throw Error('Deployment commit is not verifiable.');
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  if(await page.locator('#email').count()){if(!email||!password)throw Error('The supplied dashboard session expired.');await page.locator('#email').fill(email);await page.locator('#password').fill(password);await page.getByRole('button',{name:/sign in/i}).click();}
  const settle=async()=>{await page.locator('main h1').waitFor({timeout:90000});await page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]')&&![...document.querySelectorAll('main [role="status"]')].some(e=>/loading|preparing|checking/i.test(e.textContent||'')),null,{timeout:90000});};
  await settle();const roles=page.locator('header select');if(await roles.count())await roles.selectOption(scenario.role);await settle();
  const pages={Overview:'overview',Attendance:'attendance',Profiles:'profiles',Assessments:'assessments',Visits:'visits',Morarji:'morarji','Donor summary':'donors'};
  for(const [group,route] of Object.entries(pages)){
   const metrics=CATALOG.filter(m=>m.page===group&&m.roles.includes(scenario.role));if(!metrics.length)continue;
   try {
    // A hard reload gives each page a new in-memory report/read cache.
    const contextResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/rpc/get_context')&&r.ok(),{timeout:60000});
    await page.goto(base+'/#/'+route,{waitUntil:'domcontentloaded'});await settle();
    const authorization=await (await contextResponse).json();
    const roleControl=page.locator('header select');if(await roleControl.count())await roleControl.selectOption(scenario.role);await settle();
    const authorized=authorization.centres?.filter(c=>c.roles?.includes(scenario.role))||[];if(scenario.centres.some(c=>!authorized.some(a=>a.id===c.id)))throw Error('Reference centre scope is outside the verified role assignments.');
    const month=page.getByLabel('Reporting month');
    if(await month.count()){await month.selectOption(scenario.month);await settle();}
    else {const note=group+': no historical reporting-date control; current page cannot certify the October roster/cutoff.';result.issues.push(note);for(const metric of metrics){const facts=reference.facts.filter(f=>f.key===metric.source);for(const f of (facts.length?facts:[{dimension:'All'}]))result.cells.push({metric:metric.id,dimension:f.dimension||'All',state:'cutoff',display:null,note});}continue;}
    const centre=page.getByLabel('Centre');
    // Verify the role's full readable centre set before selecting any subset.
    if(await centre.count()){
     const allowed=await centre.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
     if(scenario.centres.some(c=>!allowed.includes(c.id)))throw Error('Reference contains centres outside this dashboard role.');
     if(scenario.centres.length===1)await centre.selectOption(scenario.centres[0].id);
     else {if(allowed.length!==scenario.centres.length)throw Error('Dashboard cannot select this multi-centre subset exactly.');await centre.selectOption('');}
    } else {const p=metrics.find(m=>m.id==='OV02');if(p&&scenario.centres.length!==1)throw Error('Single-centre view does not prove the reference scope.');}
    for(const [key,label] of [['shift','Shift'],['grade','Grade'],['gender','Gender'],['donor','Donor']]){const field=page.getByLabel(label);if(await field.count())await field.selectOption(scenario[key]||'');else if(scenario[key])throw Error('This page does not implement the selected '+key+' filter.');}
    if(group==='Assessments'){const round=page.getByLabel('Exam round');if(await round.count())await round.selectOption(String(scenario.round));const pair=page.getByLabel('Compare rounds');if(await pair.count())await pair.selectOption(`${scenario.earlier}-${scenario.later}`);}
    await settle();
    const tables=new Map();
    for(const metric of metrics){
     const root=page.locator(`[data-audit-ref="${metric.ref}"]`);
     if(!await root.count())continue;
     if(metric.kind==='card'){
      const value=root.locator('[data-audit-display]');const ready=await value.count()>0;
      result.cells.push({metric:metric.id,dimension:'All',state:ready?'ready':'unavailable',display:ready?await value.innerText():null,note:ready?'':'The rendered card is unavailable.'});
     }else if(['chart','line'].includes(metric.kind)){
      const titles=await root.locator('svg title').allTextContents();
      for(const text of titles){const pos=text.lastIndexOf(':');if(pos>=0)result.cells.push({metric:metric.id,dimension:text.slice(0,pos).trim(),state:'ready',display:text.slice(pos+1).trim()});}
     }else if(metric.kind==='definition'){
      const labels={AS09:'Matched students',AS10:'Improved',AS11:'Unchanged',AS12:'Declined',AS13:'Average change (marks)'};
      const values=await root.locator('dl').evaluateAll(nodes=>nodes.flatMap(n=>[...n.querySelectorAll('dt')].map(dt=>({label:dt.textContent,value:dt.nextElementSibling?.textContent}))));
      const cell=values.find(v=>v.label===labels[metric.id]);if(cell)result.cells.push({metric:metric.id,dimension:'All',state:'ready',display:cell.value});
     }else if(metric.column||metric.kind==='rowcount'){
      let data=tables.get(metric.ref);
      if(!data){data=[];for(let n=0;n<10000;n++){
       const heads=await root.locator('thead th').allTextContents(),rows=await root.locator('tbody tr').evaluateAll(nodes=>nodes.map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent?.trim()||'')));
       data.push(...rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h.trim().replace(/[↑↓↕]/g,'').trim(),r[i]]))));
       const next=root.getByRole('button',{name:'Next page',exact:true});if(!await next.count()||!await next.isEnabled())break;
       const before=await root.locator('tbody').innerText();await next.click();await settle();await page.waitForFunction(({ref,before})=>document.querySelector(`[data-audit-ref="${ref}"] tbody`)?.textContent?.replace(/\s+/g,' ').trim()!==before.replace(/\s+/g,' ').trim(),{ref:metric.ref,before});
      }tables.set(metric.ref,data);}
      if(metric.kind==='rowcount')result.cells.push({metric:metric.id,dimension:'All',state:'ready',display:String(data.length)});
      else for(const row of data){const dimension=metric.kind==='register'?[row.Centre,row.Shift,row.Date].join(' | '):metric.kind==='assessment-register'?[row.Centre,row.Shift,row['Assessment date'],row.Round].join(' | '):row.Centre||row.Officer||row.Cohort; if(dimension&&Object.hasOwn(row,metric.column))result.cells.push({metric:metric.id,dimension,state:'ready',display:row[metric.column]});}
     }
    }
    // Evidence crops exclude individual profile rows and free-text visit logs.
    for(const ref of [...new Set(metrics.filter(m=>['card','chart','line'].includes(m.kind)).map(m=>m.ref))]){const target=page.locator(`[data-audit-ref="${ref}"]`);if(await target.count()){const filename=`${route}-${ref}.png`;await target.screenshot({path:path.join(out,filename)});for(const c of result.cells.filter(c=>metrics.some(m=>m.id===c.metric&&m.ref===ref)))c.evidence=filename;}}
   }catch(error){result.issues.push(group+': '+(error instanceof Error?error.message:'Capture failed.'));}
  }
  try {
   await page.goto(base+'/vanilla/',{waitUntil:'domcontentloaded'});await page.locator('[data-nav=activities]').first().waitFor({timeout:60000});
   const roleSelect=page.locator('[data-role-select]');if(await roleSelect.count())await roleSelect.selectOption(scenario.role);
   await page.locator('[data-nav=activities]').first().click();
   await page.locator('[data-filter=month]').selectOption(scenario.month);
   const centre=page.locator('[data-filter=centre]');if(await centre.count()){
    const ids=await centre.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
    if(scenario.centres.length===1)await centre.selectOption(scenario.centres[0].id);else if(ids.length!==scenario.centres.length||scenario.centres.some(c=>!ids.includes(c.id)))throw Error('Legacy centre scope differs from reference.');
   }
   await page.waitForFunction(()=>![...document.querySelectorAll('[role=status]')].some(e=>/loading/i.test(e.textContent||'')),null,{timeout:90000});
   for(const m of CATALOG.filter(m=>m.page==='Activities / MM'&&m.legacyLabel)){
    const card=page.locator('.metric').filter({has:page.locator('.metric-top').filter({hasText:m.legacyLabel})});
    if(await card.count()){const display=await card.first().locator('.metric-value').innerText();result.cells.push({metric:m.id,dimension:'All',state:/[0-9]/.test(display)?'ready':'unavailable',display});}
   }
   const categories=await page.locator('[data-chart="11"] .bar-row').evaluateAll(nodes=>nodes.map(n=>({dimension:n.firstElementChild?.textContent?.trim(),display:n.querySelector('.bar-value')?.textContent?.trim()})));
   for(const c of categories)result.cells.push({metric:'AC05',...c,state:'ready'});
   const summary=page.locator('section').filter({has:page.getByRole('heading',{name:'Centre Activities & Monthly Meetings',exact:true})});
   if(await summary.count()){const rows=await summary.locator('tbody tr').evaluateAll(nodes=>nodes.map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent?.trim())));for(const r of rows)for(const [metric,n] of [['AC12',1],['AC13',2]])result.cells.push({metric,dimension:r[0],display:r[n],state:'ready'});}
  }catch(error){result.issues.push('Activities / MM: '+(error instanceof Error?error.message:'Capture failed.'));}
  // Empty/unavailable chart states remain explicit, never synthetic zeros.
  result.capturedAt=new Date().toISOString();await save();console.log(`Captured ${result.cells.length} displayed cells; ${result.issues.length} pages or prerequisites need review.`);
 } finally {await context.close();await browser.close();}
}
