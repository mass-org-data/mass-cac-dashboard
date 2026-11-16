import {vi} from 'vitest';
// A database without the Phase B functions answers 404 / PGRST202 for them; used to test the per-centre fallbacks.
const BATCHED = new Set(['visit_coverage', 'read_visits_v2', 'morarji_followup', 'student_profile_page_v3', 'reviewed_attendance_by_centre_month']);
export const missingFunction = () => Object.assign(new Error('missing'), {status: 404, code: 'PGRST202'});
export const legacy = <A extends unknown[], R>(impl: (name: string, ...args: A) => Promise<R>) =>
  vi.fn(async (name: string, ...args: A) => { if (BATCHED.has(name)) throw missingFunction(); return impl(name, ...args); });
