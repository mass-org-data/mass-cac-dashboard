import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('preview readiness validates required flags and never prints the publishable key',()=>{
 const key='sb_publishable_'+'x'.repeat(32);
 const env={...process.env,MASS_APP_MODE:'live',MASS_READ_API:'frontend-reads-v1',MASS_DIRECTORY_API:'directory-v1',MASS_SUPABASE_URL:'https://pbkwpfdpdtelmvbkzgvx.supabase.co',MASS_SUPABASE_PUBLISHABLE_KEY:key};
 const run=spawnSync(process.execPath,['scripts/preview-config.mjs'],{env,encoding:'utf8'});
 assert.equal(run.status,0);assert(!run.stdout.includes(key));
 for(const [name,value]of [['MASS_APP_MODE','demo'],['MASS_DIRECTORY_API','off'],['MASS_READ_API','baseline'],['MASS_SUPABASE_PUBLISHABLE_KEY','sb_secret_rejected']]){
  assert.notEqual(spawnSync(process.execPath,['scripts/preview-config.mjs'],{env:{...env,[name]:value}}).status,0);
 }
});
