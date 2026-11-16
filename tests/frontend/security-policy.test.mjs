import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {escapeHtml} from '../../src/live/html.js';
import {isAuthorizationFailure} from '../../src/live/access-verification.js';
import {APPROVED_PROJECTS} from '../../src/live/config.js';

test('shared HTML escaping neutralizes element and attribute markup',()=>{
 assert.equal(escapeHtml(`<img src=x onerror="run()">'&`),'&lt;img src=x onerror=&quot;run()&quot;&gt;&#39;&amp;');
});

test('access verification distinguishes authorization denial from transport failure',()=>{
 assert.equal(isAuthorizationFailure({status:401}),true);
 assert.equal(isAuthorizationFailure({status:403}),true);
 assert.equal(isAuthorizationFailure({status:503}),false);
 assert.equal(isAuthorizationFailure({status:0}),false);
});

// vercel.json has three header rules: the common security headers, the strict policy (everything except preview hosts, which is
// Production) and a relaxed policy only for preview hosts, so the Vercel toolbar (comments) can load there and nowhere else.
const rules=async()=>{
 const config=JSON.parse(await readFile('vercel.json','utf8'));
 const all=config.headers.filter(rule=>rule.source==='/(.*)');
 const cspOf=rule=>rule.headers.find(h=>h.key==='Content-Security-Policy')?.value;
 return {
  common:Object.fromEntries(all.find(rule=>!rule.has&&!rule.missing).headers.map(({key,value})=>[key,value])),
  strictRule:all.find(rule=>rule.missing),
  relaxedRule:all.find(rule=>rule.has),
  strict:cspOf(all.find(rule=>rule.missing)),
  relaxed:cspOf(all.find(rule=>rule.has)),
  all,
 };
};
const directive=(csp,name)=>csp.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+' ')||part===name)?.split(/\s+/).slice(1)||[];

test('Vercel policy blocks script injection and framing on every route',async()=>{
 const {common,strict}=await rules();
 assert.match(strict,/script-src 'self'(;|$)/);
 assert.match(strict,/frame-ancestors 'none'/);
 assert.match(strict,/object-src 'none'/);
 assert.equal(common['X-Content-Type-Options'],'nosniff');
 assert.equal(common['X-Frame-Options'],'DENY');
 assert.equal(common['Content-Security-Policy'],undefined);
});

test('connect-src of the strict policy allows exactly self plus the approved Supabase project hosts',async()=>{
 const {strict}=await rules();
 assert.deepEqual(directive(strict,'connect-src').sort(),["'self'",...APPROVED_PROJECTS.map(ref=>`https://${ref}.supabase.co`)].sort());
 assert.equal(strict.includes('*'),false);
 assert.equal(strict.includes('vercel'),false);
});

test('exactly one policy applies to a host: strict unless the host is a preview host, relaxed only for preview hosts',async()=>{
 const {strictRule,relaxedRule,all}=await rules();
 assert.equal(all.filter(rule=>rule.headers.some(h=>h.key==='Content-Security-Policy')).length,2);
 assert.deepEqual(strictRule.missing,relaxedRule.has);                       // the same condition, opposite sense
 assert.equal(relaxedRule.has.length,1);
 assert.equal(relaxedRule.has[0].type,'host');
 const preview=new RegExp(relaxedRule.has[0].value);
 assert.equal(preview.test('mass-cac-dashboard.vercel.app'),false);          // Production is never relaxed
 assert.equal(preview.test('mass-cac-dashboard.vercel.app.evil.com'),false);
 assert.equal(preview.test('evil.com'),false);
 assert.match(relaxedRule.has[0].value,/^\^.*\$$/);                           // anchored: no partial host matches
});

test('the preview policy only adds the Vercel toolbar hosts and keeps every other protection',async()=>{
 const {strict,relaxed}=await rules();
 assert.deepEqual(directive(relaxed,'script-src'),["'self'",'https://vercel.live']);
 assert.equal(/unsafe-eval|unsafe-inline/.test(directive(relaxed,'script-src').join(' ')),false);
 assert.deepEqual(directive(relaxed,'frame-ancestors'),["'none'"]);
 assert.deepEqual(directive(relaxed,'object-src'),["'none'"]);
 assert.deepEqual(directive(relaxed,'form-action'),["'self'"]);
 assert.deepEqual(directive(relaxed,'base-uri'),["'self'"]);
 assert.deepEqual(directive(relaxed,'default-src'),["'self'"]);
 for(const host of APPROVED_PROJECTS.map(ref=>`https://${ref}.supabase.co`))assert.ok(directive(relaxed,'connect-src').includes(host));
 assert.deepEqual(directive(relaxed,'frame-src'),['https://vercel.live']);
 // Everything the preview policy allows beyond the strict one must be a Vercel or Pusher host.
 for(const name of ['connect-src','font-src','frame-src','img-src','script-src','style-src']){
  const extra=directive(relaxed,name).filter(value=>!directive(strict,name).includes(value)&&value!=="'self'");
  for(const value of extra)assert.match(value,/^(https|wss):\/\/([a-z0-9*-]+\.)?(vercel\.live|vercel\.com|pusher\.com)\/?$|^blob:$/);
 }
});

test('application source contains no inline event-handler attributes',async()=>{
 const sources=await Promise.all(['src/index.html','src/entry.js','src/app.js','src/live/original-review.js'].map(path=>readFile(path,'utf8')));
 assert.equal(sources.some(source=>/\son[a-z]+\s*=/i.test(source)),false);
});
