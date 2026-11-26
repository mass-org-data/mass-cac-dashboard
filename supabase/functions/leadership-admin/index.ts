import postgres from 'npm:postgres@3.4.8';
import {administrationHandler, projectPreviewOrigin} from './handler.mjs';

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Leadership administration configuration is incomplete.');
  return value;
};
const authUrl = new URL('/auth/v1/', required('SUPABASE_URL'));
const publicKey = required('SUPABASE_ANON_KEY');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const databaseUrl = required('MASS_ADMIN_DATABASE_URL');
const inviteUrl = new URL(required('MASS_ADMIN_INVITE_URL'));
if (inviteUrl.protocol !== 'https:' || inviteUrl.pathname !== '/' || inviteUrl.search || inviteUrl.hash || inviteUrl.username || inviteUrl.password) {
  throw new Error('Leadership invitation origin must be a fixed HTTPS site root.');
}
const previewProject = authUrl.hostname === 'nilzfsahxoxibvrwsqkd.supabase.co';
const allowedOrigin = (value: string | null) => {
  if (value === inviteUrl.origin) return true;
  return previewProject && projectPreviewOrigin(value);
};
const authRequest = (url: URL, init: RequestInit) => fetch(url, {
  ...init, redirect: 'error', signal: AbortSignal.timeout(8000),
});
const authAdminHeaders = {apikey: serviceKey, authorization: 'Bearer ' + serviceKey, 'content-type': 'application/json'};
interface AuthAccount {id: string; email?: string; email_confirmed_at?: string; banned_until?: string | null}
const isBanned = (account: AuthAccount) => account.banned_until != null && Date.parse(account.banned_until) > Date.now();
async function getAccounts(search: string, page: number, perPage: number) {
  const url = new URL('admin/users', authUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));
  if (search) url.searchParams.set('filter', search);
  const response = await authRequest(url, {headers: authAdminHeaders});
  if (!response.ok) throw new Error('Auth directory unavailable.');
  const data = await response.json() as {users: AuthAccount[]};
  if (!Array.isArray(data.users) || data.users.length > perPage) throw new Error('Invalid Auth page.');
  return data.users;
}
function verifiedTokenSession(authorization: string, subject: string) {
  try {
    const encoded = authorization.split('.')[1].replaceAll('-','+').replaceAll('_','/');
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4,'=')));
    return claims.sub === subject && typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch { return null; }
}


Deno.serve(administrationHandler({
  origin: allowedOrigin,
  async verify(authorization: string) {
    const response = await authRequest(new URL('user', authUrl), {headers: {apikey: publicKey, authorization}});
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error('Auth unavailable.');
    const user = await response.json();
    const session = verifiedTokenSession(authorization, user.id);
    return session ? {id: user.id, session} : null;
  },
  async listAccounts(search: string, offset: number) {
    const users = await getAccounts(search, offset / 20 + 1, 20);
    const filter = search.trim().toLowerCase();
    const accounts = users.filter(user => !filter || user.email?.toLowerCase().includes(filter))
      .map(user => ({id: user.id, email: user.email ?? null, confirmed: Boolean(user.email_confirmed_at)}));
    return {accounts, more: users.length === 20};
  },
  async resolveAccount(email: string) {
    const users = (await getAccounts(email, 1, 100)).filter(account => account.email?.toLowerCase() === email);
    if (users.length !== 1 || !users[0].email_confirmed_at || isBanned(users[0])) return null;
    return users[0].id;
  },
  async withDatabase(session: string, run: (database: unknown) => Promise<unknown>) {
    // A dedicated connection (direct or Supavisor session mode) holds the
    // request lock across the provider call. Deactivation commits before Auth.
    const sql = postgres(databaseUrl, {max: 1, prepare: false, connect_timeout: 5, idle_timeout: 0, ssl: 'verify-full', onnotice: () => {}});
    try {
      await sql`SET ROLE mass_user_admin_bridge`;
      await sql`SELECT set_config('mass.administration_session',${session},false)`;
      return await run({
        async authorize(actor: string) {
          await sql`SELECT mass_core.require_administration_leader(${actor}::uuid)`;
        },
        async directory(actor: string, accounts: Array<{id:string;email:string | null;confirmed:boolean}>) {
          const [row] = await sql`SELECT mass_core.administration_directory(${actor}::uuid,${sql.json(accounts)}::jsonb) AS result`;
          return row.result;
        },
        async lock(id: string, operation: () => Promise<unknown>) {
          const [row] = await sql`SELECT pg_try_advisory_lock(hashtextextended('mass-user-admin:' || ${id}::text,0)) AS locked`;
          if (!row.locked) throw Object.assign(new Error('Request in progress.'), {code: 'PT409'});
          try { return await operation(); }
          finally { await sql`SELECT pg_advisory_unlock(hashtextextended('mass-user-admin:' || ${id}::text,0))`; }
        },
        async retry(actor: string, id: string) {
          const [row] = await sql`SELECT mass_core.administration_retry_input(${actor}::uuid,${id}::uuid) AS result`;
          return row.result;
        },
        async prepare(actor: string, id: string, action: string, input: Record<string, string>) {
          const [row] = await sql`SELECT mass_core.administration_prepare(${actor}::uuid,${id}::uuid,${action}::text,${sql.json(input)}::jsonb) AS result`;
          return row.result;
        },
        async finish(actor: string, id: string, authSubject: string | null, failure: string | null) {
          const [row] = await sql`SELECT mass_core.administration_finish(${actor}::uuid,${id}::uuid,${authSubject}::uuid,${failure}::text) AS result`;
          return row.result;
        },
      });
    } finally { await sql.end({timeout: 1}); }
  },
  async administer(action: string, input: {email: string}, subject: string) {
    const inviting = action === 'invite';
    const url = new URL(inviting ? 'invite' : 'admin/users/' + encodeURIComponent(subject), authUrl);
    if (inviting) {
      const accounts = await getAccounts(input.email, 1, 100);
      if (accounts.some(account => account.email?.toLowerCase() === input.email)) throw new Error('Review existing Auth account.');
      url.searchParams.set('redirect_to', inviteUrl.href);
    }
    const response = await authRequest(url, {
      method: inviting ? 'POST' : 'PUT',
      headers: authAdminHeaders,
      body: JSON.stringify(inviting ? {email: input.email} : {ban_duration: action === 'deactivate' ? '876000h' : 'none'}),
    });
    if (!response.ok) throw new Error('Auth action failed.');
    const user = await response.json() as AuthAccount;
    if (typeof user.id !== 'string' || (inviting ? user.email?.toLowerCase() !== input.email : user.id !== subject)) {
      throw new Error('Auth subject mismatch.');
    }
    if (!inviting && (user.banned_until != null && !Number.isFinite(Date.parse(user.banned_until))
        || isBanned(user) !== (action === 'deactivate'))) throw new Error('Auth status mismatch.');
    return user.id;
  },
}));
