# Phase C1 result: slice function for the shift counts

Branch `perf/request-reduction`. Migration `supabase/migrations/20261114140000_reviewed_shift_counts.sql` (plus `seal.sql`, `API-GATES.csv`, tests), applied to the PREVIEW database only (dry run rolled back first, then one transaction with the seal re-run). Production is untouched.

## What was built
`mass_api.reviewed_shift_counts(p_centres uuid[], p_on date)` returns `{Morning, Evening}`: distinct children enrolled on the reporting day in each shift, same population rule as `reviewed_chart_metrics`, counts only. Scope is checked once for all centres (1 to 100, all readable, else 42501); sealed behind `reviewed_reads`; advertised as `reviewed_shift_counts`; the client falls back to one full report per shift when it is not installed (tested).

It replaces the two extra full reports the Overview ran for the "Students by shift" chart: 7 ms against about 440 ms per full report on 92 centres.

## Decision: the other planned slices were not built
The plan also listed assessment and Morarji slice functions. After Phase C0 the full report takes 0.18 s for 92 centres and the app already reuses one report per selection between the Overview, Attendance, Assessments and Morarji (the shared cache), so splitting it would add three functions, three sets of parity tests and three more gated entry points for a saving that is not measurable. If a screen later needs a different selection than the shared report (for example Annual by month, already batched), a slice can be added then.

## Results (preview, local build; median of 3 runs)
| | Before C1 (after C0) | After C1 |
|---|---|---|
| Overview requests, cold | 8 | 7 |
| Leadership Overview, cold sign-in to settled | 2.5 s | 2.2 s |
| One pass through every screen, cold, requests | 35 | 34 |

Teacher cold runs showed worst cases of 3 to 8 s in this run (median about 1 s for most screens); the same screens normally take under a second. The shared-CPU database instance is noisy, which is Phase D evidence, not a Phase C1 effect.

## Verification
- Preview parity (rolled back before applying): 12 of 12 comparisons equal the Morning/Evening reports' `children` (4 dates x 1, 9 and 92 centres).
- Portable SQL suite: 8 comparisons against `reviewed_chart_metrics`, scope, null and mixed-scope rejection, missing reporting day, no names, seal and capability advertising; all 1,440 reviewed calculation cases still pass.
- Web: 192 tests, typecheck, lint. Real browser on Preview, all three roles: 137/137.

## Rollback
`DROP FUNCTION mass_api.reviewed_shift_counts(uuid[],date);` and re-run the previous `seal.sql`; the client falls back without a redeploy.
