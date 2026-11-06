# Recovered development and deployment readiness

Base: 962f1e5 on feature/supabase-frontend. The user accepts the existing working Preview. No frontend restart, source-data audit, database redesign or production write was performed.

## Workspace recovery

All implementation edits survived: original-actions.js, proposal 024 JIT optimization, release runner, calculation security assertion, staff validator, hosted security-review collector and associated tests. Before modifying anything, the tracked binary patch, untracked files and Git state were copied to a restricted private recovery directory outside Git. The unrelated pre-existing Phase3E document remains untouched/untracked. The two final browser assertions were absent and were reconstructed. Recovered work was not discarded or overwritten.

## Completed behavior

- **Save Attendance:** individual marks already save immediately. The original button now refreshes and verifies explicit persisted P/A/L/WO/MM values; untouched rows remain unknown. It creates no redundant mutations or audit revisions. A changed date/year during refresh produces a neutral review message.
- **Assessment history:** the existing correction dialog now offers selected-quarter history only when an actual scoped result ID exists. It uses read_record_revisions and returns minimized revision/operation/time metadata. No guessed score ID or private profile history is exposed.
- **Staff preparation:** private dry-run validation matches an existing confirmed Auth UUID and exact verified email, source-backed centre/role, explicit profile authority and reviewed date intervals. Null approval references cannot become the string None; shared emails and overlapping/mixed-role proposals are held for every affected row independent of input order. It produces no SQL, accounts or grants. See STAFF-PERMISSIONS.md.
- **Proposal 024:** only a bounded function-local SET jit=off and explanatory comment were added. Calculation body, centre authorization, private-profile restrictions and ACLs are unchanged. The hosted server already uses jit=off; this pins behavior across environments rather than claiming a production improvement. See SECURITY-REVIEW.md and PERFORMANCE.md.
- **Original frontend:** no chart/form/layout/navigation/filter/download was removed. Forty reference screenshots cover all 24 chart slots with matching chart-type inventories/measured shell geometry and no overflow. Existing quick filters, donor/shift/grade dependencies and code-only ZIP/CSV downloads pass real local-browser checks. This is not universal pixel identity or a new authenticated hosted Preview pass.

## Passing verification

| Check | Result |
|---|---|
| Frontend tests |71 pass |
| Demo entry/removal/undo regression checks |27 pass; not authority for live deletion |
| Python audit/permission tests |17 pass |
| Expanded Chromium/PostgREST operational checks |46 pass |
| Dependent filter/parity browser checks |18 pass |
|001–019 compatible browser checks |7 pass |
| Independent isolated SQL/frontend calculation cases |1,440 pass |
| Advisor-flagged function scope probes |90 pass against 001–019 ; 90 pass against prepared release plus 3 profile capability denials |
| Hosted/local flagged function body/owner/search_path comparisons |9 of 9 match |
| Populated 001–019→020–023 upgrade |All 27 old-table projections unchanged; failure rollback and exact retry for each file pass |
| Actual SDK/PostgREST read/API checks |18 pass with synthetic Auth |
| Original-source visual comparison |40 screenshots, 24 chart numbers, no measured type/geometry discrepancy or overflow |
| Build, syntax and canonical checksum verification |pass |

All writes, synthetic identities and functional Auth stubs used by these tests belong to disposable isolated PostgreSQL/PostgREST environments. Read-only hosted catalog/advisor inspection is not proof that managed staff Auth, hosted DDL or the new Preview runtime has passed. Source-dependent charts remain source-dependent; no missing observations were manufactured into zeroes.

## Database readiness and exact holds

Fresh hosted read-only evidence: migrations 001–019, 1,458 students, 47,323 attendance records, 207 assessments, forced RLS. No hosted 020–024 execution occurred. Canonical 001–023 SQL files and MIGRATIONS.sha256 remain unchanged. Proposal 024 remains a proposal; its new active checksum is in supabase/proposals/REVIEWED-024.sha256 and this directory's RELEASE.sha256. Prior release manifests are historical evidence of their original proposal version.

| Item | Technical readiness | Current execution dependency |
|---|---|---|
|020 original_workflows |Compiled/tested with restricted PG17 migrator; guards, atomic batches and history context checks pass |Hosted application is explicitly prohibited in this phase. Future activation changes private-profile correction/write behavior; preserve exact preflight definitions and an approved safe response to later incorrect staff edits. DDL rollback cannot undo later committed sensitive-value overwrites when minimized audit metadata has no before-image. |
|021 cluster_officer_visits |Assignment, visit and restricted immutable revision tables, RLS, duplicate/concurrent update guards, history and 2 Morning + 2 Evening standard tested |Depends on 020; requires verified Auth-to-officer/centre/date linkage before real use. Undated observations are not completed visits. No inherent historical-data deletion is required to create these additive tables. |
|022 activity_delivery |Additive nullable source fields and delivery relation tested; legacy values preserved |Depends on 020; do not infer Held delivery or categories from legacy names/missing records. Hosted application not authorized here. |
|023 programme_aggregates |Scoped read/provenance/revision functions and atomic transfer tested |Depends on 020–022. Future transfer/profile corrections must respect the explicit no-historical-rewrite restriction and approved date/scope evidence. No hosted transfer tests here. |
|024 reviewed aggregate |Correctness, ACL/scope validation, managed PG17 GUC compatibility and synthetic performance reviewed |Not promoted or applied. Separate controlled activation after 020–023; no direct private-schema exposure. |

No repeated backup-arrangement request is made. A missing recovery point does not block safe development, isolated tests or read-only inspection. The specific holds are the user's prohibition on hosted execution in this phase and future activation of writes that could overwrite values not retained by minimized audit logs. Additive visit tables/read-only verification are not misrepresented as destructive operations.

When separately authorized: verify target pbkwpfdpdtelmvbkzgvx/Mumbai and frozen release; inspect actual ledger aliases; run 020023-preflight read-only; execute exactly 020 → 021 → 022 → 023 with error-stop and real ledger/DDL committed atomically by the approved runner. Stop on the first error; preserve successful earlier files and resume only the next proven-unapplied file. Never replay 001–019, reset, repair history blindly or stamp an unapplied migration. Postflight expects 32 tables / 230 columns / 45 validated FKs / 115 policies and unchanged historical values. Treat 024 separately. No real staff activation or data import is implicit in schema installation.

## Remaining external/source matters

- Vercel has no callable connection or deployment token here; GitHub status API access is network-restricted. After publication, inspect the exact new SHA if access permits. Do not infer a new build from Git push success. Existing accepted Preview is https://mass-cac-dashboard-git-feature-supab-10335b-mass-data-dashboard.vercel.app/ . New authenticated runtime testing remains distinct from user acceptance of the baseline.
- All 141 staff-register proposals remain held. Missing identities/dates/shift scope/profile authority are not filled from names, donor projects or assumed student enrolment dates. Google Sign-In stays last, after actual staff authorization and operations are verified.
- Calendar/shift applicability, incomplete historical identity/cohort/year linkage, school/guidance source and remaining engagement colour boundaries remain the specific source/decision gaps already recorded in the preceding release. Existing approved workbook decisions are not reopened.
- Live deletion/undo and sensitive-note collection remain unsupported without record-specific approved semantics. This phase preserves controls and safe corrections; it does not invent retention or destructive behavior.
- Supabase reports nine intentional authenticated-definer warnings plus a separate leaked-password-protection setting warning. Scope review does not make the warnings disappear; no Auth policy, provider billing or Google Sign-In setting was changed.

See PREVIEW-ACCEPTANCE.md for final runtime checks and VERIFICATION.json for evidence boundaries.
