# Phase B result: batched read functions

Branch `perf/request-reduction`. Migration `supabase/migrations/20261114120000_batched_reads.sql` (additive; every existing function unchanged) plus the `seal.sql` and `API-GATES.csv` entries, applied to the PREVIEW database only (dry run rolled back first, then one transaction with the seal re-run). Production is untouched.

## New functions
| Function | Replaces | Gate |
|---|---|---|
| `visit_coverage(p_centres, p_from, p_until, p_officer)` | `visit_summary` + `visit_officer_summary` per centre | none (same as its siblings) |
| `read_visits_v2(p_centres, p_from, p_until, p_limit, p_offset)` | `read_visits` per centre | none; still only the caller's own visits |
| `morarji_followup(p_centres, p_cohort, p_limit, p_offset)` | `read_morarji` + `read_students` per centre | none; runs as the caller (RLS), names only where the profile is readable |
| `student_profile_page_v3(...)` | `student_profile_page_v2` + whole-roster `read_students` | none; ids come from v2, so scope and profile rights are decided there |
| `reviewed_attendance_by_centre_month(...)` | 8 monthly `reviewed_chart_metrics` reports | sealed behind `reviewed_reads` |

Each checks scope once for the whole array (1 to 100 centres, every centre readable, otherwise 42501) and keeps the single-centre rules. The client uses a batched function when present and falls back to the per-centre functions on 404 / PGRST202 (tested). Counts are summed and the rate recomputed, never averaged.

## Verification
- Portable SQL suite passes (`npm run test:sql:portable`): each batched function equals the single-centre function it replaces (visits field by field, Morarji members, profile rows, 63 month-and-filter comparisons against `reviewed_chart_metrics` for the by-centre-month function), plus scope, null/empty/over-100 arrays, anonymous callers, oversize pages, seal and capability advertising.
- Web: 191 tests, typecheck, lint pass (fallback and batching tests added).
- Real browser against preview, all three roles: 137/137 checks, including the same Annual, Morarji and Visits numbers as before.

## Requests per screen (cold, sign-in to settled; median of 3 runs on a local build against preview)
| Screen | Leadership before / after | Cluster Officer | Teacher |
|---|---|---|---|
| Visits | 187 / 4 | 4 / 4 | 5 / 4 |
| Morarji | 4 / 4 | 22 / 5 | 6 / 5 |
| Student profiles | n/a | 13 / 4 | 5 / 4 |
| Annual donor summary | 12 / 5 | n/a | n/a |
| One pass through every screen (cold) | 225 / 35 | 61 / 35 | 38 / 35 |
| One pass, warm (moving between screens) | 219 / 6 | 54 / 7 | 29 / 7 |

Annual donor summary: 12.4 s cold before, 1.5 s after (0.9 s warm). Leadership Visits 1.5 s to 0.6 s. Leadership Overview, Attendance, Assessments and Morarji cold times (about 2-4 s) are unchanged: they are the heavy all-centre `reviewed_chart_metrics` report, which is Phase C.

## Not measured / caveats
Local build against preview, not the deployed Vercel preview. The Leadership Morarji cold run took 3.9 s once (it waits on the heavy report, as before). Teacher/Cluster Officer Visits are still counted in the timing table (the new menu rule on the PR #18 branch marks Teacher Visits not applicable).

## Rollback
`DROP FUNCTION` the five functions (signatures in the migration header) and re-run the previous `seal.sql`; the client falls back without a redeploy.
