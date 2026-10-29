import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeSourceZip} from '../../scripts/zip.mjs';
import {clearStoredSession} from '../../src/live/client.js';
import {programmePopulation,reportingOn} from '../../src/live/population.js';
test('public download excludes unreviewed/private working documents',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'mass-archive-test-'));
 try{
  for(const file of ['.gitignore','.env.example','.env.preview.example','README.md','package.json','package-lock.json','vercel.json'])await writeFile(path.join(root,file),'public fixture');
  for(const dir of ['src','docs','tests'])await mkdir(path.join(root,dir));
  await writeFile(path.join(root,'source-archive.manifest.json'),JSON.stringify({files:['src/app.js']}));
  await writeFile(path.join(root,'src/app.js'),'PUBLIC_APP_FIXTURE');await writeFile(path.join(root,'tests/entry-workflows.mjs'),'test fixture');
  await writeFile(path.join(root,'docs/unreviewed.private.md'),'PRIVATE_SENTINEL_FIXTURE');
  const target=path.join(root,'download.zip');await writeSourceZip(root,target);const bytes=await readFile(target);
  assert.equal(bytes.includes(Buffer.from('PRIVATE_SENTINEL_FIXTURE')),false);assert.equal(bytes.includes(Buffer.from('PUBLIC_APP_FIXTURE')),true);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('default signout cleanup purges the actual persistent storage key',()=>{
 const removed=[],previous=globalThis.localStorage;globalThis.localStorage={removeItem:k=>removed.push(k)};
 try{clearStoredSession({project:'synthetic'});assert.deepEqual(removed,['mass-auth-synthetic','mass-auth-synthetic-code-verifier','mass-auth-synthetic-user']);}finally{globalThis.localStorage=previous;}
});
test('current month snapshot includes an observed mid-month enrolment',()=>{
 const state={month:'2026-10',today:'2026-10-29',page:'overview'};
 assert.equal(reportingOn(state),'2026-10-29');assert.equal(reportingOn({...state,month:'2026-09'}),'2026-09-30');
 const rows=[{centre:'a',enrolled:'2026-10-15',exitDate:null}];assert.equal(programmePopulation(rows,[{id:'a'}],state).length,1);
});
