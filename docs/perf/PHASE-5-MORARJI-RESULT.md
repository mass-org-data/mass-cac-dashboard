# Phase 5 (Morarji scholarship): result

Date: 14 November 2026. Preview project (synthetic data), real Chromium, `dist/` served with the production CSP: `node scripts/perf/attendance-live.mjs` (95 of 95 checks, all screens built so far).

## What was built (`web/src/pages/Morarji.tsx`, `web/src/morarji/`)
- **Read-only screen.** Adding a child to a training cohort and recording outcomes are gated by the `morarji` activation feature, which a database check constraint keeps hard-off, so those actions stay in the standard application and this screen offers no edit controls.
- **Filters:** cohort year (from the programme cohorts) and, for several centres, centre.
- **Scorecards 6.1-6.4** for the selected cohort from the reviewed report (`morarji`): children in the training cohort, took the exam, passed, results pending (members minus children with a known result). Unrecorded answers are unknown, never zero or failed.
- **6.5** children passing year on year (`morarjiYears`; a cohort without recorded results is a gap), **6.6** cohort sizes compared (shared DataTable).
- **Teacher and Cluster Officer only:** 6.7 results by centre and 6.8 cohort follow-up (student name where the role may read it, ID, centre, application, took the exam, result with unknown shown as Pending, school), from `read_morarji` for the role's centres, names from the same read the profiles screen uses. Leadership sees cohort totals only and no student rows are requested.
- No training dates are inferred from cohort labels.

## Checks
- 156 web tests (13 new), lint, syntax check, 138 frontend tests, both builds, `npm audit --audit-level=high` pass.
- Real browser, all three roles: preview has no cohorts, so the not-imported note and "not recorded" cards show (nothing inferred, nothing zero), no edit controls, no axe violations incl. contrast, no horizontal scroll at 375 px, no failed calls or console errors.

## Not covered
- Real cohort data: preview has none (`programme_cohorts` is empty), so the totals, chart, cohort comparison and follow-up table are verified with fixtures in unit tests only. Seeding synthetic cohorts is a preview data change that needs separate approval.
- Numbers against the current Morarji page; concurrent edits; real phones.
