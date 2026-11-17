/* global document, window */
import http from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';
const root=path.resolve('dist'),out=process.env.MASS_AUDIT_SCREENSHOTS||'audit-runs/ui-check';await mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');let name=url.pathname;if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let options={headless:true};if(process.env.MASS_CHROMIUM_MODULE){const {default:runtime}=await import(process.env.MASS_CHROMIUM_MODULE);options={...options,args:runtime.args,executablePath:await runtime.executablePath()};}
const browser=await chromium.launch(options),page=await browser.newPage({viewport:{width:1440,height:1000}});let n=0;const check=(x,message)=>{if(!x)throw Error(message);n++;};const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/audit/`);await page.getByRole('heading',{name:'Indicator Verification Ledger',exact:true}).waitFor();check(await page.locator('tbody tr').count()===25,'paged inventory');check((await page.locator('.audit-notice').innerText()).includes('No numeric checks have passed'),'empty state honest');
 await page.screenshot({path:path.join(out,'ledger-desktop.png'),fullPage:true});
 const ref=process.env.MASS_AUDIT_REFERENCE||'tests/audit/fixture-reference.json';
 if(ref){await page.locator('input[type=file]').setInputFiles(ref);await page.waitForFunction(()=>['production','preview','synthetic'].includes(document.querySelector('.audit-meta dd')?.textContent));check((await page.locator('.audit-cards').innerText()).includes('0 / 0'),'reference alone has no passes');await page.screenshot({path:path.join(out,'ledger-reference-loaded.png'),fullPage:true});}
 await page.getByLabel('Find an indicator').fill('Morarji');check((await page.locator('tbody').innerText()).includes('Cutoff unverifiable'),'undated source state');
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByLabel('Dashboard page',{exact:true}).selectOption('Attendance');check((await page.locator('tbody').innerText()).includes('AT01'),'page filter');
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();check((await page.locator('.audit-pagination').innerText()).includes('Page 2'),'pagination');
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export filtered CSV',exact:true}).click();const download=await dl;check(download.suggestedFilename().endsWith('.csv'),'CSV download');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'ledger-mobile.png'),fullPage:true});check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile has no document overflow');
 check(errors.length===0,'no runtime exceptions');await writeFile(path.join(out,'result.json'),JSON.stringify({checks:n,errors},null,2));console.log(`PASS ${n} audit browser checks`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
