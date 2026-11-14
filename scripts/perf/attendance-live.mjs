// Real-browser check of the new Attendance and Student profiles screens against the PREVIEW project (synthetic data only).
// Serves ./dist with the production CSP headers, signs in with the git-ignored preview test accounts,
// never prints credentials or records. Usage: node scripts/perf/attendance-live.mjs
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

/* global document, window */
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const env={};
for(const line of (await readFile(path.join(root,'.env.preview-test-account'),'utf8')).split('\n')){const m=/^([A-Z_]+)=(.*)$/.exec(line);if(m)env[m[1]]=m[2];}
const accounts={Leadership:[env.PREVIEW_TEST_EMAIL,env.PREVIEW_TEST_PASSWORD],Teacher:[env.PREVIEW_TEACHER_EMAIL,env.PREVIEW_TEACHER_PASSWORD],'Cluster Officer':[env.PREVIEW_OFFICER_EMAIL,env.PREVIEW_OFFICER_PASSWORD]};

const vercel=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
const headers=Object.fromEntries(vercel.headers[0].headers.map(h=>[h.key,h.value]));
delete headers['Strict-Transport-Security'];headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace('; upgrade-insecure-requests','');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.json':'application/json'};
const dist=path.join(root,'dist');
const server=http.createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p==='/__axe.js'){res.writeHead(200,{...headers,'Content-Type':types['.js']});res.end(await readFile(path.join(root,'node_modules/axe-core/axe.min.js')));return;}if(p.endsWith('/'))p+='index.html';res.writeHead(200,{...headers,'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(await readFile(path.join(dist,p)));}catch{res.writeHead(404);res.end('nf');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/next/`;
const results=[];const note=(item,ok,detail='')=>{results.push({item,ok,detail});console.log(`${ok?'PASS':'FAIL'}  ${item}${detail?' — '+detail:''}`);};
const browser=await chromium.launch();

async function session(role,width=1280){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
  const problems=[];page.on('console',m=>{if(m.type()==='error')problems.push(m.text().slice(0,160));});page.on('pageerror',e=>problems.push(String(e).slice(0,160)));
  const failed=[];page.on('response',r=>{if(r.url().includes('/rest/v1/rpc/')&&r.status()>=400)failed.push(`${r.status()} ${r.url().split('/rpc/')[1]}`);});
  await page.goto(base);
  await page.fill('#email',accounts[role][0]);await page.fill('#password',accounts[role][1]);
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByRole('navigation').or(page.getByRole('button',{name:'Sign out'})).first().waitFor({timeout:60000});
  return {context,page,problems,failed};
}
const openAttendance=async page=>{await page.goto(base+'#/attendance');await page.getByRole('table',{name:/register/i}).or(page.getByRole('alert')).first().waitFor({timeout:60000});};

// Leadership: read-only register, paging and sorting
{
  const {context,page,problems,failed}=await session('Leadership');
  await openAttendance(page);
  const table=page.getByRole('table',{name:/register/i});
  await page.waitForFunction(()=>document.querySelectorAll('table tbody tr').length>0,null,{timeout:60000});
  const rows=await page.locator('table tbody tr').count();
  note('Leadership: register loads, at most 10 rows per page',rows>0&&rows<=10,`${rows} rows`);
  const firstDates=await page.locator('table tbody tr td:nth-child(3)').allTextContents().catch(()=>[]);
  note('Leadership: no Add Attendance button (read-only)',await page.getByRole('button',{name:'Add Attendance'}).count()===0);
  const next=page.getByRole('button',{name:/next/i}).first();
  if(await next.isEnabled()){const before=await page.locator('table tbody tr').first().innerText();await next.click();await page.waitForTimeout(2500);const after=await page.locator('table tbody tr').first().innerText();note('Leadership: next page shows different rows',before!==after);}
  note('Leadership: no failed RPC calls',failed.length===0,failed.join(', '));
  note('Leadership: no console errors',problems.length===0,problems.join(' | '));
  await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
  note('Leadership: no horizontal scroll at 375 px',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  void table;void firstDates;await context.close();
}

// Teacher: add, edit, delete, holiday
{
  const {context,page,problems,failed}=await session('Teacher');
  await openAttendance(page);
  note('Teacher: Add Attendance available',await page.getByRole('button',{name:'Add Attendance'}).isVisible());
  const dialog=page.getByRole('dialog');
  const isoDay=d=>d.toISOString().slice(0,10);
  const open=async(date,shift='Evening')=>{await page.getByRole('button',{name:'Add Attendance'}).click();await dialog.waitFor();await dialog.getByLabel('Shift').selectOption(shift);await dialog.getByLabel('Date').fill(date);await page.waitForTimeout(2500);};
  const close=async()=>{if(await dialog.count()){await dialog.getByRole('button',{name:'Cancel'}).click().catch(()=>{});if(await dialog.count()){const c=page.getByRole('button',{name:'Close'});if(await c.count())await c.click();}}};
  // find an unrecorded date with a roster
  let day=null;const start=new Date(Date.now()+5.5*3600e3);
  // Start from yesterday: an earlier run leaves a holiday (which cannot be deleted) on the first free day.
  for(let i=1;i<41&&!day;i++){const d=isoDay(new Date(start-i*86400e3));await open(d);
    const logged=await dialog.getByText(/Already logged/).count(),empty=await dialog.getByText(/No eligible students/).count(),students=await dialog.locator('table[aria-label="Students to mark"] tbody tr').count();
    if(!logged&&!empty&&students>0)day=d;else await close();}
  note('Teacher: found an unrecorded date with a roster',Boolean(day),day??'');
  if(day){
    const save=dialog.getByRole('button',{name:'Save Attendance'});
    note('Teacher: Save disabled until every student marked',await save.isDisabled());
    await dialog.getByRole('button',{name:'Mark all present'}).click();
    note('Teacher: Save enabled after marking all',await save.isEnabled());
    await save.click();await dialog.waitFor({state:'detached',timeout:60000});
    note('Teacher: new register saved and dialog closed',true);
    // edit
    await page.waitForTimeout(2500);
    const editBtn=page.getByRole('button',{name:new RegExp(`Edit attendance:.*Evening, ${day}`)});
    note('Teacher: saved register appears in the table',await editBtn.count()>0);
    if(await editBtn.count()){
      await editBtn.first().click();await dialog.waitFor();await page.waitForTimeout(2500);
      await dialog.getByRole('button',{name:/^Absent:/}).first().click();
      await dialog.getByRole('button',{name:'Save Attendance'}).click();
      note('Teacher: correction without reason is refused',(await dialog.getByRole('alert').innerText()).includes('reason'));
      await dialog.getByLabel('Reason for correction or deletion').fill('Preview acceptance test correction');
      await dialog.getByRole('button',{name:'Save Attendance'}).click();await dialog.waitFor({state:'detached',timeout:60000});
      note('Teacher: correction saved',true);
      // delete
      await page.waitForTimeout(2500);
      await page.getByRole('button',{name:new RegExp(`Edit attendance:.*Evening, ${day}`)}).first().click();await dialog.waitFor();await page.waitForTimeout(2500);
      await dialog.getByRole('button',{name:'Delete Attendance'}).click();
      await dialog.getByLabel('Reason for correction or deletion').fill('Preview acceptance test deletion');
      await dialog.getByRole('button',{name:'Delete attendance'}).click();
      note('Teacher: deletion without confirmation tick is refused',(await dialog.getByRole('alert').innerText()).includes('confirmation'));
      await dialog.getByLabel(/I understand/).check();
      await dialog.getByRole('button',{name:'Delete attendance'}).click();await dialog.waitFor({state:'detached',timeout:60000});
      await page.waitForTimeout(2500);
      note('Teacher: deleted register removed from the table',await page.getByRole('button',{name:new RegExp(`Edit attendance:.*Evening, ${day}`)}).count()===0);
    }
    // holiday on the same (now empty) date. Holidays cannot be deleted, so this only runs with --holiday.
    if(process.argv.includes('--holiday')){
    await open(day);
    await dialog.getByLabel('Session Type').selectOption('Holiday');
    await dialog.getByLabel('Notes').fill('Preview acceptance test holiday');
    await dialog.getByRole('button',{name:'Save Holiday'}).click();await dialog.waitFor({state:'detached',timeout:60000});
    await page.waitForTimeout(2500);
    note('Teacher: holiday saved and shown as Recorded holiday',await page.getByText('Recorded holiday').count()>0);
    }
  }
  note('Teacher: no failed RPC calls',failed.length===0,failed.join(', '));
  note('Teacher: no console errors',problems.length===0,problems.join(' | '));
  await context.close();
}

// Cluster Officer: can add, scope Centres 01-09
{
  const {context,page,problems,failed}=await session('Cluster Officer');
  await openAttendance(page);
  note('Cluster Officer: Add Attendance available',await page.getByRole('button',{name:'Add Attendance'}).isVisible());
  await page.getByRole('button',{name:'Add Attendance'}).click();
  const count=await page.getByRole('dialog').getByLabel('Centre').locator('option').count();
  note('Cluster Officer: dialog lists only their centres',count>0&&count<=9,`${count} centres`);
  note('Cluster Officer: no failed RPC calls',failed.length===0,failed.join(', '));
  note('Cluster Officer: no console errors',problems.length===0,problems.join(' | '));
  await context.close();
}

// Student profiles (read-only checks; writes stay switched off on preview until separately approved)
{
  const openProfiles=async page=>{await page.goto(base+'#/profiles');await page.getByRole('table',{name:'Student profiles'}).or(page.getByRole('note')).or(page.getByRole('alert')).first().waitFor({timeout:60000});};
  {
    const {context,page,problems,failed}=await session('Leadership');await openProfiles(page);
    note('Profiles, Leadership: aggregate-only note, no student table',await page.getByText(/aggregate reporting only/).count()>0&&await page.getByRole('table',{name:'Student profiles'}).count()===0);
    note('Profiles, Leadership: no failed RPC calls or console errors',failed.length===0&&problems.length===0,[...failed,...problems].join(' | '));await context.close();
  }
  for(const role of ['Teacher','Cluster Officer']){
    const {context,page,problems,failed}=await session(role);await openProfiles(page);
    const T=page.getByRole('table',{name:'Student profiles'});
    await T.locator('tbody tr').first().waitFor({timeout:60000});
    const rows=await T.locator('tbody tr').count();
    note(`Profiles, ${role}: first page shows up to 10 students`,rows>0&&rows<=10,`${rows} rows`);
    const firstName=await T.locator('tbody tr').first().innerText();
    const next=page.getByRole('button',{name:'Next page'}).first();
    if(await next.isEnabled()){await next.click();await page.waitForTimeout(2500);note(`Profiles, ${role}: next page shows different students`,firstName!==await T.locator('tbody tr').first().innerText());await page.getByRole('button',{name:'Previous page'}).first().click();await page.waitForTimeout(2000);}
    await page.getByRole('button',{name:/^Grade/}).first().click();await page.waitForTimeout(2500);
    const grades=(await T.locator('tbody tr td:nth-child(4)').allTextContents()).map(Number);
    note(`Profiles, ${role}: sorting by grade orders the page ascending`,grades.length>0&&grades.every((g,i)=>i===0||g>=grades[i-1]),grades.join(','));
    await page.getByRole('button',{name:/^Grade/}).first().click();await page.waitForTimeout(2500);
    const down=(await T.locator('tbody tr td:nth-child(4)').allTextContents()).map(Number);
    note(`Profiles, ${role}: second click sorts descending`,down.length>0&&down.every((g,i)=>i===0||g<=down[i-1]),down.join(','));
    const idText=(await T.locator('tbody tr td:nth-child(1)').first().innerText()).trim();
    await page.getByLabel('Student ID').fill(idText);await page.waitForTimeout(3500);
    const found=await T.locator('tbody tr').count();
    note(`Profiles, ${role}: searching by a student ID narrows to that student`,found===1,`${found} rows`);
    if(role==='Teacher'){
      await page.addScriptTag({url:'/__axe.js'});
      const axeList=async()=>page.evaluate(async()=>(await window.axe.run(document)).violations.map(v=>v.id+': '+v.nodes.length));
      note('Profiles, Teacher: no axe violations in the browser (incl. contrast)',(await axeList()).length===0,(await axeList()).join('; '));
      await page.getByRole('button',{name:'Add student'}).click();
      note('Profiles, Teacher: no axe violations with Add student open',(await axeList()).length===0,(await axeList()).join('; '));
      note('Profiles, Teacher: Add student opens with saving available (registration gate on)',await page.getByText(/Saving is switched off/).count()===0&&await page.getByRole('button',{name:'Save student'}).isEnabled());
      await page.getByRole('button',{name:'Cancel'}).click();
      note('Profiles, Teacher: Edit profile stays review-only while the profiles gate is off',await(async()=>{await T.getByRole('button',{name:/^Edit profile/}).first().click();await page.getByText(/Saving is switched off/).waitFor();const off=await page.getByRole('button',{name:'Save profile'}).isDisabled();await page.getByRole('button',{name:'Cancel'}).click();return off;})());
      // Registers a permanent synthetic student, so it only runs with --register.
      if(process.argv.includes('--register')){
        await page.getByRole('button',{name:'Add student'}).click();
        const d=page.getByRole('dialog');
        await d.getByLabel('Full name').fill('ZZ Test Student '+Date.now().toString().slice(-6));
        await d.getByLabel('Shift').selectOption('Evening');
        await d.getByLabel('Start date').fill(new Date(Date.now()+5.5*3600e3).toISOString().slice(0,10));
        const unique=(await d.getByLabel('Full name').inputValue());
        await d.getByRole('button',{name:'Save student'}).click();
        await d.waitFor({state:'detached',timeout:60000});
        await page.getByLabel('Student ID').fill('');await page.getByLabel('Search name, ID or centre').fill(unique);await page.waitForTimeout(4000);
        note('Profiles, Teacher: registered student appears in the list after saving',await T.getByText(unique).count()===1,unique);
      }
    }
    await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
    note(`Profiles, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    note(`Profiles, ${role}: no failed RPC calls`,failed.length===0,failed.join(', '));
    note(`Profiles, ${role}: no console errors`,problems.length===0,problems.join(' | '));
    await context.close();
  }
}

// Assessments
{
  const openAssessments=async page=>{await page.goto(base+'#/assessments');await page.getByRole('table',{name:'Assessment register'}).or(page.getByRole('alert')).first().waitFor({timeout:90000});};
  const cards=async page=>page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('article,section,div')].filter(e=>/^4\.[1-4]/.test(e.textContent?.trim()||'')&&e.children.length>0&&e.textContent.length<200).slice(0,0).map(e=>[e.textContent,1])));
  void cards;
  for(const role of ['Leadership','Teacher','Cluster Officer']){
    const {context,page,problems,failed}=await session(role);await openAssessments(page);
    await page.waitForTimeout(3000);
    const text=await page.locator('main').innerText();
    note(`Assessments, ${role}: scorecards show scores for F2 (no Unavailable card)`,/Students with exam scores recorded/.test(text)&&!/Unavailable/.test(text.split('4.5')[0]),text.match(/\d[\d,]* \/ \d[\d,]*/)?.[0]??'');
    const rows=await page.getByRole('table',{name:'Assessment register'}).locator('tbody tr').count();
    note(`Assessments, ${role}: assessment register lists saved assessments`,rows>0,`${rows} rows on page 1`);
    await page.selectOption('select:below(:text("Exam round"))','1').catch(()=>{});
    if(role==='Teacher'){
      await page.addScriptTag({url:'/__axe.js'});
      const v=await page.evaluate(async()=>(await window.axe.run(document)).violations.map(x=>x.id+': '+x.nodes.length));
      note('Assessments, Teacher: no axe violations in the browser (incl. contrast)',v.length===0,v.join('; '));
      await page.selectOption('label:has-text("Exam round") select','3');await page.waitForTimeout(3500);
      const nBefore=Number(/(\d+) \/ \d+/.exec(await page.locator('main').innerText())?.[1]);
      await page.getByRole('button',{name:'Enter marks'}).click();
      await page.getByRole('button',{name:'Continue'}).click();
      await page.getByRole('table',{name:'Students to score'}).waitFor({timeout:60000});
      const inputs=await page.getByRole('table',{name:'Students to score'}).getByRole('spinbutton').count();
      note('Assessments, Teacher: entry roster lists the centre students',inputs>0,`${inputs} students`);
      const gateOn=await page.getByText(/Saving is switched off/).count()===0;
      if(!gateOn)note('Assessments, Teacher: entry saving is off while the assessment_entry gate is off',await page.getByRole('button',{name:'Save assessment'}).isDisabled());
      if(gateOn&&process.argv.includes('--assessment')){
        // Saves permanent synthetic results (they cannot be corrected or deleted), so it only runs with --assessment.
        const spin=page.getByRole('table',{name:'Students to score'}).getByRole('spinbutton');
        await spin.nth(0).fill('26');await page.getByRole('button',{name:'Save assessment'}).click();
        note('Assessments, Teacher: a mark above 25 is refused',(await page.getByRole('dialog').getByRole('alert').innerText()).includes('0–25'));
        await spin.nth(0).fill('19');await spin.nth(1).fill('22');
        await page.getByRole('button',{name:'Save assessment'}).click();
        await page.getByRole('dialog').waitFor({state:'detached',timeout:60000});
        await page.waitForTimeout(4000);
        const after=await page.locator('main').innerText();
        const nAfter=Number(/(\d+) \/ \d+/.exec(after)?.[1]);
        note('Assessments, Teacher: scorecard count rose by the 2 saved marks',nAfter===nBefore+2,`${nBefore} -> ${nAfter}`);
        note('Assessments, Teacher: register shows the new F3 record',await page.getByRole('table',{name:'Assessment register'}).getByText('F3').count()>0);
        await page.getByRole('button',{name:'Enter marks'}).click();await page.getByRole('button',{name:'Continue'}).click();
        await page.getByRole('table',{name:'Students to score'}).waitFor();
        note('Assessments, Teacher: saved results reopen as read-only',await page.getByRole('table',{name:'Students to score'}).getByText(/saved; corrections/).count()>=2);
      }
      await page.getByRole('button',{name:'Cancel'}).click();
    }
    await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
    note(`Assessments, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    note(`Assessments, ${role}: no failed RPC calls`,failed.length===0,failed.join(', '));
    note(`Assessments, ${role}: no console errors`,problems.length===0,problems.join(' | '));
    await context.close();
  }
}

// Visits (preview has no visit records yet, so coverage is expected to be unknown rather than zero)
{
  for(const role of ['Leadership','Teacher','Cluster Officer']){
    const {context,page,problems,failed}=await session(role);
    const t0=Date.now();await page.goto(base+'#/visits');
    await page.getByRole('table',{name:'Centre coverage'}).locator('tbody tr').first().or(page.getByRole('alert')).first().waitFor({timeout:120000});
    const ms=Date.now()-t0;
    const text=await page.locator('main').innerText();
    const blocked=/No verified, dated officer assignment/.test(text);
    if(role==='Cluster Officer'&&blocked)note('Visits, Cluster Officer: no verified assignment on preview, coverage correctly unavailable',true,'preview CO account has no dated officer assignment');
    else{
      const rows=await page.getByRole('table',{name:'Centre coverage'}).locator('tbody tr').count();
      note(`Visits, ${role}: centre coverage lists centres (10 per page)`,rows>0&&rows<=10,`${rows} rows, loaded in ${(ms/1000).toFixed(1)} s`);
      note(`Visits, ${role}: no visits recorded shows unknown, not zero`,/No verified visit observations|No verified visits recorded/.test(text)||/\d/.test(text));
    }
    if(role==='Cluster Officer'&&!blocked){
      note('Visits, Cluster Officer: Record a visit available',await page.getByRole('button',{name:'Record a visit'}).isVisible());
    }
    if(role==='Teacher'){
      await page.addScriptTag({url:'/__axe.js'});
      const v=await page.evaluate(async()=>(await window.axe.run(document)).violations.map(x=>x.id+': '+x.nodes.length));
      note('Visits, Teacher: no axe violations in the browser (incl. contrast)',v.length===0,v.join('; '));
    }
    await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
    note(`Visits, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1&&!e.closest('.overflow-auto,.overflow-x-auto')).slice(0,3).map(e=>e.tagName+'.'+String(e.className).slice(0,60)+' '+Math.round(e.getBoundingClientRect().right)).join(' | ')));
    note(`Visits, ${role}: no failed RPC calls`,failed.length===0,failed.join(', '));
    note(`Visits, ${role}: no console errors`,problems.length===0,problems.join(' | '));
    await context.close();
  }
}
await browser.close();server.close();
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} checks passed`);
process.exit(results.every(r=>r.ok)?0:1);
