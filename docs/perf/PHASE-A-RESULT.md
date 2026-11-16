# Phase A result: client-only request reduction

Branch `perf/request-reduction`. No database change. Measured with `scripts/perf/pages-react.mjs --runs 2 --label phase-a` on a local build against the Preview Supabase project (synthetic data).

## What changed
- Startup reads (references, capabilities, centre directory, register capabilities) are asked once per signed-in session and shared by every screen (`web/src/session/backend.ts`).
- One shared Overview, Profiles and Morarji data service per session (`web/src/data/shared.ts`), so screens reuse each other's all-centre report and rosters.
- Everything cached is in memory only, expires after 5 minutes, is dropped on sign-in, sign-out and role change (a scope change already signs the user out), and registering a student also clears the shared reports. Overview/Attendance/Assessments saves already cleared them.
- Morarji and Profiles per-centre reads run at most six at a time.
- Assessments already did not refetch on a round change (only the quarter pair is in its key); nothing to change.

## Requests per screen, warm (moving between screens in one session)
| Role | Before (one pass) | After (one pass) |
|---|---|---|
| Leadership | 219 | 195 (Visits alone is 184; fixed in Phase B) |
| Cluster Officer | 54 | 24 (Profiles 10 and Morarji 9 remain; Phase B) |
| Teacher | 29 | 9 |

Overview now costs 0 requests when revisited within 5 minutes.

## Not changed by design
Cold counts (a fresh sign-in loading one screen) are the same as before (Leadership Visits 187, Cluster Officer Morarji 22, Annual donor 12), because the cold test starts a new browser for each screen. Annual donor still takes about 11 s. Phase B and C address these.

Not measured: the deployed Vercel preview (this was a local build), wall-time gains beyond the request counts.
