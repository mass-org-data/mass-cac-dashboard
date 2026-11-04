# Next-phase development handoff — 4 November 2026

Shift → Grade filtering is implemented on the existing feature branch without a redesign. Donor → Centre remains intact. The manager-approved original source and accepted 45cd4d3 calculation baseline are preserved as references. User acceptance of the existing protected Preview is recorded; this phase has not deployed a replacement.

## Delivered results

| Requested area | Result / evidence |
|---|---|
| Shift → Grade dependency | Actual eligible dated assignments only; current context respected, invalid dependent choices cleared and valid grades retained. Unknown values preserved. See FILTER-CONTRACT.md. |
| Frontend parity | Base CSS/assets byte-identical; all 24 chart slots, role navigation, original page actions and form inventory tested.40 screenshots; matching type inventories/measured shell geometry; no overflow. Original adaptive orientation policy, colours, quick buttons, grouped cohorts and download/export controls restored. See FRONTEND-PARITY.md. |
| Approved calculations | Same 45cd4d3 module/proposal SQL unchanged; L=Leave, P/(P+A+L),25 marks, configured April–March quarters and distinct UUID counting preserved. Updated24chart register explicitly marks source/API dependencies. |
| Combined filters |5376/5,376 live read-only SQL facet comparisons,880/880 live calculation comparisons,1,440/1,440 isolated authenticated SQL/frontend cases. Not every live chart has source data. |
| Backend state/activation | Hosted001–019only;27tables / 108 policies, forced RLS, no unvalidated constraints.020–023 preserved/prepared;024 reviewed separately, not promoted. No hosted schema/data changes. |
| Populated migration safety | Every old column/value projection across 27synthetic baseline tables preserved through020–023. Injected failures preserve schema/ACL/ownership; safe exact-file retries pass. Optional024read tested after upgrade. |
| Operational persistence |44existing Chromium/PostgREST checks: individual/bulk attendance, score entry/correction, visits, source-context preservation, reread and independent audit history;18new filter/parity checks. All synthetic and isolated. |
| Security | Existing role/centre restrictions, no anonymous writes, no Leadership edits/profiles, service-role denials, stale-version/concurrency and logout isolation preserved. No accounts/grants created. |
| Staff preparation | All three partial-register tabs revalidated privately;141 rows,72 missing emails,9 invalid rows,6 duplicate groups; no authorization-ready rows or name-only merges. Existing grants remain unchanged; Google Sign-In deferred. |
| Extensive review |68 frontend tests plus27 entry/removal/undo demo checks;3 staff-audit tests;44+18+7browser checks; source-reference/visual tests, build, syntax, checksums and privacy checks. See CODE-REVIEW.md and VERIFICATION.json. |

## Hosted recovery and actual next actions

Fresh provider evidence: no listed backups, PITR disabled, internal restore-point route unavailable; no verified backup or hosted-data recovery rehearsal created. The read-only Management connection is not native PostgreSQL backup access. Do not substitute JSON exports or a synthetic restore for a real recoverable backup.

See RECOVERY-OPTIONS.md for three exact arrangements: an authorized database operator with secure native access/encrypted recovery facility; a provider-assisted supported arrangement; or an explicitly approved paid backup option with verified recovery evidence. The user does not need to run backup commands personally. No operator, credentials, paid service or provider commitment has been invented. PROVIDER-SUPPORT-REQUEST.md is a draft only, not sent.

**NO-GO for hosted020–023 or024 execution until recovery is verified.** Existing conditional authorization is retained; do not repeatedly ask for the same safe development or migration scope.024still requires its own review/approval before promotion/application. Native/provider runner selection and its atomic real-ledger handling must be verified by the executing operator. Do not replay001–019, repair history aliases, reset the database or restore automatically.

After recovery gates, the exact order is020original_workflows →021cluster_officer_visits →022activity_delivery →023programme_aggregates. RELEASE.sha256 freezes these files plus the separately held024proposal. Postflight expects32 tables / 230 columns / 45 FKs / 115 policies, existing data preserved, no new synthetic production records. Full transaction/error-stop/resume procedure is in RECOVERY-OPTIONS.md.

Vercel connection tools/CLI credential are unavailable; the supplied Preview URL is blocked from this environment by tunnel403. Existing Preview:
https://mass-cac-dashboard-git-feature-supab-10335b-mass-data-dashboard.vercel.app/

The user confirms the accepted baseline works; new code is not represented as deployed or hosted-tested. After authorized existing-project access is available, deploy only the reviewed feature commit to protected Preview and verify its exact SHA, environment/session/API behavior and real read results. No main merge, --prod deployment, protection bypass or new paid project.

MASS information still needed for activation is distinct from infrastructure: final staff identities/dated scope/profile capability; calendar/visit applicability; missing activity/cohort/school/guidance source; remaining colour boundaries and any new deletion/void/sensitive-note policy. See the precise 12-item GAP-REGISTER.csv rather than reopening approved workbook decisions.

## Reproduce without hosted writes

```bash
npm ci
npm run check
npm test
python -m unittest discover -s tests/audits -p 'test_staff_register.py'
MASS_REVIEWED_CHARTS=1 MASS_RELEASE_BROWSER=1 bash tests/release/run-local.sh
MASS_REVIEWED_CHARTS=1 MASS_RELEASE_BROWSER=1 MASS_DEPENDENT_BROWSER=1 bash tests/release/run-local.sh
MASS_POPULATED_UPGRADE=1 MASS_REVIEWED_CHARTS=1 bash tests/release/run-local.sh
MASS_BASELINE_BROWSER=1 MASS_RELEASE_BROWSER=1 bash tests/release/run-local.sh
python tests/parity/visual.py
sha256sum -c supabase/compatibility/MIGRATIONS.sha256
sha256sum -c docs/development/2026-11-04/RELEASE.sha256
npm run build
```

Docker/PG17, Python/openpyxl/Playwright/Chromium and Node are needed. All database runners create disposable isolated databases with synthetic Auth identities. They do not accept a production database connection. Visual reference navigation uses the original manager commit; real-data calculations use separate private read-only snapshots. No real data enters committed fixtures.

Unrelated pre-existing untracked docs/PHASE-3E-PERMISSIONS-AND-RECOVERY.md is preserved outside this change. Source workbooks, private staff reports, credentials and recovery dumps are not publication candidates.

Normal unit parity checks use a frozen selector/field/asset-digest inventory and need no remote Git access. The separate visual comparison requires the manager reference commit to be available locally; a shallow checkout must fetch that reference before running visual.py.
