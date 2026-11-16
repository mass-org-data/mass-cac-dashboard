// A read-through cache for the read-only server calls, so returning to a screen that was already loaded does not ask the
// database again. In memory only, never persisted; entries expire after five minutes (the staleness the owner accepted);
// identical concurrent calls share one request; a failure is forgotten so it can be retried.
// Any save, correction or deletion clears the whole cache (and calls `onWrite`, which clears the shared data services), so a user
// always sees their own changes at once. The backend drops it all on sign-in, sign-out and role change.
// Never cached: register reads that open a record for editing, version tokens, history and anything not listed here.
import {CACHE_TTL_MS, memoise} from './backend';
import type {Rpc} from './backend';

export const CACHED_READS = new Set([
  'attendance_register_page', 'attendance_present_distribution', 'assessment_register_summary', 'student_profile_page_v2', 'student_profile_page_v3',
  'visit_coverage', 'visit_summary', 'visit_officer_summary', 'read_visits', 'read_visits_v2', 'get_visit_assignments', 'read_morarji', 'morarji_followup',
  'read_students', 'reviewed_chart_metrics', 'reviewed_attendance_series', 'reviewed_attendance_by_centre_month', 'reviewed_shift_counts',
]);
export const isWrite = (name: string) => /^(record_|save_|delete_|register_|correct_|add_|close_|transfer_|create_)/.test(name);

export function createReadCache(call: Rpc, onWrite: () => void = () => undefined, now: () => number = Date.now) {
  const store = new Map<string, {at: number; value: Promise<unknown>}>();
  const rpc: Rpc = <T = unknown>(name: string, args?: Record<string, unknown>, signal?: AbortSignal) => {
    if (CACHED_READS.has(name) && !signal) return memoise<T>(store, `${name}|${JSON.stringify(args ?? {})}`, () => call<T>(name, args), now, CACHE_TTL_MS);
    if (!isWrite(name)) return call<T>(name, args, signal);
    store.clear(); onWrite();
    // The outcome of a save is not always known to the caller, so clear again once it has settled, whether it worked or not.
    const settle = () => { store.clear(); onWrite(); };
    const result = call<T>(name, args, signal);
    result.then(settle, settle);
    return result;
  };
  return {rpc, clear: () => store.clear()};
}
