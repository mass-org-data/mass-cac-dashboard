import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectoryApi,directoryCentres} from '../../src/live/directory.js';
import {validateConfig} from '../../src/live/config.js';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
test('directory filtering intersects authenticated centre scope',()=>{
 const rows=[{centre_id:A,donor_id:A},{centre_id:B,donor_id:B}];
 assert.deepEqual(directoryCentres([{id:A}],rows),[rows[0]]);
 assert.deepEqual(directoryCentres([{id:A}],rows,B),[]);
});
test('directory configuration stays off until explicitly enabled after 017',()=>{
 const config={url:'https://pbkwpfdpdtelmvbkzgvx.supabase.co',publishableKey:'sb_publishable_'+'x'.repeat(32)};
 assert.equal(validateConfig(config).directoryApi,'off');
 assert.throws(()=>validateConfig({...config,readApi:'baseline',directoryApi:'directory-v1'}));
 assert.equal(validateConfig(config).readApi,'frontend-reads-v1');
 assert.equal(validateConfig({...config,readApi:'frontend-reads-v1',directoryApi:'directory-v1'}).directoryApi,'directory-v1');
});
test('directory adapter fixes schema, validates IDs and preserves errors safely',async()=>{
 const calls=[];const api=createDirectoryApi({schema(s){assert.equal(s,'mass_api');return{rpc(n,args){calls.push([n,args]);return Promise.resolve({data:[],status:200});}};}});
 await api.staff({centre:A,shift:'Morning'});assert.equal(calls[0][1].p_limit,100);assert.equal(calls[0][1].p_centre,A);
 assert.throws(()=>api.staff({centre:A,shift:'Both'}));assert.throws(()=>api.centres({centre:'all'}));
});
