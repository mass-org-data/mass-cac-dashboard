# Phase D — leadership overview and annual donor reporting

Depends on Phase C / PR #12.

## Requirement status

| Requirements | Result |
| --- | --- |
| F05–F10 leadership overview | The live overview now renders filters, full-population scorecards, student/grade breakdown charts, reporting charts, and a final centre table in that order. Scorecards include boys, girls, and current donor-association totals. The centre table includes students, girls, boys, donor, attendance, activity participation, and assessment average; it supports deterministic sorting and the shared ten-row pagination. |
| Attendance over time | The monthly table is replaced by an accessible line chart. Unknown months produce gaps rather than zeroes. Each point retains the approved `P / (P + A + L) × 100` calculation. |
| F11 annual donor summary | Donor Summary is a separate annual aggregate page with academic-year, centre, and donor filters. Annual attendance sums recorded P, A, and L observations before calculating the percentage; it does not average monthly percentages. Current donor associations are labelled as current and are not treated as historical funding evidence. |
| Export | Leadership and annual donor pages place Export in the page header. A confirmation popup explains the active filters and CSV contents. Annual donor CSV rows include centre, current donor association, current roster count, annual P/A/L, calculated attendance, loaded-month coverage, and academic year. Missing measures remain explicit. |
| B03 / B07 reporting reads | Existing bounded `reviewed_chart_metrics` responses remain authoritative. The frontend requests one full selected-scope aggregate per month and two cached gender facets for the centre table; it does not load private profile rows or issue per-centre gender requests. Existing centre-scope denial, capability gates, and aggregate formulas remain unchanged. |

## Data and security

No migration, hosted data, permission, feature-gate, RLS, or Production value changed. The installed aggregate API already supplies the approved counts needed for this phase. Historical donor validity and missing observations remain unknown.

## Files

- `src/live/leadership-report.js`: deterministic centre sorting, annual attendance combination, and accessible monthly line-chart rendering.
- `src/app.js`: overview order and scorecards, sortable centre table, monthly line chart, annual donor page, and explained exports.
- `tests/frontend/leadership-report.test.mjs`: sorting, annual attendance, and unknown-month chart gaps.
- `tests/frontend/pm-review.test.mjs`: overview order, controls, and separate annual donor view.
- `tests/frontend/original-parity.test.mjs`: updated isolated source harness dependency injection.

## Validation

- `npm run lint`: passed.
- `npm run check`: passed.
- `npm test`: 24 frontend test files passed; 27 workflow/removal checks passed.
- `npm run test:staff-access`: 22 scoped backend assertions passed.
- `npm run build`: passed.

The undeclared Node `playwright` dependency remains a Phase F test-harness gap recorded in Phase A.
