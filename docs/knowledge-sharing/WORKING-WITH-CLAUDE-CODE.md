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
| **Phase 5: Overview** | Rebuilt and compared value for value with the old Overview for all three roles: identical. Attendance is next. |

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
11. **Be explicit about gaps.** Unbuilt pieces (for example the Teacher student summary table) are listed, not silently dropped.

## 5. Where things stand
- **Done on the branch:** Overview speed fix (targets met on preview), batched monthly function (applied to preview only), new interface foundation and Overview.
- **Not on Production:** nothing from this work is deployed. The series migration is not on the production database; the client copes without it.
- **Open for the owner:** create Teacher and Cluster Officer roles on real accounts when needed; populate visits data; decide whether activities and monthly meetings are discarded (left untouched meanwhile); decide when to open the PR (base `fix/centre-event-review`, merge #11 to #15 first); a gated production release process is proposed but not built.
- **Not measured yet:** mobile networks, several people signing in at once (the likely cause of the 30 to 60 s reports), and the Playwright attendance suites in this environment.

## 6. How to prompt well
1. State the **scope** ("preview only", "read-only").
2. State what is **forbidden** (secrets, production, merging, other branches).
3. Ask for a **final table** (item, status, notes) and for what was **not** tested.
4. Approve **one risky step at a time** and ask for the rollback first.
5. Ask Claude to **verify afterwards** and to compare against the old behaviour, not only to act.
6. Keep `AGENTS.md` current so a new session starts with the facts.
