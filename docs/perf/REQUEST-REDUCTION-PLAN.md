<!-- Approved by the owner on 14 November 2026. Work branch: perf/request-reduction (cut from perf/overview-load-and-ui-rebuild at a5fcb3d). One approval per phase: at the start of each phase send a short summary and wait for the go-ahead. Phase status is tracked at the bottom. -->
# Plan: cut database requests and database CPU on every screen (request audit and reduction strategy)

Read-only investigation done (code reading by research agents, preview and production read-only SQL counts and timings, timing probes through the API with the Leadership test account). Nothing has been changed. The earlier overview/UI-rebuild plan that lived in this file is complete and has been replaced.

## Context
Per-screen requests measured on the deployed preview (cold from sign-in / warm from the menu): Overview 8/7, Attendance 8/7, Student profiles Teacher 5/4 and Cluster Officer 13/12, Assessments 5/4, **Visits Leadership 187/186**, Morarji Leadership 4/3 and Teacher 6/5 and **Cluster Officer 22/21**, **Annual donor summary (Leadership) 12/12**, About 1/0. One pass through every screen a role can open: Leadership 225, Cluster Officer 61, Teacher 38 requests. Owner decisions: do everything including rollups; cached numbers may be up to 5 minutes stale (saves always refresh what they touch); all of this work goes on a **new branch cut from the current branch** so it stays separate from the work done so far; preview database changes do not need approval one by one (the preview exists for this) but each phase starts with a short summary of what will change, and each phase is approved before it begins.

**Before work starts:** the conversation context is very large; the owner can run `/compact` first (everything needed is in this plan file, `AGENTS.md`, `docs/perf/` and my memory notes).

## Findings: two different problems
**1. Too many tiny round trips (request count).** The server reads were designed as bounded single-centre calls, so the browser loops:
- Leadership Visits = 3 startup + `visit_summary` x 92 + `visit_officer_summary` x 92 (`web/src/visits/service.ts`). Server time is under 1 ms each (production stats); each call costs 40-90 ms of round trip. 184 calls = 1.8 s wall at six in parallel.
- Cluster Officer Morarji = 3 + 1 report + `read_morarji` x 9 + `read_students` x 9 (`web/src/morarji/service.ts`, `profiles/service.ts`). Cluster Officer Profiles = 3 + 1 page + `read_students` x 9: the client reads whole rosters to show 10 rows, because `student_profile_page_v2` returns only 10 enrolment ids.
- Every screen re-runs `get_references`, `get_original_capabilities`, `get_centre_directory` (and register capabilities twice via two services): `web/src/session/backend.ts` has no memoisation, and each page builds its own `OverviewService`, so the identical all-centre `reviewed_chart_metrics` report is fetched again by Overview, Attendance, Assessments, Morarji and the Annual page.
- Overview spends 2 extra full reports (Morning, Evening) to get two integers (`web/src/data/overview.ts:56-60`).

**2. A few very heavy reports that burn database CPU (wall time).**
- `reviewed_chart_metrics` is 96 percent of database time on Production (17 calls, mean 2.8 s, max 11 s in the current stats window). On preview: 92 centres one month 1.3-1.6 s alone, 9 centres 0.4 s, 1 centre 0.2 s.
- It computes everything on every call (population, attendance with a correlated holiday `EXISTS` per row, attendance bands via `generate_series` per enrolment, assessments, Morarji, activities, about 8 correlated subqueries per centre) while each screen shows a slice. It lives only in `supabase/proposals/202611030024_reviewed_chart_metrics.sql`, not in the migration history.
- Run two at a time (as the Annual page does) it degrades badly: 8 monthly reports took 8.5, 14.9 and 17.0 s on three repeats versus 1.9 s one after another. The instance has no compute add-on (Micro-class: 2 shared-CPU cores, 1 GB); the database is only 153 MB with a 100 percent cache hit, so this is CPU contention or burst throttling, not disk. Unconfirmed until the Supabase CPU graph is checked.

**Answers to the owner's questions.**
- *Are the calls written suboptimally?* Yes, in four specific ways: per-centre loops, no sharing of startup reads or reports between screens, one monolithic report serving every screen, and whole-roster reads to render 10 rows.
- *Pre-aggregate on the server and call it?* Yes, for both problems: batched functions collapse loops into one call; slice functions plus an attendance rollup remove the CPU cost.
- *Attendance rate per session instead of per student record?* Store **counts, never rates** (rates cannot be added; the rule is to sum P, A, L before dividing). Measured on preview: a centre-shift-day summary is 12,421 rows (16x smaller than 200,731 records) and suits the register page, but once grade and gender filters are included the day grain is 87,515 groups (no saving). The grain that keeps the exact approved semantics (population = enrolments active on the reporting day, then that enrolment's marks over the whole month) is **per enrolment per month** (about 12-25k rows): grade, shift and gender are read from the enrolment and profile at query time.

**Supabase Edge Functions versus Postgres functions (and will Edge Functions help?).** A Postgres function (what `mass_api.*` are) runs inside the database, next to the data: no network hop, set-based SQL, and it is already what holds our permission checks. An Edge Function is TypeScript (Deno) running on Supabase's serverless edge, invoked over HTTP, that talks to the database through a pooled connection like any other client; it runs near the caller unless pinned to the database region with the `region` option ([Supabase regional invocation](https://supabase.com/docs/guides/functions/regional-invocation)). Supabase's own guidance is that database functions, being colocated with Postgres, suit database-intensive work, while Edge Functions suit orchestration, third-party calls, webhooks and secrets ([Edge Functions docs](https://supabase.com/docs/guides/functions)). For this app: (1) they do **not** reduce database CPU, which is our slow-page cause: the heavy aggregation must stay in SQL, because pulling 200,000 rows out to JavaScript would be slower; (2) they **could** collapse the browser's per-centre loops into one request (an Edge Function in the database region looping 92 queries at a few milliseconds each), but a batched Postgres function does the same in one query without a second runtime, cold starts (about 100-400 ms, third-party figures), deployments, secrets, CORS and a second place to enforce scope (the user's token would have to be forwarded so row-level security still applies); (3) there is no shared cache in them that is safe for private per-user data. **Conclusion: not used in this plan.** Revisit only for jobs that are not queries (for example a scheduled summary refresh or notifications), where `pg_cron` or an Edge Function could be used.

## Strategy (all phases, in order)

### Step 0: new branch (first action once approved)
`git switch -c perf/request-reduction` from the current head of `perf/overview-load-and-ui-rebuild`; push only the new branch; PR #18 and every existing branch stay untouched. Record the plan, the before measurements (`pages-react.mjs`) and a memory note first, so a compacted session can resume from the repo.

### Phase A: client only, no database change (about 3 days)
- `web/src/session/backend.ts` (`createLiveBackend`): memoise `readReferences`, `readCapabilities`, `readDirectory` as promises, evicted on rejection; also the register-capabilities probe now duplicated in `attendance/service.ts` and `profiles/service.ts`.
- One app-wide data layer (create next to the backend in `web/src/app/App.tsx`, pass down): reuse `createOverviewService` (cache key already `report|year|today|quarters|selection`, `web/src/data/overview.ts:49`) and the profiles roster cache as single shared instances so Overview, Attendance, Assessments, Morarji and the Annual page deduplicate. Add a small in-memory TTL (5 minutes, stale-while-revalidate) keyed by user + role + scope version; clear on sign-out, role change and when the 30-second scope check changes; every save invalidates its keys (extends the existing `overview.clear()` calls in `Attendance.tsx:108`, `Assessments.tsx:87`). In memory only, never persisted. TanStack Query is the preferred implementation (staleTime 5 min, gcTime >= staleTime), not a hand-built store.
- Put the six-at-a-time limiter on the Morarji and Profiles centre fan-outs (`Promise.all` today); do not refetch Assessments when only the round selector changes.

### Phase B: additive migration, small server functions (about 6 days, preview approval)
All new names (never overloads: `seal.sql` aborts on overloads), SECURITY DEFINER, `search_path` pinned, scope checked once over the array (`cardinality(p_centres)` 1..100, every centre `can_read`/`can_write`/`can_record_visit` as the old function does), REVOKE/GRANT like `20261113120000_reviewed_attendance_series.sql`:
- `visit_coverage(p_centres uuid[], p_from date, p_until date, p_officer uuid DEFAULT NULL) RETURNS jsonb`: summary rows and per-officer rows (with `centre_id`) in one call; keeps the one-calendar-month rule. Leadership Visits 187 to about 4.
- `read_visits_v2(p_centres uuid[], p_from date, p_until date, p_after text DEFAULT NULL, p_limit int DEFAULT 100)`: keyset paging, total cap not per centre, keeps the `created_by = request_user_id()` filter.
- `morarji_followup(p_centres uuid[], p_cohort text)`: memberships plus outcomes joined to student id and name (rows the caller may not read are omitted, names only where `can_read_profile`). Cluster Officer Morarji 22 to about 4.
- `student_profile_page_v3(...same args as v2...)`: returns the 10 rows with their details (name, id, centre, grade, shift, gender, enrolled, status, board, row_version), so `read_students` is not needed for the list. Cluster Officer Profiles 13 to about 4; the client stops loading whole rosters.
- `reviewed_attendance_by_centre_month(p_centres uuid[], p_year uuid, p_today date, p_grade, p_shift, p_gender) RETURNS jsonb`: one row per centre x month with p, a, l, excluded (no percentage averaging), the same population rule as the series function. Replaces the 8 Annual reports with 1 call; the old `reviewed_attendance_series` and `reviewed_chart_metrics` stay for fallback.
- Gate and seal each (reads under `reviewed_reads` where they use the reviewed calculations): allow-list at `supabase/activation/seal.sql:9`, gate CASE map, capability advertising inside `seal.sql` (it is redefined on every install), a row in `supabase/activation/API-GATES.csv`, review hashes, `tests/release/portable-sql.mjs`. Client adopts each function when advertised, otherwise falls back (test the fallback in CI with the functions not advertised).

### Phase C: database CPU (about 12 days, preview approvals)
- **C0 (measure first, 2 days):** install `reviewed_chart_metrics` as a reviewed migration (today only the proposal file) including the H-code patch the install step applies, so changes are reviewable and the numbers cannot drift. Then rewrite its `raw_marks` (replace the per-row holiday `EXISTS` with a join to the small set `cac_sessions WHERE NOT is_scheduled`), add a covering index such as `attendance_records(enrolment_id, attendance_date) INCLUDE (code, centre_id, shift_code)`. Parity run, then time 92 centres x one month and the Annual page again.
- **C1 slices (4 days):** split what each screen shows into functions that compute only their slice: population summary (children, grades, genders and the per-shift counts, per centre; removes the two extra Overview reports), assessment summary (quarters, changes), Morarji summary. `reviewed_chart_metrics` stays unchanged for compatibility.
- **C2 attendance rollup (5-6 days):** table `mass_core.attendance_rollup(enrolment_id, month, centre_id, shift_code, n_p, n_a, n_l, n_wo, n_mm, n_h, n_other, each also split by on_holiday)`: raw per-code counts, the exclusion rule (H, WO, MM, holiday) applied at read time so the H patch cannot cause drift. Maintained by statement-level triggers with transition tables on `attendance_records` (insert, update including re-pointing the enrolment, date, code, centre or shift, delete) using atomic `INSERT ... ON CONFLICT DO UPDATE SET n = n + excluded.n` inside the existing per-centre-shift-day advisory lock, plus a trigger on `cac_sessions` that adjusts the affected rows when a holiday is added, changed or removed. Enrolment start/end edits need no maintenance (population is evaluated at read time). Ship `mass_core.rebuild_attendance_rollup(p_centre uuid DEFAULT NULL)` and a reconcile view; the rollup is never the only copy. The attendance slice and the by-centre-month function read the rollup. Optional afterwards: a centre-shift-day summary for the register page (`attendance_register_summary_v4` stacks v4 over v3 over v2 over v1 with a lateral audit lookup per row).
- Triggers must not slow saves: measure `save_attendance_register_v3` and `save_classroom_register` before and after.

### Phase D (only on evidence): compute size
Large (dedicated 2-core, 8 GB, about 0.15 USD/hour) is the first dedicated-CPU size; Micro, Small and Medium share CPU. Decide after the Supabase CPU graph shows throttling and after Phases B and C.

## Predicted requests (estimates, to be measured)
Assumes startup reads shared and cached for the session (about 5 once), 5-minute cache.

| Screen / role | Now (cold) | After A+B | After C |
|---|---|---|---|
| Overview | 8 | about 4-5 | 3-4 |
| Attendance | 8 | 2 own | 2 |
| Profiles Cluster Officer / Teacher | 13 / 5 | 1 / 1 own | 1 |
| Assessments | 5 | 1 own | 1 |
| Visits Leadership | 187 | 1 own | 1 |
| Morarji Cluster Officer | 22 | 1-2 own | 1-2 |
| Annual donor | 12 | 1 own | 1 |
| One pass through every screen: Leadership / Cluster Officer / Teacher | 225 / 61 / 38 | about 15 / 15 / 14 | about 12 / 13 / 12 |

Wall-time targets (to confirm): Annual page 12 s to under 1.5 s; Leadership Overview first screen 3.5 s to under 1.5 s; Leadership Visits 1.5 s to under 0.5 s; every revisit within 5 minutes served from the cache.

## Owner approvals needed
1. **One approval per phase** (A, B, C0, C1, C2, D): at the start of each phase I send a short summary (what will change in code and in the preview database, expected effect, rollback) and wait for your go-ahead. Inside an approved phase, preview database changes are applied without asking again (dry run first, rollback SQL kept, a note of what was applied afterwards).
2. Production is never touched by this work: it gets these changes only through a gated release (not built yet) after you separately approve it. Phase A (client only) reaches users with the next deploy.
3. Phase D (compute size) only after the CPU graph review.
4. Existing branches and PR #18 are not modified; this work has its own branch and its own PR when you ask.

## Verification
- Before/after tables with `node scripts/perf/pages-react.mjs --runs 3` (now also prints requests per screen) and `scripts/perf/overview-react.mjs`, same preview project, cold and warm, per role; run the Annual page three times in a row (it worsened on repeats). Compare with `docs/perf/PAGE-LOAD-RESULT.md`.
- Parity: `tests/reviewed-calculations/attendance-series.sql` style test for the new by-centre-month function against `reviewed_chart_metrics` for every filter combination (`hosted-filter-matrix.sql`); slices must add up to the old payload (extend `cases.mjs`/`compare.mjs`, 1,440 cases); rollup test after each of insert, update, delete, holiday add/remove, re-pointed enrolment, import and register save: rollup equals a fresh recompute, including H code, mid-month enrolment start/end, null gender; scope tests (out-of-scope centre, more than 100 centres, empty array, profile unreadable); extend `tests/performance/reviewed.sql`.
- Run `npm run test:sql:portable`, the web unit tests (add a fallback test with the new functions not advertised and cache tests: key isolation per user and role, clearing on sign-out and role change, invalidation after saves) and `node scripts/perf/attendance-live.mjs`; numbers must equal today's (for example the Annual 86.0 percent, Morarji 150/104/39/55).

## Risks
Trigger overhead on the attendance save path; rollup drift if a path writes outside the triggers (reconcile check); stale numbers across users (5-minute limit, own saves refetch); capability fallbacks rot unless tested; `seal.sql` allow-list, hashes and capability advertising must be updated together; the proposal-file `reviewed_chart_metrics` must be turned into a migration with the H patch before it is changed.

## Critical files
`web/src/session/backend.ts`, `web/src/app/App.tsx`, `web/src/data/overview.ts`, `web/src/visits/service.ts`, `web/src/morarji/service.ts`, `web/src/profiles/service.ts`, `web/src/pages/{Visits,Morarji,Profiles,AnnualDonor,Overview,Attendance,Assessments}.tsx`, `supabase/proposals/202611030024_reviewed_chart_metrics.sql`, `supabase/activation/seal.sql`, `supabase/activation/API-GATES.csv`, `supabase/migrations/20261113120000_reviewed_attendance_series.sql` (pattern to copy), `tests/release/portable-sql.mjs`, `tests/reviewed-calculations/attendance-series.sql`, `scripts/perf/pages-react.mjs`.

## Phase status (update as work proceeds)
| Phase | Status |
|---|---|
| Step 0: branch, plan saved, memory | done (14 Nov 2026) |
| A: client only (memoised startup reads, shared cache, limiters) | done, see PHASE-A-RESULT.md |
| B: batched read functions (preview migration) | done on preview, see PHASE-B-RESULT.md |
| C0: install reviewed_chart_metrics as a migration, rewrite hot spots | done on preview, see PHASE-C0-RESULT.md (no index needed) |
| C1: slice functions | not started |
| C2: attendance rollup | not started |
| D: compute size | only on evidence |

Baseline measurements for comparison: `docs/perf/PAGE-LOAD-RESULT.md` (cold and warm time per screen and database requests per screen, deployed preview, 3 runs), `docs/perf/DEPLOYED-OVERVIEW-RESULT.md`, `docs/perf/CACHING-OPTIONS.md`.
