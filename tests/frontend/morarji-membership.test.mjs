import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedMorarjiMembership} from '../../src/live/morarji.js';
import {createOriginalActions} from '../../src/live/original-actions.js';

const row = (membershipId, cohort, id = 'enrolment') => ({membershipId, cohort, s: {id}, row_version: 3});
test('selected historical cohort takes precedence over another current cohort', () => {
  const old = row('old', '2025–26');
  const db = {morarji: {enrolment: row('current', '2026–27')}, morarjiHistory: [old]};
  assert.equal(selectedMorarjiMembership(db, 'enrolment', '2025–26'), old);
});
test('missing, foreign and ambiguous cohort memberships never fall back to another record', () => {
  for (const history of [[], [row('foreign', '2025–26', 'other')], [row('a', '2025–26'), row('b', '2025–26')]]) {
    assert.throws(() => selectedMorarjiMembership({morarjiHistory: history}, 'enrolment', '2025–26'), /one verified/);
  }
  assert.throws(() => selectedMorarjiMembership({morarjiHistory: [row('a', '2025–26')]}, 'enrolment', '2025–26', 'stale'), /one verified/);
});
test('exact membership identity resolves duplicate cohort labels without crossing enrolments', () => {
  const selected = row('b', '2025–26');
  const db = {morarjiHistory: [row('a', '2025–26'), selected, row('b', '2025–26', 'other')]};
  assert.equal(selectedMorarjiMembership(db, 'enrolment', '2025–26', 'b'), selected);
});
test('follow-up submits the selected cohort membership and its expected revision', async () => {
  const calls = [], s = {id: 'enrolment', centre: 'centre', name: 'Synthetic learner'};
  const db = {students: [s], morarji: {enrolment: row('current', '2026–27')}, morarjiHistory: [row('old', '2025–26')]};
  let submit;
  const handle = createOriginalActions({
    api: {recordMorarji: async payload => calls.push(payload)},
    context: {centres: [{id: 'centre', roles: ['Teacher'], can_write: true}]},
    capabilities: {originalWorkflows: true, activationControl: true, writes: {morarji: true}},
    refresh: async () => {},
  });
  await handle({dataset: {morarji: s.id}}, {
    state: {role: 'Teacher', morarjiYear: '2025–26'}, db,
    modal: (title, subtitle, body, callback) => {assert.match(subtitle, /2025–26/); submit = callback;},
    field: () => '', drop: () => '', toast: () => {},
  });
  assert.equal(calls.length, 0);
  await submit({applied: '', attended: '', passed: '', school: ''});
  assert.deepEqual(calls, [{member: 'old', applied: null, attended: null, passed: null, school: null, expected: 3}]);
});
