import {createBackendClient, clearStoredSession} from '../../../src/live/client.js';
import {signInVerified} from '../../../src/live/auth-page.js';
import {createReadApi} from '../../../src/live/reads.js';
import {createDirectoryApi} from '../../../src/live/directory.js';
import type {Backend, ProgrammeContext} from './controller';

export interface RuntimeConfig {mode: string; url?: string; publishableKey?: string; project?: string; readApi?: string; directoryApi?: string}

export interface LiveBackend extends Backend {
  readDirectory(signal?: AbortSignal): Promise<Array<{centre_id: string; donor_label?: string | null}>>;
}

export function createLiveBackend(config: RuntimeConfig): LiveBackend {
  const client = createBackendClient(config);
  const reads = createReadApi(client);
  const directory = createDirectoryApi(client);
  return {
    getSession: () => client.auth.getSession(),
    getUser: () => client.auth.getUser(),
    async signIn(email, password) { await signInVerified(client, email, password, () => clearStoredSession(config)); },
    async signOut() {
      try { await client.auth.signOut({scope: 'local'}); } finally { clearStoredSession(config); }
    },
    readContext: signal => reads.context(signal) as Promise<ProgrammeContext>,
    readDirectory: signal => (directory.centres as (options?: {signal?: AbortSignal}) => Promise<Array<{centre_id: string; donor_label?: string | null}>>)({signal}),
  };
}
