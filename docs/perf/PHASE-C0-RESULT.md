# Phase C0 result: reviewed_chart_metrics in the migration history, and faster

Branch `perf/request-reduction`. Migration `supabase/migrations/20261114130000_reviewed_chart_metrics_efficiency.sql`, applied to the PREVIEW database only (dry run rolled back first; then one transaction with the seal re-run). Production is untouched.

## What changed
- The function's source is now in the migration history. It upgrades the function only where it is already installed (Production, Preview); a fresh database installs the reviewed proposal and then re-applies this file (the portable SQL test does that).
- Production's installed copy carries the 20261110 Holiday (H) exclusion; Preview did not (it was installed from the proposal after that migration). The new body includes the H patch, so Preview now matches Production here: `excluded` counts H marks and the attendance-band "complete day" rule treats H like WO/MM. Percentages P/(P+A+L) are unchanged because H is never in the denominator.
- Four speed-ups found by `EXPLAIN (ANALYZE)` on 92 centres, one month (preview, 1,472 enrolments, 200,731 marks):
  1. quarter-pair join did a quadratic self-join of every score row with every other: about 0.7 s of the 1.9 s plan; now one pass per child;
  2. per-centre attendance scanned the month's marks once per centre (92 scans); now grouped once;
  3. per-centre quarter statistics, same pattern; now grouped once;
  4. the attendance-band join read the whole attendance table; now limited to the reporting month.
- Not done: the covering index and the holiday join. Measured with and without: the existing indexes already serve the holiday lookup (one row in `cac_sessions` on Preview) and the index showed no clear gain, so it was not added (no extra write cost on the save path). Revisit if Production's holiday volume shows otherwise.

## Results (preview, authenticated Leadership, 92 centres, November 2026)
| | Before | After |
|---|---|---|
| `reviewed_chart_metrics`, median of runs | 1.24 s | 0.18 s |
| Leadership Overview, cold sign-in to settled | 3.6 s | 2.5 s |
| Leadership Attendance, cold | 3.5 s | 1.9 s |
| Leadership Assessments, cold | 2.2 s | 1.8 s |
| Leadership Morarji, cold | 3.9 s (one run) | 1.8 s |
| Annual donor summary, cold | 1.5 s | 1.4 s |

Request counts are unchanged from Phase B (Phase C0 is database-only). The remaining Leadership cold time is mostly the three extra full reports on the Overview (Morning/Evening counts) and sign-in, which Phase C1 removes.

## Verification
- 540 results compared equal (5 months x 3 grades x 3 shifts x 4 genders x 3 centre subsets) between the new function and the previous one with the H patch applied, in a rolled-back transaction on Preview before applying; the same function was then applied and re-sealed (guard present, ACL EXECUTE for authenticated only).
- `npm run test:sql:portable`: all 1,440 reviewed calculation cases pass against the new body (independent JavaScript calculation), plus the existing suites.
- Real browser, all three roles: 137/137 checks pass on Preview with the new function (the first run showed one failure, a test that counted rows of every table on the page; faster pages now show another table at the same time, so the check counts only the register table). The was made to count only the register table because faster pages now show another table at the same time.

## Not measured
Production data volumes (Production only receives this through the gated release). Timings on this shared-CPU instance vary a lot between runs (one run of the same call took 1.3 s while it normally takes 0.18 s), which is Phase D evidence.

## Rollback
Re-create the previous body from `supabase/proposals/202611030024_reviewed_chart_metrics.sql` with the H patch and re-run `seal.sql` (same transaction).
