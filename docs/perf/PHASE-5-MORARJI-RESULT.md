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
- Real browser, all three roles, against the seeded cohort below (95 of 95 checks): Leadership totals 150 / 104 / 39 / 55 pending equal a direct database count; the Cluster Officer (Centres 01-09) sees 13 / 9 / 5 / 4 pending, equal to the database, with a follow-up list shown by student ID (that account may not read profiles, so names are withheld by the server); the Teacher (Centre 01 has no Grade 5 cohort members) sees unknown, not zero; no edit controls, no axe violations incl. contrast, no horizontal scroll at 375 px, no failed calls or console errors.

## Not covered
- More than one cohort year: preview has one academic year, so the year-on-year chart shows a single bar; the multi-year behaviour (a year without recorded results as a gap) is covered by unit tests only.
- Numbers against the current Morarji page; concurrent edits; real phones.

## Cohort seed on preview (owner-approved, 14 November 2026)
Synthetic only, one transaction after a rolled-back dry run, using the importer role with temporary grants: one cohort `2026–27` on the existing academic year, 150 memberships (every current Grade 5 enrolment) and 150 outcomes: 128 applied, 104 took the exam, 39 passed, 95 with a known result (the rest are unknown, so results pending = 55). No outcome has Attended or Passed yes without the earlier step. Memberships and outcomes cannot be deleted by design, so this seed is permanent on preview; the `morarji` write gate stays hard-off.
