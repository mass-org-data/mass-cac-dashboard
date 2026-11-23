import assert from 'node:assert/strict';
import test from 'node:test';
import {administrationHandler} from '../../supabase/functions/leadership-admin/handler.mjs';

const origin = 'https://dashboard.example.invalid';
const actor = '00000000-0000-4000-8000-000000000001';
const subject = '00000000-0000-4000-8000-000000000002';
const session = '00000000-0000-4000-8000-000000000014';
const id = '00000000-0000-4000-8000-000000000003';
const request = (body, authenticated = true, requestOrigin = origin) => new Request(origin, {
  method: 'POST',
  headers: {origin: requestOrigin, ...(authenticated ? {authorization:'Bearer synthetic'} : {})},
  body: JSON.stringify(body),
});
const statusError = code => Object.assign(new Error('test'), {code});

function fixture({providerFails = false, databaseFails = false, denied = false, linked = null} = {}) {
  const steps = [];
  let state = 'Active';
  let completed = false;
  const handler = administrationHandler({
    origin,
    verify: async () => ({id:actor, session}),
    listAccounts: async () => ({accounts:[],more:false}),
    resolveAccount: async () => linked,
    withDatabase: async (verifiedSession, action) => {
      assert.equal(verifiedSession,session);
      return action({
      authorize: async caller => {
        assert.equal(caller, actor);
        if (denied) throw statusError('42501');
      },
      directory: async caller => {
        assert.equal(caller, actor);
        if (denied) throw statusError('42501');
        return {users: []};
      },
      lock: async (operation, call) => { assert.equal(operation, id); return call(); },
      retry: async () => ({action:'deactivate',input:{subject,version:1}}),
      prepare: async (caller, operation, action, input) => {
        assert.equal(caller, actor);
        assert.equal(operation, id);
        if (denied) throw statusError('42501');
        steps.push(['prepare', action, input]);
        if (completed || action === 'link') return {state:'complete'};
        if (action === 'deactivate') state = 'Inactive';
        if (action === 'reactivate') assert.equal(state, 'Inactive');
        return {state:'pending', subject};
      },
      finish: async (caller, operation, target, failure) => {
        assert.equal(caller, actor);
        assert.equal(operation, id);
        if (failure) {
          assert.equal(state, 'Inactive');
          steps.push(['retry', failure]);
          return {state:'retry',failure};
        }
        assert.equal(target, subject);
        if (databaseFails) throw statusError('PT409');
        steps.push(['finish']);
        completed = true;
        return {state:'complete'};
      },
      });
    },
    administer: async (action, _input, target) => {
      assert.equal(state, 'Inactive');
      assert.equal(target, subject);
      steps.push([action === 'deactivate' ? 'ban' : 'unban']);
      if (providerFails) throw new Error('Sensitive provider output is discarded.');
      return subject;
    },
  });
  return {handler, steps};
}

const deactivate = {action:'deactivate',id,subject,version:1};
test('Edge administration denies anonymous, unauthorized and other-origin requests', async () => {
  const {handler,steps} = fixture({denied:true});
  assert.equal((await handler(request(deactivate, false))).status, 401);
  assert.equal((await handler(request(deactivate, true, 'https://other.example.invalid'))).status, 403);
  assert.equal((await handler(request({action:'directory'}))).status, 403);
  assert.equal((await handler(request(deactivate))).status, 403);
  assert.deepEqual(steps, []);
});

test('Edge deactivates application access before ban and finalization, then replays without Auth', async () => {
  const {handler,steps} = fixture();
  const first = await handler(request({...deactivate, actor:subject, password:'ignored test-only field'}));
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {state:'complete'});
  assert.deepEqual(steps, [['prepare','deactivate',{subject,version:1}],['ban'],['finish']]);
  assert.equal((await handler(request(deactivate))).status, 200);
  assert.deepEqual(steps.map(step=>step[0]), ['prepare','ban','finish','prepare']);
});

test('Edge returns sanitized retry state for provider and post-Auth database failures', async () => {
  for (const [failure, options] of [['auth_unavailable',{providerFails:true}],['auth_sync_failed',{databaseFails:true}]]) {
    const {handler,steps} = fixture(options);
    const response = await handler(request(deactivate));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {state:'retry',failure});
    assert.deepEqual(steps.map(step=>step[0]), ['prepare','ban','retry']);
  }
});

test('manual linking takes its subject from the verified provider lookup', async () => {
  const input={action:'link',id,email:'synthetic@example.invalid',role:'Teacher',subject:actor};
  assert.equal((await fixture().handler(request(input))).status,400);
  const {handler,steps}=fixture({linked:subject});
  assert.equal((await handler(request(input))).status,200);
  assert.deepEqual(steps,[['prepare','link',{email:input.email,role:input.role,subject}]]);
});
