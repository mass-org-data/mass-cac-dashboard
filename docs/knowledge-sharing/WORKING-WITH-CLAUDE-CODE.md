# Working with Claude Code on the MASS CAC Dashboard

*A learning note for the analyst who built the application. A living document, last updated 14 November 2026 (about three pages).*

## 1. Why this note exists
The application was built in phases (PRs #8 to #17). Claude Code was then used to review it, find and fix a slow Overview, build a safe test bed, and start a rebuilt interface. This note records how the work was done so you can repeat it and judge the results yourself. The details live in the repo: `AGENTS.md` (project context), `docs/perf/` (measurements) and `web/README.md` (new interface).

## 2. How we worked
| Principle | In practice |
|---|---|
| **Give durable context** | `AGENTS.md` holds services, rules that must be preserved and validation commands. Claude reads it first; we update it as the project changes. |
| **Start read-only** | The first task forbade any change to GitHub, Supabase or Vercel and forbade printing secrets (names, token types and pass/fail only). |
| **Plan, then build in approved phases** | Stage 1 produced a written plan with measurements. Nothing changed until the owner replied "APPROVED: Phase N". One phase per approval. |
| **Authorise each risky step** | Every change to the preview database was shown first and applied only after a yes, with a written rollback. |
| **Production is off limits** | Production was only read (counts and timings, never personal data). All experiments ran on a separate preview project with synthetic data. |
| **Own branch** | One new branch (`perf/overview-load-and-ui-rebuild`). The analyst's branches and `main` were never touched. Only that branch is pushed; no PR until asked. |
| **Measure, prove, report faithfully** | Every claim has a number or a parity check, and every report says what was not measured or only partly met. |

## 3. What was done, in order
| Step | Result |
|---|---|
| **Setup check** (read-only) | Tools, GitHub, Vercel and Supabase verified. Repo checks passed. A secret API key had been used where a personal access token is needed. |
| **Risk found** | Vercel Preview and Production shared one Supabase URL, so every PR preview read and wrote production data. Variables were split and a build guard now prevents it. |
| **Test bed** | Full schema installed on the preview project from the repo's migrations, then 92 centres, 1,500 students, about 200,000 attendance rows (synthetic), plus Leadership, Teacher and Cluster Officer test accounts. |
| **Phase 0: branch** | The new branch merged the three newest PR #16 commits (12 files conflicted) so it holds #11 to #17. Tests proved the merge. |
| **Phase 1: measure** | Preview made runnable (project allow-list, matching CSP), a timing layer and a Playwright script added. Baseline: first scorecards 10.6 s, whole page 11.7 s, 111 requests, 6 of 8 scorecards failing. A real-browser HAR from production showed the same waterfall. |
| **Phase 2: fix** | No per-centre calls (totals proved identical), heavy reports queued two at a time, below-the-fold chart loaded on demand, startup trimmed. First scorecards 2.0 s, 10 requests, no failures. |
| **Phase 3: one small function** | A batched monthly attendance function replaced seven heavy reports. Identical on 63 test cases and on real preview data. Whole page 4.7 s with 11 requests. |
| **Phase 4: new foundation** | React interface in `web/`, built only behind a flag. Shared table, scorecard and state components; session and role controller that reuses the old app's checks. |
| **Phase 5: all screens** | Overview, Attendance, Student profiles, Assessments, Visits, Morarji, Annual donor summary and About rebuilt one per approval. Each was tested in a real browser on the preview data and its numbers checked against a direct database count where possible (for example the annual attendance, 86.0 percent). Every database change on preview (a missed migration, activation switches, seeded visits and a Morarji cohort) was shown first and approved. |
| **Menu** | All eight numbered items shown for every role; the ones a role cannot open are greyed out, not links, with an accessible reason (PR #18). |
| **Request audit** | Counted requests per screen per role, found two different problems (too many small round trips; a few heavy reports) and answered the Edge Functions question in writing (not used: they do not reduce database CPU). One owner approval per phase. |
| **Phase A (client)** | Startup reads shared per session, one shared data service per kind, five-minute in-memory cache. Moving between screens: 219/54/29 requests down to about 6/7/7. |
| **Phase B (batched reads)** | Five new read functions replaced per-centre loops (Leadership Visits 187 requests to 4; Annual donor 12.4 s to 1.5 s). Each equals the function it replaces, checks scope once for up to 100 centres, and the app falls back if the database lacks it. |
| **Phase C0/C1 (heavy report)** | `EXPLAIN (ANALYZE)` found a quadratic self-join and per-centre rescans; fixed, 540 results compared equal, 1.24 s to 0.18 s. Overview's two extra reports replaced by one 7 ms function. The covering index and the extra slice functions were measured and dropped. The attendance rollup (C2) was skipped by the owner. |
| **Revisits** | The owner's HAR showed queries on returning to a loaded page; a read cache cleared by any save made that 0 requests. The security scope re-check was deliberately kept. |
| **PR #19** | Opened against the PR #18 branch after merging that branch in and resolving the one conflict (this file's task list). |

## 4. Lessons worth copying
1. **Measure before fixing.** The database was not slow per call; the app started about 100 requests at once and the heavy ones timed out. A single timing could not have shown that, a request waterfall did.
2. **Make the test bed behave like production first.** The first preview measurement was misleading because one control was off and the code took a different path.
3. **Prove replacements give the same numbers.** Before removing 92 calls, Claude summed them and compared with the single report. Before swapping the monthly chart, it compared every month on real data.
4. **Use a safe fallback.** The client uses the new database function only if the backend advertises it, so one branch works on databases with and without it.
5. **Fresh-install files are not production.** Migrations replay on an empty database; production was built differently. Know which you are touching and write down the drift.
6. **Fix tests, not just runs.** One test failed only between 18:30 and 24:00 UTC (wrong time zone); the test was fixed. Another harness counted "Unavailable" as still loading until it was corrected.
7. **Automatic merges can duplicate text.** A token-level merge broke the build; the tests caught it at once. Resolve conflicts by intent (newer decision wins unless it lacks something), then run everything.
8. **Pin what you designed for.** The latest table library had a different API, so it was pinned to the version the design assumed.
9. **Test in two places.** Unit tests with accessibility checks passed, but a real browser found low colour contrast and a skipped heading level. Both fixed.
10. **Keep secrets out of chat and Git.** Test passwords live in a git-ignored file; only host names, key types and status codes were printed.
11. **Show the SQL first, dry-run, then apply.** Each preview change came with its statement and rollback, ran once as a rolled-back dry run, and only then for real. One switch (profiles) turned out to be blocked by the database on purpose, and was left alone rather than bypassed.
12. **Be explicit about gaps.** Unbuilt pieces (for example the Teacher student summary table) are listed, not silently dropped.
13. **Count before you design.** A requests-per-screen table per role, then a plan, found that most waste was call count, not slow SQL; the heavy SQL was a second, separate fix.
14. **Read the query plan, not the code.** `EXPLAIN (ANALYZE)` pointed at a self-join nobody suspected; two ideas from the plan (an index, a holiday join) showed no gain when measured and were not shipped.
15. **Measure with the owner's own tool.** The browser-tab complaint was verified by counting requests when returning to a screen, before and after.
16. **Preview can differ from Production.** Preview's function lacked a patch Production had; the new migration carries the patch so replacing it cannot drop it. Check before replacing.
17. **A faster page can break a test.** A check that counted every table row failed once the page rendered a second table sooner; the test was scoped, not the page.
18. **Noisy shared hardware needs repeats.** The same call took 0.18 s or 1.3 s on the shared-CPU instance; use medians and keep the outliers as evidence.

## 5. Where things stand
- **Done on branches:** Overview speed fix, batched monthly function, all eight screens of the new interface as the default at `/` (original at `/vanilla/`), the all-eight greyed-out menu (PR #18), and the request and CPU reduction (PR #19, Phases A, B, C0, C1, revisit cache; C2 skipped).
- **Results (Preview, real browser):** one cold pass through every screen is 34 requests for each role (was 225/61/38); moving between screens 6 to 7; returning to a loaded screen 0; Annual donor 1.2 s (was 12.4 s); the heavy report 0.18 s (was 1.24 s).
- **Not on Production:** nothing from this work is deployed. Three new migrations (`20261114120000`, `130000`, `140000`) and the earlier series migration exist only on the Preview database; the client works without them.
- **Open for the owner:** the gated Production release process (proposed, not built); merge order (#18, then #19; the earlier stack #11 to #15 first); create Teacher and Cluster Officer roles on real accounts; real visits data; Phase D (larger database compute) only if the CPU graph shows throttling; later tasks: Leadership editing student profiles (needs a permission decision).
- **Not measured yet:** the deployed Vercel preview with these changes, Production data volumes, mobile networks, several people signing in at once.

## 6. How to prompt well
1. State the **scope** ("preview only", "read-only").
2. State what is **forbidden** (secrets, production, merging, other branches).
3. Ask for a **final table** (item, status, notes) and for what was **not** tested.
4. Approve **one risky step at a time** and ask for the rollback first.
5. Ask Claude to **verify afterwards** and to compare against the old behaviour, not only to act.
6. Keep `AGENTS.md` current so a new session starts with the facts.
