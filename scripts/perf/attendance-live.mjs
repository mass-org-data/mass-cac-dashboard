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
const origin=`http://127.0.0.1:${server.address().port}`;
const base=`${origin}/`;
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
  await table.locator('tbody tr').first().waitFor({timeout:60000});
  const rows=await table.locator('tbody tr').count();   // the register table only: faster pages can show another table at the same time
  note('Leadership: register loads, at most 10 rows per page',rows>0&&rows<=10,`${rows} rows`);
  const firstDates=await page.locator('table tbody tr td:nth-child(3)').allTextContents().catch(()=>[]);
  note('Leadership: no Add Attendance button (read-only)',await page.getByRole('button',{name:'Add Attendance'}).count()===0);
  const next=page.getByRole('button',{name:/next/i}).first();
  if(await next.isEnabled()){const before=await page.locator('table tbody tr').first().innerText();await next.click();await page.waitForTimeout(2500);const after=await page.locator('table tbody tr').first().innerText();note('Leadership: next page shows different rows',before!==after);}
  note('Leadership: no failed RPC calls',failed.length===0,failed.join(', '));
  note('Leadership: no console errors',problems.length===0,problems.join(' | '));
  await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
  note('Leadership: no horizontal scroll at 375 px',await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))));
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
    const greyed=(await page.getByRole('navigation',{name:'Primary'}).locator('[aria-disabled="true"]').allInnerTexts()).map(t=>t.replace(/\s*\(unavailable:.*$/s,'').trim());
    const wantedGreyed={Leadership:['3. Student profiles'],Teacher:['5. Visits','7. Annual donor summary'],'Cluster Officer':['7. Annual donor summary']}[role];
    note(`Navigation, ${role}: unavailable screens stay in the menu, greyed out and not links`,JSON.stringify(greyed)===JSON.stringify(wantedGreyed),greyed.join(' | '));
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
    note(`Profiles, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))));
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
    note(`Assessments, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))));
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
    const blocked=/No verified, dated officer assignment|different officer identities/.test(text);
    if(role==='Cluster Officer'&&blocked)note('Visits, Cluster Officer: coverage correctly unavailable while the account is linked to several officer identities',true,text.match(/linked to \d+ different officer identities/)?.[0]??'');
    else{
      const rows=await page.getByRole('table',{name:'Centre coverage'}).locator('tbody tr').count();
      note(`Visits, ${role}: centre coverage lists centres (10 per page)`,rows>0&&rows<=10,`${rows} rows, loaded in ${(ms/1000).toFixed(1)} s`);
      const total=Number(/(\d[\d,]*)\s*Standard target/.exec(text.replace(/\n+/g,' '))?.[1]?.replace(/,/g,''));
      note(`Visits, ${role}: seeded visits show as completed counts, not unknown`,!/No verified visits recorded/.test(text.split('5.5')[0]),text.replace(/\s+/g,' ').match(/Visits completed [^S]*Standard target \d+/)?.[0]??'');
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
    note(`Visits, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))),await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1&&!e.closest('.overflow-auto,.overflow-x-auto')).slice(0,3).map(e=>e.tagName+'.'+String(e.className).slice(0,60)+' '+Math.round(e.getBoundingClientRect().right)).join(' | ')));
    note(`Visits, ${role}: no failed RPC calls`,failed.length===0,failed.join(', '));
    note(`Visits, ${role}: no console errors`,problems.length===0,problems.join(' | '));
    await context.close();
  }
}

// Morarji (preview has one synthetic 2026-27 cohort of 150 Grade 5 students; Centre 01 has none)
{
  const expected={Leadership:{members:150,attended:104,passed:39,pending:55},'Cluster Officer':null,Teacher:null};
  for(const role of ['Leadership','Teacher','Cluster Officer']){
    const {context,page,problems,failed}=await session(role);
    await page.goto(base+'#/morarji');
    await page.getByRole('table',{name:'Cohort sizes compared'}).locator('tbody tr').first().or(page.getByText('No verified cohort recorded').first()).waitFor({timeout:90000});
    await page.waitForTimeout(3000);
    const text=(await page.locator('main').innerText()).replace(/\s+/g,' ');
    const card=label=>new RegExp('6\\.\\d'+label+' ([\\d,]+|—)').exec(text)?.[1]?.replace(/,/g,'');
    const got={members:Number(card('Children in the training cohort')),attended:Number(card('Took the exam')),passed:Number(card('Children passed')),pending:Number(card('Results pending'))};
    if(expected[role])note(`Morarji, ${role}: cohort totals match the database`,JSON.stringify(got)===JSON.stringify(expected[role]),JSON.stringify(got));
    else if(role==='Teacher')note('Morarji, Teacher: Centre 01 has no grade 5 cohort members, so the totals are unknown, not zero',/No verified cohort recorded/.test(text)&&!/6\.1 Children in the training cohort 0/.test(text),JSON.stringify(got));
    else note('Morarji, Cluster Officer: cohort totals for Centres 01-09',got.members>0,JSON.stringify(got));
    if(role==='Leadership')note('Morarji, Leadership: no student rows (totals only)',await page.getByRole('table',{name:'Cohort follow-up'}).count()===0);
    if(role==='Cluster Officer'){
      const rows=await page.getByRole('table',{name:'Cohort follow-up'}).locator('tbody tr').count();
      note('Morarji, Cluster Officer: follow-up lists the cohort students of their centres (first page of 10)',rows===Math.min(10,got.members),`${rows} rows of ${got.members}`);
      const ids=await page.getByRole('table',{name:'Cohort follow-up'}).getByText(/^ST_SY_5_/).count();
      note('Morarji, Cluster Officer: students show by ID; names stay withheld because this account may not read profiles',ids===rows&&await page.getByRole('table',{name:'Cohort follow-up'}).getByText(/Synthetic Student/).count()===0,`${ids} ids`);
    }
    note(`Morarji, ${role}: no editing controls on this screen`,await page.getByRole('button',{name:/Add to training cohort|Update/}).count()===0);
    if(role==='Cluster Officer'){
      await page.addScriptTag({url:'/__axe.js'});
      const v=await page.evaluate(async()=>(await window.axe.run(document)).violations.map(x=>x.id+': '+x.nodes.length));
      note('Morarji, Cluster Officer: no axe violations in the browser (incl. contrast)',v.length===0,v.join('; '));
    }
    await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
    note(`Morarji, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))));
    note(`Morarji, ${role}: no failed RPC calls`,failed.length===0,failed.join(', '));
    note(`Morarji, ${role}: no console errors`,problems.length===0,problems.join(' | '));
    await context.close();
  }
}

// Annual donor summary (Leadership only)
{
  {
    const {context,page,problems,failed}=await session('Leadership');
    const t0=Date.now();await page.goto(base+'#/donors');
    const T=page.getByRole('table',{name:'Centre comparison'});
    await T.locator('tbody tr').first().waitFor({timeout:180000});
    await page.waitForFunction(()=>/across \d+ loaded months/.test(document.body.innerText),null,{timeout:180000});
    const ms=Date.now()-t0;
    const text=(await page.locator('main').innerText()).replace(/\s+/g,' ');
    note('Annual donor, Leadership: loads in a reasonable time',ms<30000,`${(ms/1000).toFixed(1)} s`);
    const pct=/7\.3Annual recorded attendance ([\d.]+)%/.exec(text)?.[1];
    note('Annual donor, Leadership: annual attendance equals the P/(P+A+L) total in the database',pct==='86.0',`page ${pct}% vs database 86.0%`);
    note('Annual donor, Leadership: 92 centres in the selection',/7\.1Centres in this selection 92/.test(text));
    const rows=await T.locator('tbody tr').count();
    note('Annual donor, Leadership: centre comparison shows ten centres per page',rows===10,`${rows} rows`);
    const dl=page.waitForEvent('download',{timeout:15000});
    await page.getByRole('button',{name:/Export CSV/}).click();
    const download=await dl;const csv=await (await import('node:fs/promises')).readFile(await download.path(),'utf8');
    note('Annual donor, Leadership: CSV has a header and one row per centre (92)',csv.trim().split('\n').length===93&&/Current donor association/.test(csv.split('\n')[0]),`${csv.trim().split('\n').length} lines`);
    await page.addScriptTag({url:'/__axe.js'});
    const v=await page.evaluate(async()=>(await window.axe.run(document)).violations.map(x=>x.id+': '+x.nodes.length));
    note('Annual donor, Leadership: no axe violations in the browser (incl. contrast)',v.length===0,v.join('; '));
    await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
    note('Annual donor, Leadership: no horizontal page scroll at 375 px',await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))));
    note('Annual donor, Leadership: no failed RPC calls',failed.length===0,failed.join(', '));
    note('Annual donor, Leadership: no console errors',problems.length===0,problems.join(' | '));
    await context.close();
  }
  {
    const {context,page}=await session('Teacher');await page.goto(base+'#/donors');
    await page.getByText(/part of Leadership reporting/).waitFor({timeout:60000});
    note('Annual donor, Teacher: Leadership-only note, no report',await page.getByRole('table',{name:'Centre comparison'}).count()===0);
    await context.close();
  }
}

// About, and the whole navigation
{
  for(const role of ['Leadership','Teacher','Cluster Officer']){
    const {context,page,problems,failed}=await session(role);
    await page.goto(base+'#/about');
    await page.getByRole('heading',{name:'Reporting rules'}).waitFor({timeout:60000});
    const text=(await page.locator('main').innerText()).replace(/\s+/g,' ');
    const expectedCentres={Leadership:92,Teacher:1,'Cluster Officer':9}[role];
    note(`About, ${role}: shows the verified role with its centre count`,new RegExp(role+' \\(active\\): '+expectedCentres+' centre').test(text),text.match(/Verified roles[^]*?(?=Reporting rules)/)?.[0]?.slice(0,160)??'');
    const nav=(await page.getByRole('navigation',{name:'Primary'}).getByRole('link').allInnerTexts()).map(t=>t.trim());
    const wanted={Leadership:['1. Overview','2. Attendance','4. Assessments','5. Visits','6. Morarji scholarship','7. Annual donor summary','8. About'],Teacher:['1. Overview','2. Attendance','3. Student profiles','4. Assessments','6. Morarji scholarship','8. About'],'Cluster Officer':['1. Overview','2. Attendance','3. Student profiles','4. Assessments','5. Visits','6. Morarji scholarship','8. About']}[role];
    note(`Navigation, ${role}: the side menu lists this role's screens with the original numbering`,JSON.stringify(nav.slice(0,wanted.length))===JSON.stringify(wanted)&&/Activities and monthly meetings/.test(nav.at(-1)),nav.join(' | '));
    if(role==='Teacher'){
      await page.addScriptTag({url:'/__axe.js'});
      const v=await page.evaluate(async()=>(await window.axe.run(document)).violations.map(x=>x.id+': '+x.nodes.length));
      note('About, Teacher: no axe violations in the browser (incl. contrast)',v.length===0,v.join('; '));
    }
    await page.setViewportSize({width:375,height:812});await page.waitForTimeout(500);
    note(`About, ${role}: no horizontal page scroll at 375 px`,await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))));
    note(`About, ${role}: no failed RPC calls`,failed.length===0,failed.join(', '));
    note(`About, ${role}: no console errors`,problems.length===0,problems.join(' | '));
    await context.close();
  }
}

// Shell: side menu, logo, default route and the original interface at /vanilla/
{
  const {context,page,problems,failed}=await session('Leadership');
  const logo=await page.locator('header img').boundingBox();
  note('Shell: the MASS logo in the header is large enough to read (at least 56 px high)',logo&&logo.height>=56,`${Math.round(logo?.width??0)} x ${Math.round(logo?.height??0)} px`);
  const aside=page.getByRole('complementary',{name:'Menu'});
  const wide=(await aside.boundingBox()).width;
  await page.getByRole('button',{name:'Collapse menu'}).click();
  await page.waitForTimeout(500);
  const narrow=(await aside.boundingBox()).width;
  note('Shell: the side menu collapses to icons and expands again',narrow<100&&wide>200&&await page.getByRole('button',{name:'Expand menu'}).getAttribute('aria-expanded')==='false',`${Math.round(wide)} px -> ${Math.round(narrow)} px`);
  note('Shell: collapsed menu items keep their names for assistive technology',await page.getByRole('link',{name:'2. Attendance'}).count()===1);
  await page.getByRole('link',{name:'2. Attendance'}).click();
  await page.waitForFunction(()=>window.location.hash==='#/attendance');
  const reload=await (async()=>{await page.reload();await page.getByRole('button',{name:'Expand menu'}).waitFor({timeout:60000});return true;})();
  note('Shell: the collapsed choice is remembered across a reload',reload);
  await page.getByRole('button',{name:'Expand menu'}).click();await page.waitForTimeout(400);
  {
    await page.getByRole('link',{name:'1. Overview'}).click();await page.waitForTimeout(3000);
    await page.setViewportSize({width:1280,height:700});await page.waitForTimeout(300);
    await page.locator('main').evaluate(m=>{m.scrollTop=m.scrollHeight;});await page.waitForTimeout(300);
    const header=await page.locator('header').boundingBox(),sideBox=await page.getByRole('complementary',{name:'Menu'}).boundingBox(),btn=await page.getByRole('button',{name:/menu$/}).last().boundingBox();
    note('Shell: header stays frozen at the top after scrolling the page',header.y===0,`header y=${header.y}`);
    note('Shell: side menu fills the height below the header and stays in place',Math.abs(sideBox.y-header.height)<2&&sideBox.y+sideBox.height<=700+1,`menu y=${Math.round(sideBox.y)} h=${Math.round(sideBox.height)}`);
    note('Shell: the collapse button is visible without scrolling, at the foot of the menu',btn.y>0&&btn.y+btn.height<=700&&btn.y>sideBox.y+sideBox.height-80,`button y=${Math.round(btn.y)}`);
    note('Shell: the page heading uses the menu numbering',/^1\. Overview$/.test((await page.getByRole('heading',{level:1}).innerText()).trim()),await page.getByRole('heading',{level:1}).innerText());
    const sizes=await page.evaluate(()=>({h1:window.getComputedStyle(document.querySelector('h1')).fontSize,menu:window.getComputedStyle(document.querySelector('#side-menu nav a')).fontSize}));
    note('Shell: heading text and number are one size',await page.locator('h1 span').count()===0,JSON.stringify(sizes));
  }
  note('Shell: the menu marks the open screen',await page.getByRole('link',{name:'1. Overview'}).getAttribute('aria-current')==='page'&&await page.getByRole('link',{name:'2. Attendance'}).getAttribute('aria-current')===null);
  await page.setViewportSize({width:375,height:812});await page.waitForTimeout(400);
  const hiddenOnPhone=!(await aside.isVisible())||(await aside.boundingBox()).x<0;
  note('Shell: on a phone the menu is hidden until opened',hiddenOnPhone);
  await page.getByRole('button',{name:'Open menu'}).click();await page.waitForTimeout(400);
  note('Shell: the phone menu opens with a scrim',(await aside.boundingBox()).x>=0&&await page.getByRole('button',{name:'Close menu'}).isVisible());
  await page.getByRole('link',{name:'5. Visits'}).click();await page.waitForTimeout(500);
  note('Shell: choosing a screen on a phone closes the menu',(await aside.boundingBox()).x<0&&await page.evaluate(()=>window.location.hash)==='#/visits');
  note('Shell: no horizontal page scroll at 375 px',await page.evaluate(()=>(document.documentElement.scrollWidth<=window.innerWidth+1&&(!document.querySelector('main')||document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1))));
  note('Shell: no failed RPC calls or console errors',failed.length===0&&problems.length===0,[...failed,...problems].join(' | '));
  await context.close();
  const ctx2=await browser.newContext();const p2=await ctx2.newPage();
  await p2.goto(origin+'/vanilla/');
  await p2.waitForSelector('#email, input[type=email], h1',{timeout:60000});
  note('Original interface: still served at /vanilla/ (its own title and sign-in)',(await p2.title())==='MASS · CAC Programme'&&await p2.locator('input[type=email], #email').count()>0,await p2.title());
  await ctx2.close();
}
await browser.close();server.close();
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} checks passed`);
process.exit(results.every(r=>r.ok)?0:1);
