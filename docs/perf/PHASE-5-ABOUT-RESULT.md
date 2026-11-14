# Phase 5 (About) and the full navigation: result

Date: 14 November 2026. Preview project, real Chromium: `node scripts/perf/attendance-live.mjs` (121 of 121 checks, three consecutive clean runs after the retry fix).

## What was built (`web/src/pages/About.tsx`)
The simple general About page of the live application (the historical numbered "About these records" screens are not restored): Your access (the roles the server verified for this account with their centre counts, the active role marked, Leadership noted as read-only), Reporting rules (attendance rate, L = Leave, H, MM and historical WO excluded, April-March rounds with 25 marks), Data coverage (unknown is never inferred or zero) and Exports (what each table's CSV contains). The page shows nothing the server did not verify and no build or key detail.

## Whole shell
Navigation now lists all eight screens for every role: 1 Overview, 2 Attendance, 3 Student profiles, 4 Assessments, 5 Visits, 6 Morarji scholarship, 7 Annual donor summary, 8 About. The preview banner says Activities, monthly meetings and the actions listed on each screen stay in the standard application.

## Checks
- 170 web tests (4 new for About, 1 new retry test), lint, syntax check, 138 frontend tests, both builds, `npm audit --audit-level=high` pass.
- Real browser, all three roles: verified role and centre count correct (Leadership 92, Teacher 1, Cluster Officer 9), eight navigation links, no axe violations incl. contrast, no horizontal scroll at 375 px, no failed calls or console errors.
