# Phase F — end-to-end validation

Depends on Phase E / PR #14.

## Requirement status

| Requirements | Result |
| --- | --- |
| F24 | The release, multi-role browser, API, directory, import, student, activation, portable SQL, attendance, and staff-access suites cover the affected workflows and protected boundaries. Desktop and mobile browser paths include role changes, scoped attendance, date-derived assessment entry, visit entry, and Leadership read-only behavior. |
| B08–B11 | Current-schema replay, rollback/retry, RLS, grant, Auth identity, import reconciliation, concurrency, and browser-to-PostgREST paths are exercised by reproducible repository commands. Playwright is now a declared development dependency. |

## Test-harness fixes

- Browser scenarios now follow the two-step assessment workflow introduced in Phase C: select an observed date, verify its derived F1–F4 round, enter marks, and save the batch.
- Directory import reconciliation ignores `staff_members.auth_user_id` and `centre_staff_assignments.verification_reference` when comparing immutable workbook mappings. Those fields are managed by separate reviewed Auth and operational-verification workflows. Imports neither overwrite nor erase them, and tests retain strict comparison of every source-managed field.
- The current-schema student replay expects all 28 RLS-protected `mass_core` tables in migrations 001–027. A separate catalog check measured 34 protected application and import tables across `mass_core` and `mass_foundation`. The historical replay still verifies its original 17-table baseline.
- `playwright` 1.55 is declared in `devDependencies`, so the Node browser suite no longer depends on an undeclared local package.

## Data and security

No Supabase migration, hosted row, permission, feature gate, RLS policy, Vercel Production setting, or Production deployment changed. Tests use disposable local PostgreSQL containers, PGlite, synthetic browser fixtures, or read-only hosted checks. The import change preserves independently approved Auth links and verification references; it does not relax source identity, relationship, or scope checks.

## Files

- `package.json`, `package-lock.json`: declared Playwright test dependency.
- `tests/attendance/browser.mjs`, `tests/release/browser.py`: current assessment entry browser flow.
- `scripts/imports/render.py`, `tests/imports/test_pipeline.py`: preserve separately managed Auth and verification fields during exact import retries.
- `tests/students/run-current-core.sh`: current 28-table `mass_core` forced-RLS catalog expectation.

## Validation

- `npm run test:browser`: passed 47 Chromium/PostgREST scenarios plus migration rollback/retry and SQL security checks.
- `MASS_CHROMIUM_EXECUTABLE=/usr/bin/chromium MASS_TEST_MULTI_ROLE=1 npm run test:attendance:browser`: passed 32 browser assertions.
- `npm run test:api`: passed the frontend read/API integration suite.
- `npm run test:directory`: passed.
- `npm run test:imports`: passed 21 pipeline tests plus rollback, concurrency, retry, conflict, and access reconciliation.
- `npm run test:activation`: passed seven Python tests and provider replay checks.
- `npm run test:sql:portable`: passed 1,440 calculation cases and sealed API checks.
- `npm run test:attendance`: passed 52 register SQL checks.
- `npm run test:students`: passed staging tests, historical migration/security assertions, concurrency checks, and current-schema replay.

Final lint, static checks, frontend tests, staff-access tests, and build are recorded in the pull request checks.

## Programme decisions left open

D02–D08 remain programme decisions unless an existing contract is already explicit. This phase does not invent session overlap rules, retest representation, activity outcome metrics, Morarji rounds/results, broader Leadership editing rights, a new exit-date meaning, or subject/skill-level scoring.
