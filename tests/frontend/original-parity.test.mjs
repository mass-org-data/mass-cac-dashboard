import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as data from '../../src/data.js';
import {cacDropout} from '../../src/dropout.js';
// Frozen from the manager source, not generated from the implementation under test.
// No network or old Git object is required by the normal unit-test suite.
const original=JSON.parse(fs.readFileSync(new URL('../parity/original-inventory.json',import.meta.url),'utf8'));
const ctx=vm.createContext({...data,cacDropout,console,localStorage:{getItem(){return null},setItem(){}},document:{addEventListener(){}},window:{}});
vm.runInContext(fs.readFileSync(new URL('../../src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/render\(\);\s*$/,''),ctx);
vm.runInContext('shortColumns=(body)=>body;modal=(title,sub,body)=>{globalThis.form=body};toast=()=>{};close=()=>{};',ctx);
const run=text=>vm.runInContext(text,ctx),attrs=(html,name)=>[...new Set([...html.matchAll(new RegExp(name+'="([^"]+)"','g'))].map(m=>m[1]))].sort();
test('original manager-approved styling and image assets remain byte identical',()=>{
 for(const [file,expected]of Object.entries(original.assets))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+file,import.meta.url))).digest('hex'),expected,file);
});
test('original role navigation,24chart slots, actions, filters and report controls remain present',()=>{
 const charts=new Set();for(const [role,reference]of Object.entries(original.roles)){
  run(`state.role=${JSON.stringify(role)};state.laterModules=true;`);assert.equal(JSON.stringify(run('navItems()')),JSON.stringify(reference.nav));
  for(const [page,{fn,attributes}]of Object.entries(reference.pages)){
   run(`state.page=${JSON.stringify(page)}`);const html=run(fn+'()');
   for(const [attribute,values]of Object.entries(attributes))for(const value of values){if(attribute==='data-gender')continue;assert(attrs(html,attribute).includes(value),role+'/'+page+' missing '+attribute+'='+value);}
   for(const n of attributes['data-chart'])charts.add(n);
  }
 }assert.equal(charts.size,24);
});
test('original form fields are retained in the explicit demo parity harness',()=>{
 for(const [expression,expected]of Object.entries(original.forms)){
  run("state.role='Teacher';state.page='overview';"+expression);const actual=attrs(run('form'),'name');for(const name of expected)assert(actual.includes(name),expression+' missing '+name);
 }
});
