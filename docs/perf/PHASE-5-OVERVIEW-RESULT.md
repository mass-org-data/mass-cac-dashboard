# Phase 5 result: Overview in the new interface (14 November 2026)

The Overview is rebuilt in `web/` (served at `/next/` only when `MASS_NEXT_UI=1`). The current interface remains the default and is unchanged.

## What was built
- `data/overview.ts`: the Overview data service. One all-centre `reviewed_chart_metrics` report feeds the scorecards, grade, gender and centre comparison; two more give the shift chart; one `reviewed_attendance_series` call gives the monthly line (falling back to one report per month on a backend without it). Reports run two at a time through the shared queue. Failures are not cached, so Retry works.
- `pages/Overview.tsx`: filters (Leadership: month, centre, donor; Teacher and Cluster Officer: month, centre, shift, grade, gender), eight numbered scorecards (1.1 to 1.8), numbered charts 1.9 to 1.12 and the Centre comparison table 1.13, all using the shared `Scorecard`, `ChartCard`, `AsyncState` and `DataTable`.
- New accessible SVG charts: `ColumnChart` and `LineChart` (unknown months are gaps, never zero).
- Future months show the same notice as the current interface instead of data.

## Same numbers as the current Overview
Compared in one Chromium session per role against the preview project, current interface versus new interface, same account:

| Role | Scorecards | Grade, gender, shift charts | Monthly line | Centre table |
|---|---|---|---|---|
| Leadership (92 centres) | identical (1,470 students, 802 girls, 668 boys, 8 donors, 438 above 20) | identical | identical (all 12 months) | identical rows |
| Cluster Officer (9 centres) | identical | identical | not compared | identical rows |
| Teacher (1 centre) | identical | gender and shift identical; grade differs in presentation only (below) | not compared | identical row |

The one difference: the current Teacher view lists only grades that have students (2, 4, 6, 8, 10); the new view lists all ten grades with zero where there are none, as the current Leadership and Cluster Officer views already do.

## Load and quality (preview, Chromium, cache-cold)
| | Current Overview | New Overview |
|---|---|---|
| Leadership, first cards | about 2.0 s | 3.0 s (first run, includes sign-in) |
| Leadership, everything including the monthly line | about 3.9 s | 3.6 s |
| Teacher, everything | | 1.8 s |
| Cluster Officer, everything | | 2.0 s |
| RPC requests, whole load | 11 | 8 (context, references, capabilities, directory, 3 reports, 1 series) |
| Per-centre calls | 0 | 0 |

The new interface loads its references, capabilities and directory in parallel with sign-in verification and asks for exactly the same four reports as the current one. A fuller multi-run comparison belongs with the cutover.

- Accessibility: axe (including colour contrast) reports no violations for all three roles at 1280 px and for Leadership at 375 px. No control is shorter than 44 px; no horizontal overflow at 375 px; no CSP violations.
- Tests: 45 Vitest tests (service, page, shared components, session) and the existing 138 frontend tests, type-check, lint and build all pass.

## Not yet in the new Overview
- The Teacher and Cluster Officer "Student Performance Summary" table (roster-level data) and the "Export" explanation dialog of the current Overview. The shared table's CSV export covers the Centre comparison.
- Role switching keeps the Overview per role, but other pages do not exist yet; the shell links to the current interface for them.
- The gender-chart filter by clicking Girls or Boys.
