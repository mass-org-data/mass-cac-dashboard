import {createClient} from '@supabase/supabase-js';
import {perfFetch} from './perf.js';

export function createBackendClient(config, storage = globalThis.localStorage) {
  return createClient(config.url, config.publishableKey, {
    db: {schema: 'mass_api'},
    global: {fetch: perfFetch()},
    auth: {
      storage,
      storageKey: `mass-auth-${config.project}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export function clearStoredSession(config, storage = globalThis.localStorage) {
  for (const suffix of ['', '-code-verifier', '-user']) storage.removeItem(`mass-auth-${config.project}${suffix}`);
}
