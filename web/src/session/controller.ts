// Session and role controller. Framework-free so it can be tested without React.
// It reuses the current application's modules: the approved-project config check, the
// backend client, the sign-in verification, the read API and the role rules. The server
// stays the authority: roles come from get_context, and the scope is re-verified every
// 30 seconds and whenever the tab becomes visible, exactly as in the current interface.
import {authorizedRoles, defaultAuthorizedRole} from '../../../src/live/role-data.js';

export interface CentreScope {id: string; label: string; roles: string[]; can_write?: boolean}
export interface ProgrammeContext {user_id: string; centres: CentreScope[]; operational_roles_enabled?: boolean}

export type SessionState =
  | {status: 'loading'}
  | {status: 'signed-out'; message?: string}
  | {status: 'error'; message: string}
  | {status: 'ready'; userId: string; context: ProgrammeContext; roles: string[]; activeRole: string};

export interface Backend {
  getSession(): Promise<{data: {session: {user?: {id: string}} | null}; error: unknown}>;
  getUser(): Promise<{data: {user: {id: string} | null}; error: {status?: number} | null}>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  readContext(signal?: AbortSignal): Promise<ProgrammeContext>;
}

export interface Timers {
  setInterval: (callback: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
}

const defaultTimers: Timers = {setInterval: (callback, ms) => globalThis.setInterval(callback, ms), clearInterval: id => globalThis.clearInterval(id as number)};
const isAuthorizationFailure = (error: {status?: number} | null | undefined) => error?.status === 401 || error?.status === 403;

export function createSessionController(backend: Backend, timers: Timers = defaultTimers) {
  let state: SessionState = {status: 'loading'};
  let fingerprint = '';
  let timer: unknown = null;
  let verifying = false;
  const listeners = new Set<() => void>();
  const set = (next: SessionState) => { state = next; for (const listener of listeners) listener(); };

  const stopVerifying = () => { if (timer !== null) timers.clearInterval(timer); timer = null; };

  const endSession = async (message?: string) => {
    stopVerifying();
    try { await backend.signOut(); } finally { set({status: 'signed-out', message}); }
  };

  async function verify() {
    if (state.status !== 'ready' || verifying) return;
    verifying = true;
    try {
      const [auth, current] = await Promise.all([backend.getUser(), backend.readContext()]);
      if (auth.error) { if (isAuthorizationFailure(auth.error)) { await endSession('Your session has ended. Sign in again.'); return; } throw auth.error; }
      if (auth.data.user?.id !== state.userId || current.user_id !== state.userId || JSON.stringify(current.centres) !== fingerprint) {
        await endSession('Your authorized scope changed. Sign in again.');
      }
    } catch (error) {
      // A transport failure is not a permission change: keep the session but never show stale data silently.
      if (isAuthorizationFailure(error as {status?: number})) await endSession('Your session has ended. Sign in again.');
    } finally { verifying = false; }
  }

  async function load(): Promise<void> {
    const session = await backend.getSession();
    if (session.error || !session.data.session) { set({status: 'signed-out'}); return; }
    const identity = await backend.getUser();
    if (identity.error || !identity.data.user || identity.data.user.id !== session.data.session.user?.id) { await endSession('Your session has ended. Sign in again.'); return; }
    const context = await backend.readContext();
    if (context.user_id !== identity.data.user.id || !context.centres?.length) { await endSession('No verified centre scope is available. Contact the administrator.'); return; }
    const activeRole = defaultAuthorizedRole(context) as string | null;
    if (!activeRole) { await endSession('No verified role is available. Contact the administrator.'); return; }
    fingerprint = JSON.stringify(context.centres);
    set({status: 'ready', userId: identity.data.user.id, context, roles: authorizedRoles(context) as string[], activeRole});
    stopVerifying();
    timer = timers.setInterval(() => { void verify(); }, 30_000);
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async start() {
      try { await load(); } catch { set({status: 'error', message: 'The workspace could not be loaded. Check your connection and try again.'}); }
    },
    async signIn(email: string, password: string) {
      try { await backend.signIn(email, password); } catch (error) { set({status: 'signed-out', message: error instanceof Error ? error.message : 'Unable to sign in.'}); return; }
      set({status: 'loading'});
      await this.start();
    },
    async signOut() { await endSession(); },
    /** Only roles the server returned can be selected. */
    selectRole(role: string) {
      if (state.status !== 'ready' || !state.roles.includes(role)) return false;
      set({...state, activeRole: role});
      return true;
    },
    verify,
    dispose: stopVerifying,
  };
}

export type SessionController = ReturnType<typeof createSessionController>;
