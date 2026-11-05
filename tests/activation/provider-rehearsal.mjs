import {PGlite} from '@electric-sql/pglite';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=fs.mkdtempSync(path.join(os.tmpdir(),'mass-provider-rehearsal-'));
execFileSync('python',[path.join(root,'scripts/activation/prepare_provider.py'),'--output',output,'--include-proposal-024'],{stdio:'pipe'});
const read=p=>fs.readFileSync(root+'/'+p,'utf8');
const db=new PGlite();
await db.waitReady;
console.log((await db.query('select version()')).rows[0]);
await db.exec(read('tests/core/bootstrap.sql'));
// Single-process PG17 WASM replay; role/RLS probes use authenticated roles.
// Native concurrent/managed-Auth verification remains a separate suite.
await db.exec("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);");
const base=fs.readdirSync(root+'/supabase/migrations').filter(n=>n.endsWith('.sql')&&n<'202610290020').sort();
for(const [i,name] of base.entries()){
 await db.exec(read('supabase/migrations/'+name));
 const canonical=name.slice(0,-4),version=/018_|019_/.test(name)?name.split('_')[0]:'20991231'+String(i).padStart(6,'0');
 await db.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',[version,canonical]);
}
await db.exec(read('tests/release/preactivation.sql'));
await db.exec(read('tests/activation/grants.sql'));
const manifest=JSON.parse(fs.readFileSync(path.join(output,'PROVIDER-ENVELOPES.json'),'utf8')).files;
for(const [i,entry] of manifest.entries()){
 const body=fs.readFileSync(path.join(output,entry.envelope),'utf8');
 const before=JSON.stringify((await db.query("select n.nspname,c.relname,c.relacl::text,c.relowner,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'mass_%' order by 1,2")).rows);
 await db.exec('BEGIN;');
 try{await db.exec(body);await db.exec('COMMIT;');throw Error('Provider without atomic receipt unexpectedly committed');}
 catch(e){if(e.code!=='55000')throw e;await db.exec('ROLLBACK;');}
 await db.exec('BEGIN;');
 try{await db.exec(body);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[String(20990101000000+i),entry.provider_name,[body]]);await db.exec('SELECT 1/0;');throw Error('Injected failure did not fail');}
 catch(e){if(e.code!=='22012')throw e;await db.exec('ROLLBACK;');}
 const after=JSON.stringify((await db.query("select n.nspname,c.relname,c.relacl::text,c.relowner,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'mass_%' order by 1,2")).rows);
 if(before!==after)throw Error('Rollback changed catalog');
 await db.exec('BEGIN;');await db.exec(body);
 await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[String(20990101000000+i),entry.provider_name,[body]]);
 await db.exec('COMMIT;');
  await db.exec(read('tests/release/verify-preactivation.sql'));
 await db.exec(read('tests/activation/disabled.sql'));
 console.log('PASS',entry.provider_name,'rollback, provider ledger, preservation, direct disabled RPCs');
}
await db.exec(read('supabase/activation/postflight.sql'));
await db.exec(read('tests/activation/enabled.sql'));
console.log('PASS provider-owned transaction rehearsal; NOT proof of hosted transport atomicity.');
await db.close();
fs.rmSync(output,{recursive:true,force:true});
