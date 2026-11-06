# Phase 2E — foundation readiness and remaining approvals

27 October 2026 (Asia/Calcutta). Design reconciliation only. Current decision register: **6 Conditional / 8 Partial / 1 Pending**, no Fully Approved entry. Confirmed business rules are binding to their stated extent; whole-decision status retains unapproved details. See PHASE-2E-RULE-RECONCILIATION.md for all 15 decisions, sources and consequences, PHASE-2E-FRONTEND-CONTROLS.md for actual controls, and the Phase 2E columns in FRONTEND-DATABASE-MAPPING.csv for all 23 contracts.

## Six-table technical foundation — readiness assessment

**Ready for final design approval, not authorized or ready for execution.** New student/attendance/assessment rules do not add dependencies to these six candidates. The exact fields below remain proposed, and no source payload is approved for ingestion. Existing platform identity is supplied, while actual environment safety is unverified.

| Candidate | Dependencies from dictionary | Unresolved foundation-specific gate |
| --- | --- | --- |
| source_files | No explicit business FK | Approve metadata/storage-reference allowlist, fingerprint handling, original versus receipt timestamp semantics, access and retention; no public source URLs |
| import_batches | No explicit business FK | Approve execution states, retry/idempotency contract, counters/checkpoints and service actor rights; describing it does not authorize running imports |
| source_sheets | file_id -> source_files | Approve classifications and non-personal header metadata; actual sheet IDs are not guessed Drive IDs |
| source_rows | sheet_id -> source_sheets; first_batch_id -> import_batches; optional canonical_source_row_id -> self | Restricted locator/hash/payload-reference handling and retention, immutable source occurrence, reviewed duplicate-source equivalence; never a person identifier |
| import_exceptions | batch_id -> import_batches; source_row_id -> source_rows; optional resolved_by -> managed auth.users | Review authority, reason/state vocabulary, NULL-aware issue deduplication and restricted notes/locators; exceptions are not canonical operational records |
| audit_events | Optional batch_id -> import_batches; optional actor_user_id -> managed auth.users; entity_id intentionally durable audit locator | Minimized allowlisted metadata, real actor/service attribution, append-only enforcement, retention/review and non-client access; no sensitive before/after dumps |

After separate authorization, construction order is roots source_files + import_batches, then source_sheets, source_rows, import_exceptions, and audit_events after verifying actual managed Auth dependencies. Resolve optional self-links and uniqueness/NULL behavior explicitly. Shared origin metadata must not create a foundation-to-source_rows bootstrap cycle; immutable rows/audit must not blindly inherit mutable-field conventions. Nullable actor associations do not authorize anonymous writes. No extra staff/user grants table or business identity prerequisite is silently added to the six-table first scope.

Teacher/Cluster Officer business entry rights do not imply raw-source, exception-adjudication, import-service, audit, DDL or grant-admin access. Foundation roles and account/grant administration need their own explicit least-privilege capability matrix. Business-data decisions still pending can remain isolated while foundation design advances; they are not a reason to create permissive staging tables.

## Intended Supabase project

User identifies **pbkwpfdpdtelmvbkzgvx — Mass CAC Dashboard — Mumbai region**. This is project identification only. No Supabase tool is exposed in this session, and no read-only project API/management request was made. Ownership, actual region/version, existing schemas/exposure, Auth, grants/RLS, storage, database contents, tier and backup/recovery are not independently verified. Do not infer that the project is empty, is nonproduction, or is safe for synthetic tests. Do not create a replacement or link a CLI as part of this phase.

## Remaining approval questions

Owner groups below are proposed decision groups, not named people or granted accounts. Private examples/evidence must go through protected channels; credentials must never be put in repository documents or chat approvals.

| Gate | Exact approval / evidence needed | Proposed owner group | What can proceed without it |
| --- | --- | --- | --- |
| D10 privacy | Approve minimum operational fields, purpose/basis, child and staff disclosure, notes, source/exception/payload storage and access, retention/deletion and safeguarding process. Confirm Mumbai is acceptable for those purposes; identification alone is insufficient. | MASS data controller / safeguarding / security | Documentation and synthetic design review only |
| D13 audit | Approve permitted event/entity/field metadata and prohibited personal payloads; actor/service attribution, review rights, retention, append-only enforcement, transaction/retry/revision/correction process. | MASS security/data owners and technical administrators | Describe alternatives; no audit table or policy execution |
| D12 rollout | Explicitly approve only the six named foundation relations as the first implementation scope, or provide changes. Six/35/43 are not approved automatically by the confirmed workflows. Defer sensitive baseline and optional modules unless explicitly selected. | MASS product/programme owners | Review this package |
| D14 environment | Verify existing project reference/ownership/actual region, PostgreSQL capabilities, schemas/exposure and production boundary; approve an isolated synthetic-only local/nonproduction target, management access route, migration/RLS review and backup/recovery plan. | Authorized Supabase technical/security administrators | Read-only verification when tools/access are available; no resources or SQL |
| D11 foundation rights | Approve actual service/reviewer/admin accounts/capabilities, assignment/grant/revoke authority, private/source/exception access, and default-deny enforcement/test matrix. Business teachers/officers do not inherit technical permissions. | MASS security/data owners | Specify denied-by-default designs |
| D01 student identity | Select generated-ID format and server allocator/legacy allocation policy; designate matching authority/evidence/reversal contract. | MASS identity/data owners with technical administrators | Foundation metadata design; no actual identity matching |
| D02/D04/D15 history | Confirm authoritative source/aliases, actual historical assignment dates and overlaps, header/cell corrections, accepted snapshot scope, guidelines/version evidence and reconciliation acceptance. | Source/programme owners | Keep held records outside final operational tables |
| D03 attendance | Confirm authoritative centre/shift calendar, H representation, mark/holiday conflicts, zero-denominator/rounding/group aggregation and any engagement/dropout policy. Meanings and P/(P+A+L) are already confirmed. | Attendance/programme owners | Specify confirmed formula and unknown handling |
| D05/D06 assessment | Approve evidence-based historical scale/year/date mapping, Q-to-F alias, precision/statuses/paper eligibility/comparability and exceptional correction process; current max25 and April–March quarters already confirmed. | Assessment/source owners | Preserve literal source values; hold disputed results |
| D07/D08/D09 modules | Verify actual activity names/dates/categories and any historical bridges; Morarji cohorts/attended context/conflicts; authentic dated visits and scoped officers. | Relevant activity/Morarji/officer source owners | Document contracts; no invented names/dates/outcomes |

## Exact next safe implementation milestone

1. Obtain the foundation-specific D10/D11/D12/D13 approvals above and verify D14's existing project plus isolated test/backup boundary using authorized read-only access. Keep source business exceptions pending rather than blocking independent metadata design or filling gaps.
2. In a **separate expressly authorized implementation task**, draft the six-table SQL migrations and synthetic-only fixtures/tests locally for review. That authorization should name the six-table scope, test target and whether creating/running an isolated local instance is permitted. Drafting does not imply applying to the identified Supabase project. No real source rows, names, contact details, hashes derived from private rows, or genuine account grants in fixtures.
3. Review dependency/namespace/immutability/NULL uniqueness and minimized-data contracts; design meaningful direct SQL/API RLS tests for allowed/denied service/reviewer roles, spoofed client roles, anonymous access, append-only audit, revisions and retry safety. Test failure recovery and rollback/corrective migration on an authorized synthetic target only.
4. Require separate apply approval after migration/test review. Real historical staging/import and business-table/UI integration remain later milestones with verified identities, source-specific adjudication, reconciliation and explicit authorization. Production deploys are not part of this milestone.

This phase ends at step 1's documentation/readiness package; no migrations or synthetic instance were created or run. No SQL, seed files, import jobs, Auth/RLS changes, Supabase resources, frontend edits, new dependencies, merge, push or deployment is authorized by this report.

## Preservation and verification

Phase 2A/2B audit evidence and all Phase 2D documents remain unchanged. Phase 2C decision files and OPEN-DECISIONS retain their original text with a dated current-state pointer. Dictionary and ERD revisions are limited to confirmed-rule-driven field/contract changes; prior versions remain in Git at Phase 2D commit 9a2190c8a1c6a020a5024e94ff6b7445a212382e. All original 14 frontend-mapping columns and 23 interaction rows are preserved, with current-contract columns appended. No new workbook reading or personal-data extraction was performed. Do not build the source archive to publish these docs: current build includes docs, and all committed/publishable documents must remain free of private source material.

Changes stay local on feature/source-data-discovery for review. No publication or commit is required by this task; no push is attempted because Git integration could trigger Vercel and this phase prohibits deployment. Application files, main, production settings and hosted resources remain unchanged. Validation results are reported separately after checks.
