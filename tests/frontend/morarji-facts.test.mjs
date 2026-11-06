import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMorarjiFacts} from '../../src/live/morarji.js';
import {createApi} from '../../src/live/api.js';

test('all 27 nullable Morarji combinations preserve unknown facts and reject confirmed contradictions', () => {
  for (const applied of [null, false, true]) for (const attended of [null, false, true]) for (const passed of [null, false, true]) {
    const facts = Object.freeze({applied, attended, passed});
    const conflict = applied === false && (attended === true || passed === true) || attended === false && passed === true;
    if (conflict) assert.throws(() => validateMorarjiFacts(facts), /cannot be Yes/);
    else assert.equal(validateMorarjiFacts(facts), facts);
  }
});

test('Morarji API adapter sends no request for contradictory facts', () => {
  const api = createApi({schema() {return {rpc() {throw Error('Unexpected network request');}};}});
  assert.throws(() => api.recordMorarji({applied: false, attended: true, passed: null}), /Attended cannot/);
  assert.throws(() => api.recordMorarji({applied: null, attended: false, passed: true}), /Passed cannot/);
});

test('Morarji does not reinterpret empty strings or missing values as verified answers', () => {
  for (const applied of ['', undefined, 'true', 0]) assert.throws(() => validateMorarjiFacts({applied, attended: null, passed: null}), /Yes, No or Unknown/);
});
