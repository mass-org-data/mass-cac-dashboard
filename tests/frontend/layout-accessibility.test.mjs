import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../../src/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../src/live.css',import.meta.url),'utf8');

test('live navigation has explicit accessible menu state and mobile dismissal',()=>{
  assert.match(source,/id="primary-navigation" class="sidebar" aria-label="Primary navigation"/);
  assert.match(source,/aria-controls="primary-navigation" aria-expanded="\$\{state\.menu\}"/);
  assert.match(source,/sidebar-scrim[^`]+data-action="menu"[^`]+aria-label="Close navigation"/);
  assert.match(css,/@media\(max-width:650px\)[^{]*\{\.sidebar-scrim\{display:block/);
});

test('live help is one general About page without the hidden records screen',()=>{
  assert.match(source,/About this dashboard','MASS Children’s Activity Centres dashboard/);
  assert.doesNotMatch(source,/About these records/);
  assert.match(source,/aria-label="About this dashboard"/);
});

test('live menus use task labels while preserving internal route identities',()=>{
  for(const label of ['Student profiles','Assessments','Centre visits','Officer visits','Morarji scholarship'])assert(source.includes(`'${label}'`),label);
});
