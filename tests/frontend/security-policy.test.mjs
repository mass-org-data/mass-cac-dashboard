import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {escapeHtml} from '../../src/live/html.js';
import {isAuthorizationFailure} from '../../src/live/access-verification.js';

test('shared HTML escaping neutralizes element and attribute markup',()=>{
 assert.equal(escapeHtml(`<img src=x onerror="run()">'&`),'&lt;img src=x onerror=&quot;run()&quot;&gt;&#39;&amp;');
});

test('access verification distinguishes authorization denial from transport failure',()=>{
 assert.equal(isAuthorizationFailure({status:401}),true);
 assert.equal(isAuthorizationFailure({status:403}),true);
 assert.equal(isAuthorizationFailure({status:503}),false);
 assert.equal(isAuthorizationFailure({status:0}),false);
});

test('Vercel policy blocks script injection and framing on every route',async()=>{
 const config=JSON.parse(await readFile('vercel.json','utf8'));
 const headers=config.headers.find(rule=>rule.source==='/(.*)')?.headers||[];
 const values=Object.fromEntries(headers.map(({key,value})=>[key,value]));
 assert.match(values['Content-Security-Policy'],/script-src 'self'/);
 assert.match(values['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.match(values['Content-Security-Policy'],/object-src 'none'/);
 assert.equal(values['X-Content-Type-Options'],'nosniff');
 assert.equal(values['X-Frame-Options'],'DENY');
});

test('application source contains no inline event-handler attributes',async()=>{
 const sources=await Promise.all(['src/index.html','src/entry.js','src/app.js','src/live/original-review.js'].map(path=>readFile(path,'utf8')));
 assert.equal(sources.some(source=>/\son[a-z]+\s*=/i.test(source)),false);
});
