# MASS CAC Dashboard audit — 29 October 2026 (India)

**NO-GO for declaring the live frontend complete.** This is an audit, not an implementation release. The supplied nine-tab register is expanded with component-level evidence, 49 exact read-only calculation queries and every failing combination from the tested population matrix. The uploaded workbook is the baseline; the shared Google Sheet has not been edited because no Sheets write connector is available.

The approved original frontend is commit `0b57ea193e5dd8decb9a451d0b1cea44e22322fb` (`migration/frontend`). Integration source reviewed is the newer remote commit `61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d`. The existing local feature checkout at `598fae15d9f4937aa775c07061638b5a4fefa68b` was preserved; a detached worktree was used for newer source inspection. Source links in the workbook pin these versions.

The inventory covers all ten original pages, 24 numbered charts (there is no chart 17), individual KPI instances, distinct chart series, table columns, modal fields, action families and filter dependencies. The original module was read in full, including browser persistence, correction/removal/undo, exports and navigation. Unused helper functions are distinguished from rendered features. The original activity-session modal cannot render because `activityCatalogue` is undefined; its source-defined fields are nevertheless included.

The most urgent problems are:

- Grade 1 still reports 1,458 students instead of the SQL population of 99. Profile filters, searches and exports do not share one effective scope.
- One valid quarter-only Q1 score is excluded by the dated read RPC. Actual coverage is 207 results, not only the 206 dated Q2 results. Do not invent a date to expose it.
- The adapter collapses historical enrolments and attendance context; centre/shift/episode identity can be lost.
- Empty activity evidence can produce a low-engagement classification. Scheduling does not establish held/cancelled delivery. Visit targets and fictional officer series remain partially embedded.
- Several original writes redirect without the intended context; other controls mutate memory before persistence fails. Registration/individual RPC availability does not prove the original bulk, correction, removal or undo workflow works.
- Current access has 276 active role-centre grants. One account holds Teacher and Cluster Officer roles across all 92 centres; another holds Leadership across all 92. Operational approval evidence is required; this audit did not change or declare those assignments unauthorized.
- Leadership profile restrictions and aggregate demographic requirements need an approved solution. Do not broaden private-profile access to make a chart work.
- Auth lifecycle, persistent-session cleanup and export safety need explicit verification and correction.

An additional source defect was found: **Morarji contains 550 named source candidate rows, not 548**. A fixed first-data-row offset omitted physical row 5 in both Fanuc and McAfee. The 548 previously staged rows remain held; two additional observations were never staged/provenanced. No operational Morarji outcomes have been imported. The earlier handoff is preserved as historical documentation and this correction must accompany it.

## Verified live scope

Live managed PostgreSQL inspection used the read-only Management API flag and a read-only database principal, not staff impersonation. Private row-level reconciliation evidence remains outside Git. Counts were re-queried rather than copied from earlier handovers.

| Relation | Actual rows |
|---|---:|
| `mass_core.donors` | 8 |
| `mass_core.centres` | 92 |
| `mass_core.children` | 1,458 |
| `mass_core.enrolments` | 1,458 |
| `mass_import.receipts` | 51,904 |
| `mass_core.cac_sessions` | 0 |
| `mass_core.staff_members` | 136 |
| `mass_core.academic_years` | 1 |
| `mass_core.activity_events` | 0 |
| `mass_core.attendance_codes` | 5 |
| `mass_core.morarji_outcomes` | 0 |
| `mass_core.programme_cohorts` | 0 |
| `mass_core.user_scope_grants` | 276 |
| `mass_foundation.source_rows` | 8,670 |
| `mass_core.assessment_periods` | 2 |
| `mass_core.assessment_results` | 207 |
| `mass_core.attendance_records` | 47,323 |
| `mass_core.cohort_memberships` | 0 |
| `mass_foundation.audit_events` | 70,538 |
| `mass_foundation.source_files` | 4 |
| `mass_foundation.source_sheets` | 37 |
| `mass_foundation.import_batches` | 5 |
| `mass_core.activity_participation` | 0 |
| `mass_core.assessment_definitions` | 2 |
| `mass_core.private_child_profiles` | 1,458 |
| `mass_foundation.import_exceptions` | 9,525 |
| `mass_core.centre_staff_assignments` | 220 |

There are 27 live tables, 183 columns, 35 foreign keys, 108 RLS policies and 19 recorded migrations. `mass_api` has 22 RPCs. Private schemas are not in PostgREST exposure; exposed schemas are `public`, `graphql_public`, `mass_api`; API max_rows is 1,000. This catalogue inspection is not a proof that all hosted staff sessions pass RLS tests.

Only 45 centres have imported children and 15 have attendance. Imported grades reconcile to 1:99, 2:189, 3:176, 4:222, 5:226, 6:176, 7:134, 8:112, 9:79, 10:45. Restricted administrative demographic reconciliation is Girl869/Boy589; this does not authorize Leadership to read individual profiles. All 1,458 enrolment date assumptions are marked in import receipts; the UI must not present them as observed dates.

Held units remain distinct: 1,177 directory/student source rows; 889 attendance cells; 1,591 assessment source rows; 548 staged Morarji candidates plus two newly discovered unstaged candidates. The 9,525 open technical exceptions are not 9,525 children. Historical registration batch quarantine statuses and operational import receipts have different purposes; do not silently close old exceptions because a later import exists.

## Verification and limitations

The existing frontend suite passes 20 tests plus 27 workflow/removal checks. Nine targeted audit checks produced two passes and seven failures (including the matrix check). The matrix exercises 36,432 centre/month/shift/grade/gender population combinations through the actual frontend functions; 16,188 disagree with an independently filtered population. These are not 36,432 rendered browser sessions and do not exhaust every cross-product including donor/officer/search/round/roles. Every failing tested tuple is included in FILTER TESTS. Donor-centre narrowing and mobile navigation passed limited smoke checks.

Browser replay uses current source with private pseudonymous administrative fixtures. It is not a real hosted Leadership/Teacher/CO session, does not prove RLS enforcement and does not test persisted writes. The original daily UI shows draft Present for unknown marks; the live guard prevents this from constituting an actual automatic database write. Current workspace filters update without an Apply button; remaining problems concern scope and dependent options, not a stale claim that Apply still exists.

No frontend or database source changes, production writes, imports, account creation, grants, deployments, merges or pushes were made in this audit. Existing documentation and private inputs are preserved. New audit documents remain uncommitted for review.

## Deliverables

- Updated nine-tab workbook in `/workspace/exports/MASS-CAC-Exhaustive-Gap-Audit-2026-10-29.xlsx`; original populated cells, styles, formulas and hyperlinks are checked after save.
- [Original frontend coverage](FRONTEND-COVERAGE.md), [actual backend catalogue](BACKEND-INVENTORY.md).
- [Calculation specification](CALCULATION-SPECIFICATION.md), [exact SELECT queries](CALCULATION-QUERIES.sql).
- [Field collection and entry plan](DATA-COLLECTION-AND-ENTRY-PLAN.md).
- [Prioritized findings](BACKLOG.md), [two-pass QA and evidence](QA-AND-HANDOVER.md).
- [Workbook verification and counts](REGISTER-VERIFICATION.json).

The workbook is the detailed component register. After review, an authorized Sheet editor can import its nine tabs into the central register, preserving the previous Sheet version first. This has not been performed here. No implementation migrations are proposed or executed by this audit.
