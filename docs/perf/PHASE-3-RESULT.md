# Phase 3 result: batched monthly attendance series (13 to 14 November 2026)

Applied to the PREVIEW project only (migration `20261113120000_reviewed_attendance_series.sql`, then `seal.sql` re-run). Production is untouched; it receives this only through the normal merge and gated release.

## What changed
`mass_api.reviewed_attendance_series(p_centres, p_year, p_today, p_grade, p_shift, p_gender)` returns every elapsed month's attendance (present, absent, leave, excluded, and P / (P + A + L)) in one request. It replaces seven all-centre `reviewed_chart_metrics` reports for the Overview line chart. Same scope check, filter validation and confirmed-holiday handling as `reviewed_chart_metrics`; sealed behind `reviewed_reads`; advertised as `reviewed_attendance_series` by `get_original_capabilities`. The client uses it only when advertised and otherwise falls back to the per-month path.

## Verification
- Isolated PostgreSQL: identical to `reviewed_chart_metrics` on 63 month and filter combinations; scope, input, anonymous and seal checks pass; the 1,440-case calculation suite still passes.
- Preview, real synthetic data (92 centres, 200,730 attendance rows): the series equals `reviewed_chart_metrics` for every month July to November on p, a, l, excluded and percentage (for example November 12,622 / 1,351 / 727).
- Preview function state: sealed (22 guarded functions now), owner `mass_core_owner`, `SECURITY DEFINER`, `jit=off`, executable by `authenticated` only.
- One series call takes about 2.4 s on preview for all months, against about 3 s for each of seven separate reports.

## Result (7 cache-cold runs, preview, median / p75)
| Metric | Baseline | Phase 2 | Phase 3 | Target |
|---|---|---|---|---|
| T1, first scorecards | 10.6 s / 12.2 s | 2.0 s / 3.4 s | 2.0 s / 2.9 s | 3 s or less |
| T2, first screen finished | 11.7 s / 13.4 s | 3.3 s / 4.2 s | 3.3 s / 3.7 s | 6 s or less |
| T3, including the monthly chart | n/a | 12.0 s / 18.7 s | 4.7 s / 5.1 s | |
| Requests by T2 | 111 | 10 | 10 | 12 or fewer |
| Requests in total | 111 | 17 | 11 | |
| Longest single request | 14.9 s (26.7 s worst) | about 2.2 s | 1.5 s typical, 2.6 s worst of 7 runs | 2 s or less |
| Failed cards / HTTP 5xx | 7 of 7 / 50 | 0 / 0 | 0 / 0 | 0 |

Every target in the plan is met on preview (the slower of the two databases for the heavy reports), with one exception: in one of the seven runs a single report took 2.6 s, just over the 2 s per-request target.

## Rollback
`DROP FUNCTION mass_api.reviewed_attendance_series(uuid[],uuid,date,text,text,text);` then re-run the previous seal (`git show 1497c74:supabase/activation/seal.sql`). The client falls back to the per-month path without a redeploy.

## Not done
No summary table, view or materialized view was needed. Production still shows the old waterfall until this branch is merged and released. Not measured: mobile networks, several simultaneous users.
