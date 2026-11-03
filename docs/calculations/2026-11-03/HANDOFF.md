# Calculation integration handoff — 3 November 2026

The workbook and final user clarification now control all 24 chart contracts. Pending entries with usable comments are approved; remaining gaps are recorded individually in RULE-DECISIONS.csv. The original UI layout, chart numbers, operational entry/correction/history, source download and staff security model are preserved.

## Changes

- Monthly activity participation counts each child once; category charts count each child once per category, not an exclusive pie denominator.
- Same-child selected-quarter assessment comparisons use verified UUID/history linkage and descriptive mark change. Missing scores remain separate from zero; integer bands retain fractional-review handling.
- Active-child grade/gender counts deduplicate UUIDs; Unknown gender is separate from masked private profiles. Centre enrolment counts retain their own grain.
- Donor views use the same approved formulas and current centre association. Attendance retains L=Leave and P/(P+A+L), excluding confirmed non-scheduled dates/WO/MM.
- Counts replace the blanket engagement approval block; only unconfirmed colour boundaries remain withheld. Complete attendance bands require actual explicit calendar/mark coverage.
- Observed delivery statuses remain separate. Visit actuals are distinct from the approved standard 2+2 and the still-unverified applicability of that standard to single-shift centres.
- Morarji counts use historical Grade 5 linkage and verified cohort academic years; no extra outcome or optional denominator inferred.
- Added scoped aggregate **proposal 024**, not a migration, so staff lacking private-profile permission can use the same approved filters without receiving private profiles. Existing001–023migration files and manifest are unchanged.
- All three staff tabs analyzed privately; public summary contains counts only. No identity merges, accounts, permissions or OAuth configuration.

## Verification

- 880/880 read-only hosted SQL/frontend math cases: all 92 centres,8 donor scopes,11 officer scopes; April/October 2026 and documented combined filters. Privileged read-only inspection is not proof of a managed staff session, managed Auth or protected Preview.
- 1,440/1,440 isolated synthetic PG17 SQL/frontend cases for proposal 024, after the full001–023 sequence; scope/anonymous denial, owner/search_path and ACL checks. Existing core, security, concurrency and release checks run by the same suite.
- 52 frontend unit tests plus 27 entry/removal/undo workflow checks; three staff-audit tests.
- 44 Chromium original-interface/local-PostgREST checks, including actual synthetic persistence, role restrictions, corrections/history, recovery, refresh and mobile. Seven additional001–019compatibility checks pass with supplements absent.
- Build and syntax checks run locally. Synthetic Auth stubs are not hosted Auth verification.

See CHART-RECONCILIATION.md and its CSV for every chart; RULE-DECISIONS.csv for every original question. Tests/reviewed-calculations/hosted-readonly.sql queries only deployed001–019objects. scripts/audits/reconcile_reviewed_live.mjs uses private snapshots outside the repository and an environment-provided Management token; it performs only read_only requests. It prints redacted case totals, never identities or credentials. Missing snapshots/access fail rather than substituting source/demo data.

## Reproduce safely

```bash
npm ci
npm run check
npm test
python -m unittest discover -s tests/audits -p 'test_staff_register.py'
MASS_REVIEWED_CHARTS=1 MASS_RELEASE_BROWSER=1 bash tests/release/run-local.sh
MASS_BASELINE_BROWSER=1 MASS_RELEASE_BROWSER=1 bash tests/release/run-local.sh
npm run build
```

Docker, Python/openpyxl/Playwright and local Chromium are needed for database/browser/audit tests. Local runner creates isolated synthetic databases and does not accept or use a production database connection. The024test flag explicitly installs the proposal only in that disposable database. It cannot be combined with baseline-browser mode.

## Remaining technical activation gates

1. Production remains at001–019. Empty source and absent020–023APIs are explicit unavailable states; quarter-only assessments must not silently become an incomplete dated-only sample. Use the existing approved backup/recovery/preflight procedure before any separately authorized hosted020–023execution.
2. Review proposal 024as a new additive read API, including its protected aggregate disclosure contract. It is not in migrations and has not been executed hosted. After approval, promote with fresh checksums and the same controlled recovery process. No direct private-schema exposure is proposed.
3. An authorized protected Preview deployment and actual verified staff session are still required to prove runtime environment/API access, correct session claims and real programme loading in the browser. No Vercel credential/connector is available here; no protected Preview or Production deployment was performed. Google Sheets/Drive tools remain unavailable; both uploaded workbooks were read locally instead.
4. Preserve the verified ignored-build rule for feature/supabase-frontend when publishing code; a skipped record is not a tested Preview build. Do not merge or promote to Production.

## Information needed from MASS

- Complete authoritative calendar and centre/shift applicability; missing schedule rows cannot establish holidays or attendance completeness.
- Final staff identities/emails, verified centre/officer relationships, effective dates and private-profile authorization from the incomplete register; see STAFF-QUALITY.md. No synthetic production accounts.
- Source-backed activity/category/delivery history, dated visits, verified Grade 5 cohort/year/outcomes, school reports and guidance choices where charts lack data.
- Remaining engagement colour boundaries; score void/absence/clearing semantics only if introducing those new operations. Existing numeric score correction remains available.

Do not reopen approved child counting, attendance denominator, selected-quarter mean, same-child pairing, current donor filtering, known outcome flags or2+2standard. No Production data/schema, migrations001–023, staff accounts, main branch or Vercel configuration was changed by this work.
