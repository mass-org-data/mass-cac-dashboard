const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = new Set(['Teacher', 'Cluster Officer', 'Leadership']);
const lifecycle = new Set(['invite', 'deactivate', 'reactivate']);
const version = value => Number.isSafeInteger(value) && value > 0;

function parse(body) {
  const {action, id, subject, centre, assignment, assignmentVersion} = body ?? {};
  if (action === 'directory') {
    const search = body.search ?? '';
    const offset = body.offset ?? 0;
    if (typeof search === 'string' && search.length <= 254 && Number.isInteger(offset) && offset >= 0 && offset <= 100000 && offset % 20 === 0) {
      return {action, search, offset};
    }
  }
  if (!uuid.test(id ?? '')) return null;
  if (action === 'retry') return {action, id};
  const role = body.role;
  if (action === 'invite' || action === 'link') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && roles.has(role)) return {action, id, input: {email, role}};
    return null;
  }
  if (!uuid.test(subject ?? '') || !version(body.version)) return null;
  const input = {subject, version: body.version};
  if (action === 'role' && roles.has(role)) return {action, id, input: {...input, role}};
  if (action === 'assign' && uuid.test(centre ?? '')) return {action, id, input: {...input, centre}};
  if (action === 'unassign' && uuid.test(assignment ?? '') && version(assignmentVersion)) {
    return {action, id, input: {...input, assignment, assignmentVersion}};
  }
  if (action === 'deactivate' || action === 'reactivate') return {action, id, input};
  return null;
}

export function administrationHandler({origin, verify, withDatabase, listAccounts, resolveAccount, administer}) {
  return async request => {
    const cors = request.headers.get('origin') === origin
      ? {'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
         'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin'}
      : {};
    const reply = (status, body) => Response.json(body, {status, headers: {...cors, 'cache-control': 'no-store'}});
    if (request.headers.get('origin') && !cors.vary) return reply(403, {error: 'forbidden'});
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (request.method !== 'POST') return reply(405, {error: 'invalid_request'});
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply(401, {error: 'sign_in_required'});
    try {
      const identity = await verify(authorization);
      if (!uuid.test(identity?.id ?? '') || !uuid.test(identity?.session ?? '')) return reply(401, {error: 'sign_in_required'});
      const text = await request.text();
      if (text.length > 4096) return reply(400, {error: 'invalid_request'});
      const operation = parse(JSON.parse(text));
      if (!operation) return reply(400, {error: 'invalid_request'});
      const actor = identity.id;
      const result = await withDatabase(identity.session, async db => {
        if (operation.action === 'directory') {
          await db.authorize(actor);
          const page = await listAccounts(operation.search, operation.offset);
          return {...await db.directory(actor, page.accounts), more: page.more};
        }
        return await db.lock(operation.id, async () => {
          const {action, input} = operation.action === 'retry' ? await db.retry(actor, operation.id) : operation;
          if (action === 'link') {
            await db.authorize(actor);
            const subject = await resolveAccount(input.email);
            if (!uuid.test(subject ?? '')) throw Object.assign(new Error('Verified Auth account required.'), {code: '22023'});
            return await db.prepare(actor, operation.id, action, {...input, subject});
          }
          const prepared = await db.prepare(actor, operation.id, action, input);
          if (!lifecycle.has(action) || prepared.state !== 'pending') return prepared;
          let authResult;
          try {
            authResult = await administer(action, input, prepared.subject);
          } catch {
            const failure = action === 'invite' ? 'invite_needs_review' : 'auth_unavailable';
            return await db.finish(actor, operation.id, null, failure);
          }
          try {
            return await db.finish(actor, operation.id, authResult, null);
          } catch (error) {
            // Once Auth succeeded, application access stays inactive if database
            // finalization fails. A subsequent trusted retry can finish safely.
            if (error?.code === '42501') throw error;
            const failure = action === 'invite' ? 'invite_needs_review' : 'auth_sync_failed';
            return await db.finish(actor, operation.id, null, failure);
          }
        });
      });
      return reply(200, result);
    } catch (error) {
      if (error?.code === '42501') return reply(403, {error: 'forbidden'});
      if (['PT409', '23505', '40001', '55P03'].includes(error?.code)) return reply(409, {error: 'conflict'});
      if (error?.code === '23514') return reply(409, {error: 'assignments_conflict'});
      if (error instanceof SyntaxError || ['22023','22P02','23503'].includes(error?.code)) {
        return reply(400, {error: 'invalid_request'});
      }
      return reply(503, {error: 'administration_unavailable'});
    }
  };
}
