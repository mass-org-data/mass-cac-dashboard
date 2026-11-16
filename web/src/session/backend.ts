import {createBackendClient, clearStoredSession} from '../../../src/live/client.js';
import {signInVerified} from '../../../src/live/auth-page.js';
import {createReadApi} from '../../../src/live/reads.js';
import {createDirectoryApi} from '../../../src/live/directory.js';
import {discoverCapabilities} from '../../../src/live/backend-capabilities.js';
import {BackendError} from '../../../src/live/api.js';
import type {Backend, ProgrammeContext} from './controller';
import {createReadCache} from './readCache';

export interface RuntimeConfig {mode: string; url?: string; publishableKey?: string; project?: string; readApi?: string; directoryApi?: string}

export type Rpc = <T = unknown>(name: string, args?: Record<string, unknown>, signal?: AbortSignal) => Promise<T>;

export interface References {
  academic_years: Array<{id: string; starts_on: string; ends_before: string}>;
  assessment_periods: Array<{id: string; academic_year_id: string; quarter: number}>;
  assessment_definitions: Array<{id: string; period_id: string; max_score?: number | string}>;
  programme_cohorts?: Array<{id: string; label: string; academic_year_id: string}>;
}

export interface Capabilities {reviewedCharts: boolean; reviewedAttendanceSeries: boolean; /** Operational write gates from the server's activation control; anything missing means off. */ writes?: Record<string, boolean>}

export interface LiveBackend extends Backend {
  rpc: Rpc;
  readDirectory(signal?: AbortSignal): Promise<Array<{centre_id: string; donor_label?: string | null}>>;
  readReferences(signal?: AbortSignal): Promise<References>;
  readCapabilities(): Promise<Capabilities>;
  /** One instance per key for this signed-in session (for example the shared data services). Dropped by `reset()`. */
  shared<T>(key: string, create: () => T): T;
  /** Forget everything remembered for the current user: startup reads and shared services. Called on sign-in, sign-out and role change. */
  reset(): void;
}

/** In-memory only, never persisted. Entries older than this are read again. */
export const CACHE_TTL_MS = 5 * 60 * 1000;

// Startup reads that never differ between screens for one user and role. A failed read is forgotten so it can be retried.
const MEMOISED_RPCS = new Set(['get_attendance_register_capabilities', 'get_original_capabilities']);

/** Look a value up in `store` or load it; remembers the promise (so concurrent callers share one request) until `ttl` passes. */
export function memoise<T>(store: Map<string, {at: number; value: Promise<unknown>}>, key: string, load: () => Promise<T>, now: () => number = Date.now, ttl = CACHE_TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && now() - hit.at < ttl) return hit.value as Promise<T>;
  const value = load();
  const entry = {at: now(), value};
  store.set(key, entry);
  value.catch(() => { if (store.get(key) === entry) store.delete(key); });
  return value;
}

export function createLiveBackend(config: RuntimeConfig): LiveBackend {
  const client = createBackendClient(config);
  const reads = createReadApi(client);
  const directory = createDirectoryApi(client);
  const memo = new Map<string, {at: number; value: Promise<unknown>}>();
  const singletons = new Map<string, unknown>();
  // Same error contract as the current application: BackendError carries rpc name, status and code.
  const call: Rpc = async (name, args = {}, signal) => {
    let result;
    try {
      const query = client.schema('mass_api').rpc(name, args);
      result = await (signal ? query.abortSignal(signal) : query);
    } catch { throw new BackendError({message: 'network'}, 0, false, name); }
    if (result.error) throw new BackendError(result.error, result.status, false, name);
    return result.data;
  };
  // Argument-free startup probes are asked once and shared by every screen (an abort signal is never passed for them).
  const startupAware: Rpc = <T = unknown>(name: string, args?: Record<string, unknown>, signal?: AbortSignal) => (MEMOISED_RPCS.has(name) && !args && !signal
    ? memoise<unknown>(memo, `rpc|${name}`, () => call(name))
    : call<T>(name, args, signal)) as Promise<T>;
  // Reads are remembered for five minutes; a save clears them and the shared services (see readCache.ts).
  const clearServices = () => { for (const value of singletons.values()) { const clear = (value as {clear?: () => void}).clear; if (typeof clear === 'function') clear.call(value); } };
  const readCache = createReadCache(startupAware, clearServices);
  const rpc: Rpc = readCache.rpc;
  return {
    rpc,
    shared<T>(key: string, create: () => T): T {
      if (!singletons.has(key)) singletons.set(key, create());
      return singletons.get(key) as T;
    },
    reset() { memo.clear(); readCache.clear(); singletons.clear(); },
    getSession: () => client.auth.getSession(),
    getUser: () => client.auth.getUser(),
    async signIn(email, password) { memo.clear(); readCache.clear(); singletons.clear(); await signInVerified(client, email, password, () => clearStoredSession(config)); },
    async signOut() {
      memo.clear(); readCache.clear(); singletons.clear();
      try { await client.auth.signOut({scope: 'local'}); } finally { clearStoredSession(config); }
    },
    readContext: signal => reads.context(signal) as Promise<ProgrammeContext>,
    readDirectory: () => memoise(memo, 'directory', () => (directory.centres as (options?: {signal?: AbortSignal}) => Promise<Array<{centre_id: string; donor_label?: string | null}>>)({})),
    readReferences: () => memoise(memo, 'references', () => reads.references() as Promise<References>),
    readCapabilities: () => memoise(memo, 'capabilities', async () => {
      const value = await discoverCapabilities((name: string) => rpc(name));
      const flags = value as {reviewedCharts?: boolean; reviewedAttendanceSeries?: boolean; activationControl?: boolean; writes?: Record<string, boolean>};
      return {reviewedCharts: Boolean(flags.reviewedCharts), reviewedAttendanceSeries: Boolean(flags.reviewedAttendanceSeries), writes: flags.activationControl === true ? {...flags.writes} : {}};
    }),
  };
}
