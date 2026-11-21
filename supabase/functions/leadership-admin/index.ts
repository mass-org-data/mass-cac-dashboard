import postgres from 'npm:postgres@3.4.8';
import {administrationHandler} from './handler.mjs';

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
const authRequest = (url: URL, init: RequestInit) => fetch(url, {
  ...init, redirect: 'error', signal: AbortSignal.timeout(8000),
});

Deno.serve(administrationHandler({
  origin: inviteUrl.origin,
  async verify(authorization: string) {
    const response = await authRequest(new URL('user', authUrl), {headers: {apikey: publicKey, authorization}});
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error('Auth unavailable.');
    const user = await response.json();
    return user.id;
  },
  async withDatabase(run: (database: unknown) => Promise<unknown>) {
    // A dedicated connection (direct or Supavisor session mode) holds the
    // request lock across the provider call. Deactivation commits before Auth.
    const sql = postgres(databaseUrl, {max: 1, prepare: false, connect_timeout: 5, idle_timeout: 0, ssl: 'verify-full', onnotice: () => {}});
    try {
      await sql`SET ROLE mass_user_admin_bridge`;
      return await run({
        async directory(actor: string, search: string, offset: number) {
          const [row] = await sql`SELECT mass_core.administration_directory(${actor}::uuid,${search}::text,${offset}::integer) AS result`;
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
    if (inviting) url.searchParams.set('redirect_to', inviteUrl.href);
    const response = await authRequest(url, {
      method: inviting ? 'POST' : 'PUT',
      headers: {apikey: serviceKey, authorization: 'Bearer ' + serviceKey, 'content-type': 'application/json'},
      body: JSON.stringify(inviting ? {email: input.email} : {ban_duration: action === 'deactivate' ? '876000h' : 'none'}),
    });
    if (!response.ok) throw new Error('Auth action failed.');
    const user = await response.json();
    if (typeof user.id !== 'string' || (!inviting && user.id !== subject)) throw new Error('Auth subject mismatch.');
    return user.id;
  },
}));
