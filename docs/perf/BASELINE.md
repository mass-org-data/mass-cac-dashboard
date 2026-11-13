# Overview load baseline (13 November 2026)

Recorded before any loading change, on branch `perf/overview-load-and-ui-rebuild` (commit `c314588` plus the harness fix in the commit that adds this file).

## How it was measured
- **Tool:** `npm run perf:overview -- --runs 7 --label baseline` (`scripts/perf/overview-waterfall.mjs`), Playwright Chromium 140 on the author's Mac, fresh browser context per run (cache-cold), sign-in then reload, Leadership test account.
- **Backend:** the PREVIEW Supabase project (`nilzfsahxoxibvrwsqkd`), synthetic data: 92 centres, 1,500 students, 200,730 attendance rows, 3,661 assessment results. Controls: `reviewed_reads` enabled (so the app takes the same reviewed-chart path as production).
- **App build:** local `dist/` built with the preview URL, served with the headers from `vercel.json` (CSP included). No CSP violations were seen.
- **T1:** first five scorecards no longer loading. **T2:** nothing loading, nothing in flight, stable for 750 ms. A card showing "Unavailable" counts as finished loading but is reported as failed.
- **Not measured:** the production waterfall (production runs Phase A code from `main`; a HAR from a real slow production login is still to be compared), and mobile or slow networks.

## Result (7 runs)
| Metric | Median | p75 | Target |
|---|---|---|---|
| T1, first scorecards | 10.6 s | 12.2 s | 3 s or less |
| T2, everything finished | 11.7 s | 13.4 s | 6 s or less |
| RPC and auth requests | 111 | | 12 or fewer |
| Peak simultaneous requests | 25 to 102 | | |
| Runs with failed cards | 7 of 7 | | 0 |
| HTTP 5xx responses | 50 over 7 runs (6 to 10 per run) | | 0 |

Every run showed 6 of the 8 Overview scorecards as "Unavailable".

## Request mix (one representative run)
| Call | Count | Total time | Longest |
|---|---|---|---|
| `reviewed_chart_metrics` (all 92 centres) | 10 | 117 s | 14.9 s |
| `programme_aggregate` (one per centre) | 92 | 91 s | 8.3 s |
| `get_context` | 5 | 2.4 s | 1.2 s |
| `auth/v1/user` | 5 | 1.0 s | 0.6 s |
| `get_centre_directory`, `get_references`, `get_original_capabilities`, two capability probes | 1 each | under 0.5 s each | |

## Findings
1. **The problem reproduces.** The Overview starts about 10 heavy `reviewed_chart_metrics` calls and 92 `programme_aggregate` calls at the same moment (about 100 in flight).
2. **The failures are statement timeouts, not code errors.** Run alone, one `reviewed_chart_metrics` call takes about 3.1 s on preview. Run 10 at a time, all 10 fail after 10 s with "canceling statement due to statement timeout". The failed calls produce the "Unavailable" cards.
3. **The database is CPU-bound under concurrency.** Earlier serial timings were small (92 aggregate calls in under 1.5 s), so the cost is the number of simultaneous heavy calls, not one slow query.
4. **Other duplicates confirmed:** `get_context` 5 times, `auth/v1/user` 5 times, capability probes before first paint.

## Caveats
- Preview is a harsher benchmark than production for the heavy call: one call takes about 3.1 s on preview but 0.3 to 0.6 s in production (measured under row-level security, serial). The function bodies differ only in how the `H` holiday code is treated, so the gap is data-related (preview has 2.4 times production's attendance rows and a record for every student on every non-Sunday). Production's own `pg_stat_statements` show a mean of 865 ms and a maximum of 7,995 ms for the same call, which is consistent with contention near the 8 s limit.
- Absolute preview numbers should be read as "worse than production"; the relative change after each fix is what matters. Consider trimming preview attendance toward production's volume before setting final targets.
- The harness is single-machine and single-network; results vary by a second or two.
