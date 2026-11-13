# Phase 2 result: Overview loading fix (13 November 2026)

Client-side change only. No database change. Same method and backend as `BASELINE.md` (preview project, synthetic data, `reviewed_reads` on, Chromium 140, 7 cache-cold runs, Leadership account).

## What changed
1. **No per-centre aggregate calls with reviewed charts.** `loadAggregates` returns early when the backend has reviewed charts, and `__massAggregateFor` now builds the same aggregate shape from the one all-centre reviewed report the scorecards already use (`src/live/reviewed-aggregate.js`). Removes 92 `programme_aggregate` calls. Checked on preview: summed per-centre aggregates equal the reviewed report exactly (1,470 students, 802 girls, 668 boys, grade counts, 12,622 present / 1,351 absent / 727 leave).
2. **Heavy reports are queued, two at a time** (`src/live/limiter.js`), instead of all starting together. One report alone takes about 3 s on preview and about 0.4 s on production; ten at once exceeded the statement timeout.
3. **The twelve-month attendance chart loads when it comes into view** (`observeLazyMonths` in `src/app.js`). Its seven extra monthly reports no longer compete with the first screen.
4. **Startup:** the two capability probes now run in parallel with the first reads, and the startup refresh reuses the identity and scope that were just verified, removing a duplicate `get_context` and `auth/v1/user`. The 30-second re-verification timer and every other verification are unchanged.

## Result (median / p75 of 7 runs)
| Metric | Baseline | After | Target | Met |
|---|---|---|---|---|
| T1, first scorecards | 10.6 s / 12.2 s | 2.0 s / 3.4 s | 3 s or less | median yes, p75 just over |
| T2, first screen finished | 11.7 s / 13.4 s | 3.3 s / 4.2 s | 6 s or less | yes |
| Requests by T2 | 111 | 10 | 12 or fewer | yes |
| Requests in total (incl. chart months) | 111 | 17 | | |
| T3, including the below-the-fold chart | n/a | 12.0 s / 18.7 s | | see note |
| Runs with failed cards | 7 of 7 | 0 of 7 | 0 | yes |
| HTTP 5xx | 50 | 0 | 0 | yes |
| Peak simultaneous requests | 25 to 102 | 6 | | |

All eight scorecards render real values: 92 centres, 1,470 students, 802 girls, 668 boys, 8 donors, 438 students scoring above 20 (this card was "Unavailable" before). Students by grade, gender and shift and the centre comparison table render.

## Notes and limits
- **T3 is slow on preview** because each monthly report takes about 1 to 2 s here against about 0.4 s on production (see the baseline caveat), and the chart's seven reports still run two at a time. The chart fills in progressively. A single batched monthly call (Phase 3) is the next lever if this matters.
- T1 p75 is 0.4 s over target in two runs that also had slow startup calls; the median is 2.0 s.
- Production gets none of this until the branch is merged and deployed. Expect production to be faster than preview for the heavy reports.
- Not measured: mobile networks, several simultaneous users, the Teacher and Cluster Officer Overview pages.
