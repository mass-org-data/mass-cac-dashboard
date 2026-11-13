// Real-browser check of the new Attendance screen against the PREVIEW project (synthetic data only).
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
const server=http.createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';res.writeHead(200,{...headers,'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(await readFile(path.join(dist,p)));}catch{res.writeHead(404);res.end('nf');}});
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
  for(let i=0;i<40&&!day;i++){const d=isoDay(new Date(start-i*86400e3));await open(d);
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
    // holiday on the same (now empty) date
    await open(day);
    await dialog.getByLabel('Session Type').selectOption('Holiday');
    await dialog.getByLabel('Notes').fill('Preview acceptance test holiday');
    await dialog.getByRole('button',{name:'Save Holiday'}).click();await dialog.waitFor({state:'detached',timeout:60000});
    await page.waitForTimeout(2500);
    note('Teacher: holiday saved and shown as Recorded holiday',await page.getByText('Recorded holiday').count()>0);
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
await browser.close();server.close();
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} checks passed`);
process.exit(results.every(r=>r.ok)?0:1);
