# Phase 2D — implementation readiness

Reference date: 26 October 2026. **Documentation/approval preparation only; not ready to create database resources.** No source-workbook audit or frontend discovery was repeated. Existing Phase 2A/2B evidence, Phase 2C 43-relation review and the 23-interaction mapping are reused.

## Approval state and hard boundaries

Eight Conditional: D01,D02,D04,D07,D09,D11,D13,D15. Four Partial: D03,D05,D06,D08. Three Pending: D10,D12,D14. None is Fully Approved.

Preservation, truthful unknowns, separation of historical observations, scoped server control and revision/audit principles are accepted only to the stated extent. No person matches, source meanings, academic mappings, paper maxima, real roles, retention periods, database scope or target are approved by inference. The proposed six/35/43 relation scopes remain candidates. No SQL, table, test instance, real-data staging/migration, Auth/RLS modification, frontend change or deployment is authorized now.

## Exact six foundation candidates

Names, purposes and dependencies were checked against DATABASE-DATA-DICTIONARY.md and the Phase 2C plan. This check confirms what is proposed; it does not approve the schema or activate it. auth.users is a future dependency on the verified managed Auth schema, not a request to create accounts/resources now.

| Candidate relation | Purpose | Explicit dependencies in current field list | Remaining technical/privacy gate |
| --- | --- | --- | --- |
| `source_files` | One immutable input-file snapshot: exact filename/fingerprint, known version/IDs and restricted storage reference. | No explicit relation FK in its own field list. | Privacy/retention of artifact references, storage target, receipt versus source-event timestamps; original IDs/versions may remain unknown. |
| `source_sheets` | One tab within the frozen workbook: exact name/ordinal, known native ID and versioned header/validation metadata. | file_id -> source_files.id | Classification acceptance and source-version/ID semantics; no personal record payload in header_spec. |
| `import_batches` | One versioned extraction/import execution context: mapping/extractor version, state, checkpoint and reconciliation counters. | No explicit relation FK in its own field list. | State/retry/checkpoint rules and actor permissions; metadata catalogue does not authorize running an import. |
| `source_rows` | One physical row/range occurrence in a frozen tab: locator/fingerprint, restricted payload reference and classification. | sheet_id -> source_sheets.id; first_batch_id -> import_batches.id; canonical_source_row_id -> source_rows.id (optional self-reference) | Private row/identifier handling, reviewed source-equivalence, immutability and NULL rules. A locator/hash is never a child ID. |
| `import_exceptions` | One issue for a source occurrence/field/run: non-PII reason, review state and protected resolution metadata. | batch_id -> import_batches.id; source_row_id -> source_rows.id; resolved_by -> auth.users.id (optional) | Duplicate-issue NULL semantics; review/correction authority; details/locators remain restricted. Flags are not imported facts. |
| `audit_events` | One attributable append-only operation with minimized entity/revision metadata and actual operation time. | actor_user_id -> auth.users.id (optional); batch_id -> import_batches.id (optional). entity_id is an intentional audit locator, not a business FK. | Actor authority, allowlisted targets, append-only enforcement and private payload/retention contract. No PII-rich before/after dump. |

### Dependency and bootstrap review

Proposed construction order after approval: source_files and import_batches first (independent roots); source_sheets after source_files; source_rows after sheets and batches; import_exceptions after rows/batches; audit_events after batches and verification of managed auth.users. Its nullable actor/batch associations do not approve anonymous audit writes. Resolve optional self-reference and bootstrap NULL behavior explicitly.

The dictionary's shared source-origin conventions must not make provenance roots depend on their own future source_rows. Likewise immutable snapshots/audit do not inherit mutable update fields blindly. Final namespace/grant/immutability/uniqueness/actor definitions require review before SQL. Source metadata can still be sensitive: row locators, literal record identifiers, hashes and payload links are not public data merely because names are omitted.

These six do not require deciding WO/MM/L meanings, actual cohort years or paper maxima to describe their shapes. Applying or populating them still requires D10 privacy/storage, D12 explicit first scope, D14 target/test safety and the relevant D11/D13 permission/audit/retry contracts. Do not build permissive tables to get around unresolved gates.

## Proposed minimal operational-data scope — not approved

| Candidate information | Why it may be needed | Boundary / justification still required |
| --- | --- | --- |
| Internal UUID for a verified child; existing external ID only if genuinely supplied | Stable approved person linkage | D01 authority/evidence and external-ID scope; no fabricated source identity |
| Minimum authorized child display identity | Teacher/operator recognition in scoped lists | D10/D11 approve fields/rights; do not expose full private profile |
| Confirmed centre/project/class/shift observations and evidenced episodes | Historical attribution and eligibility | D02 precedence/aliases/date/overlap; observation is not inferred enrolment |
| Actual attendance literals/dates, source academic/score observations and monthly slots | Preserve operational source facts for later accepted reporting | D03/D05/D06/D07 semantics remain open; no final metrics or inferred events |
| Verified programme/visit/outcome observations, including school names where source-backed | Cohort/visit reporting once supported | D08/D09 and privacy/scope gates; no dates/cohorts/award classification invented |
| Minimum actor/revision/source lineage and non-identifying issue counters | Accountability and safe retries | D10/D11/D13 approve payload access/retention and actors; source locators remain restricted |

Do not assume DOB, parent/guardian names or phone numbers are mandatory operational fields. Any identity-adjudication need requires explicit purpose and protected access; it is not permission to expose them in normal UI/API payloads. Religion/caste, family financial/loan/income responses, disability/health, safeguarding/marriage-related information, detailed private notes and the full questionnaire require additional field-level justification. Expanded-baseline tables remain deferred design candidates, not approved retention or deletion instructions.

No retention duration, legal/privacy basis, region or individual access right is selected. Owners must decide purposes, minimum fields, access/disclosure, temporary source handling, retention/deletion and safeguarding process. Preserve source evidence under its authorized handling boundary without making indefinite retention or database capture the default.

## Supabase identification and safety checks

Current read-only discovery: no Supabase connector/tool, Supabase CLI, local project config/reference, injected Supabase/database binding or declared environment requirement was available. The intended existing MASS project could not be identified or inspected. This does not establish that no project exists. Do not infer its identity from GitHub/Vercel names, and do not create a replacement.

| Required check | Evidence to obtain from authorized technical administrators | Current state |
| --- | --- | --- |
| Project identity/ownership | Non-secret project reference/dashboard identity and confirmation that it is intended for MASS | Unknown |
| Region/version/exposure | Actual region, PostgreSQL/Supabase capabilities, exposed schemas/grants and private/storage boundaries | Unknown |
| Production boundary | Exact production project and least-privilege management route; no target inferred from a name | Unknown |
| Synthetic test isolation | Approved separate local/nonproduction target; no production reset, no real fixtures | Pending D14 |
| Versioned migrations | Reviewed order/dependencies, forward-only correction practice and verified apply target | Plan only; no SQL files |
| Auth/RLS/storage testing | Approved user-capability matrix and direct allowed/denied API/storage tests; no policy changes now | Actual D11 rights pending |
| Backup/recovery/rollback | Verified capabilities on the actual project/tier and tested recovery/reversal process that preserves later corrections | Unknown |
| Deployment/publication safety | Verified deployment-free documentation publication path; future application/database releases separately authorized | Not verified; no push/deployment |

Do not request or commit credentials. Existing project metadata and authorized read-only access are the next evidence, not an assumption that a new secret/project is needed. No resource was created, changed or deleted to perform these checks.

## Existing frontend contracts — 23 interactions retained

The table separates stable **technical direction** from unresolved schema/API fields, meanings and rights. Stable does not mean executable approval. Original interaction IDs/order are retained from the Phase 2B/2C matrices. Preserve vanilla JS architecture and layouts where possible; no framework rewrite or source change occurs now.

| ID | Existing interaction | Stable technical direction | Contract still dependent on decisions |
| --- | --- | --- | --- |
| 1 | Programme charts and student summary | Preserve source observations and distinguish unknown/unverified records. | Attendance/engagement/score/cohort metrics, coverage and source precedence: D02-D09; actual read rights D11. |
| 2 | Create student profile | Use verified identity linkage/internal UUIDs and never fabricate external IDs. | Who may verify/create a child, evidence/display/fields and date/assignment semantics: D01,D02,D10,D11. |
| 3 | Edit existing student | Do not rewrite historical assignments with current profile values; use revision-aware change history. | Effective dates, correction versus transfer, permitted edits and reasons: D02,D11,D13. |
| 4 | Read cross-programme child record | Use verified shared identities and explicitly scoped server access. | Identity matches, private projection, as-of/history rights and actual query fields: D01,D02,D10,D11. |
| 5 | Single attendance correction or clear | Keep literal codes and unknowns; prevent unintended duplicate/stale writes. | Even P/A/WO/MM/L meaning, H handling, eligible date/calendar and edit rights: D03,D04,D11,D13. |
| 6 | Bulk Present/Absent/Holiday | Transactional/revision-aware technical direction; no production demo reset. | Exact bulk atomicity/membership/code choices, permissions and recovery workflow: D03,D11,D13. |
| 7 | Create or correct planned CAC session | Do not invent historical Held sessions or calendar facts. | Approved session statuses/date/shift uniqueness and new-entry contract: D02,D03,D12,D13. |
| 8 | Create or replace follow-up note | Append follow-up events and preserve attributable history. | Statuses, correction/privacy permissions, audit/retention and current/latest display contract: D10,D11,D12,D13. |
| 9 | Correct all four rounds for one student | Preserve actual numeric values and source year/quarter; unknown stays unknown. | Maximum/precision/paper/attempt/status/date and Q-to-F/year rules: D05,D06; edit rights D11/D13. |
| 10 | Batch results and group comment | Avoid duplicate/stale writes and preserve original scores. | Stable batch identity/membership, atomic workflow, comments/dates/maxima and access: D05,D06,D10-D13. |
| 11 | Compare scores and show school-performance placeholder | Do not rescale or invent bands/comparisons from unconfirmed values. | Allowed periods/papers/scales/aggregation and reporting classifications: D05,D06,D11. |
| 12 | Create/edit activity details: first stage | Keep future dated events separate from historical monthly responses. | Catalogue/categories/date scope, event contract and duplicate/permission rules: D07,D11,D12,D13. |
| 13 | Save activity plus individual/bulk participation | Do not infer event details from slots; retain historical responses. | Slot interpretation/bridge/display, eligibility, scope-change/bulk semantics and rights: D02,D07,D11-D13. |
| 14 | Record a visit | Undated/template-like rows are not verified visits; preserve evidence. | Historical authenticity/dates/officer mapping and exact future required fields/status/correction rights: D09,D11-D13. |
| 15 | Add child to training cohort | Uncertain identities remain unresolved; preserve source observations. | Cohort definition/year, eligibility/repeated membership and rights: D01,D08,D11,D12. |
| 16 | Correct current or historic cohort outcomes | Preserve source indicators/school observations; do not populate unsupported outcomes. | Meaning/conflicts/statuses/cohort/training versus award extensions and correction rights: D08,D10-D13. |
| 17 | Add standalone participant | No source values/identities or dates may be invented. | Live guidance module, session/person contract and access are unapproved: D01,D11,D12. |
| 18 | Correct participant follow-up | Preserve attributable history where later approved; do not overwrite it silently. | Live guidance statuses/destination/evidence/contact workflows and rights: D11-D13. |
| 19 | Save teacher session feedback | Server scope must be explicit; no labels imply permission. | Whether guidance feedback is in first scope and its session/author/retention contract: D10-D13. |
| 20 | Display/print aggregate reports | Deny unapproved access; donor/programme names confer no rights. | Funder identity/funding/attribution, real donor capabilities and aggregate disclosure: D02,D10-D12. |
| 21 | Export current student or donor summary | Server-controlled authorization and preservation of unconfirmed values. | Permitted export fields/rights, calculation approval, CSV safety/audit/retention workflow: D03,D05,D06,D10,D11,D13. |
| 22 | Download source archive | Keep private records/credentials out of public documentation and code archives. | Future archive exclusions and deployment checks require technical verification; no data/API implementation needed now: D10,D14. |
| 23 | Reset local sample records | Demo reset stays isolated from production data. | Exact synthetic/live mode and future deletion/retention/user-experience contract: D10-D13. No production reset is approved. |

Async/auth/session/error/conflict behavior will require a later reviewed adapter. The conditional approvals do not approve precise payloads, new input controls, period aliases, extra outcomes or module activation. Preserve all current frontend files while decisions are completed. No UI choices or permissions have been silently selected here.

## Implementation readiness and next milestone

| Gate | Current result |
| --- | --- |
| D01-D15 dated disposition recorded | Complete: Conditional 8 / Partial 4 / Pending 3; no Fully Approved decision |
| Original evidence/recommendations retained | Verified preservation baseline; only authorized Phase 2C approval overlays updated |
| Six candidate names/purposes/dependencies checked | Complete as design verification, not implementation approval |
| Minimal operational field scope | Proposed only; D10 approval pending |
| Actual permissions/audit workflows | Pending D11/D13 conditions |
| Initial database scope | Pending D12 |
| Existing project/test/backup boundary | Pending D14; no accessible project verified |
| Domain mappings/metrics | Relevant D01-D09 business conditions pending |
| SQL/resources/Auth/RLS/data/frontend | Not created, applied, migrated or modified |
| Privacy-safe documentation commit | Permitted only after consistency/privacy verification; actual commit reported separately |
| GitHub PR | Blocked in this session: GitHub API returned Forbidden; no deployment-free feature-branch publication path verified |

**Next safe milestone:** obtain D10's minimal handling boundary, D12's exact first-scope selection and D14's intended project/read-only test-boundary verification, plus the selected foundation's D11/D13 security/audit/retry details. Then request a separately authorized task to draft reviewed foundation migrations and synthetic-only tests for the verified target. This document does not authorize even local SQL implementation or a new test instance. Real data and business modules remain independently gated after that.

## Git and deployment boundary

The user authorizes committing verified privacy-safe documentation. Earlier Phase 2A/2B/2C review files were still local/uncommitted; include them only as preserved review/evidence baselines, not as approval of their proposed schema or business values. The Phase 2D change set creates three documents and updates two Phase 2C approval files. Stage documentation paths explicitly; no datasets, extracts, exception registers, credentials, generated artifacts or application code.

The GitHub API read request returned Forbidden, so PR creation through that API is unavailable. Native Git publication may still work, but the existing Vercel Git integration can create feature-branch deployments. A push must not be used to test whether it deploys. No existing documentation-only skip behavior could be verified with the available Vercel access; this task forbids deployments and does not authorize changing deployment settings. Therefore commit locally only, do not push/open a remote branch as a workaround, do not disconnect/pause Vercel, and report the local SHA and PR blocker. A later verified safe publication route or separately authorized release step is needed for a PR.
