import {createBackendClient, clearStoredSession} from '../../../src/live/client.js';
import {signInVerified} from '../../../src/live/auth-page.js';
import {createReadApi} from '../../../src/live/reads.js';
import {createDirectoryApi} from '../../../src/live/directory.js';
import {discoverCapabilities} from '../../../src/live/backend-capabilities.js';
import {BackendError} from '../../../src/live/api.js';
import type {Backend, ProgrammeContext} from './controller';

export interface RuntimeConfig {mode: string; url?: string; publishableKey?: string; project?: string; readApi?: string; directoryApi?: string}

export type Rpc = <T = unknown>(name: string, args?: Record<string, unknown>, signal?: AbortSignal) => Promise<T>;

export interface References {
  academic_years: Array<{id: string; starts_on: string; ends_before: string}>;
  assessment_periods: Array<{id: string; academic_year_id: string; quarter: number}>;
  assessment_definitions: Array<{id: string; period_id: string}>;
}

export interface Capabilities {reviewedCharts: boolean; reviewedAttendanceSeries: boolean; /** Operational write gates from the server's activation control; anything missing means off. */ writes?: Record<string, boolean>}

export interface LiveBackend extends Backend {
  rpc: Rpc;
  readDirectory(signal?: AbortSignal): Promise<Array<{centre_id: string; donor_label?: string | null}>>;
  readReferences(signal?: AbortSignal): Promise<References>;
  readCapabilities(): Promise<Capabilities>;
}

export function createLiveBackend(config: RuntimeConfig): LiveBackend {
  const client = createBackendClient(config);
  const reads = createReadApi(client);
  const directory = createDirectoryApi(client);
  // Same error contract as the current application: BackendError carries rpc name, status and code.
  const rpc: Rpc = async (name, args = {}, signal) => {
    let result;
    try {
      const query = client.schema('mass_api').rpc(name, args);
      result = await (signal ? query.abortSignal(signal) : query);
    } catch { throw new BackendError({message: 'network'}, 0, false, name); }
    if (result.error) throw new BackendError(result.error, result.status, false, name);
    return result.data;
  };
  return {
    rpc,
    getSession: () => client.auth.getSession(),
    getUser: () => client.auth.getUser(),
    async signIn(email, password) { await signInVerified(client, email, password, () => clearStoredSession(config)); },
    async signOut() {
      try { await client.auth.signOut({scope: 'local'}); } finally { clearStoredSession(config); }
    },
    readContext: signal => reads.context(signal) as Promise<ProgrammeContext>,
    readDirectory: signal => (directory.centres as (options?: {signal?: AbortSignal}) => Promise<Array<{centre_id: string; donor_label?: string | null}>>)({signal}),
    readReferences: signal => reads.references(signal) as Promise<References>,
    async readCapabilities() {
      const value = await discoverCapabilities((name: string) => rpc(name));
      const flags = value as {reviewedCharts?: boolean; reviewedAttendanceSeries?: boolean; activationControl?: boolean; writes?: Record<string, boolean>};
      return {reviewedCharts: Boolean(flags.reviewedCharts), reviewedAttendanceSeries: Boolean(flags.reviewedAttendanceSeries), writes: flags.activationControl === true ? {...flags.writes} : {}};
    },
  };
}
