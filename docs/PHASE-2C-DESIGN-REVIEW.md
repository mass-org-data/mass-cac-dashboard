# Phase 2C — final database design review

Status: recommendations prepared for approval; database implementation is not authorized or started. Review date: 26 October 2026. Reuses the Phase 2B 43-relation dictionary and 23-interaction mapping, without repeating the workbook audit. Earlier documents are preserved unchanged; this review does not silently amend their field definitions or accept open rules.

## Recommended initial scope

Build a small technical foundation first, then gate each operational module. Do not create all 43 tables in a single speculative migration.

The proposed initial-core backlog is **35 relations**: 20 essential-to-core-form relations, 10 security/provenance/migration relations, and five history relations outside the expanded baseline survey (these still contain personal data and require scope/retention controls). Defer the six guidance/funding relations and two expanded private-baseline relations by default. This is a bounded target after approval, not 35 tables ready to apply today. Each module may remain blocked independently; the first synthetic/profile-attendance-learning pilot can be narrower.

Explicit sessions/events, batch comments and follow-up history are classified essential to preserve current **core form contracts**, even where no historical source supplies them. That is a product recommendation requiring D12 approval, not a new claim of source support. Morarji and visits can support future entered records only after their contracts/scopes are approved; unresolved legacy periods/dates are never fabricated.

Guidance/funding deferral is not permission to delete current frontend functionality or silently replace live records with samples. Keep the deployed prototype unchanged during development. Before a real-data rollout, approve which modules are live, how unresolved data is shown and any unavailable-module messaging; never blend synthetic values into real aggregates. If all optional modules must be live in the first release, expand scope explicitly and satisfy their missing data/permission gates first.

Private baseline survey relations are classified historical-preservation needs only **if that database retention is authorized**. Deferring them does not authorize deleting originals or retaining private copies indefinitely; D10 governs both. The default operational release does not need the complete sensitive questionnaire.

## All 43 relations — one primary classification each

| Code | Classification | Count |
| --- | --- | ---: |
| A | Essential for initial implementation | 20 |
| H | Required for preserving historical source data | 7 |
| S | Supporting security, provenance or migration | 10 |
| O | Optional future enhancement | 6 |

Primary classification describes the reason to keep the proposed relation, not a waiver of security or history requirements. F1/F2/etc are future implementation waves in PHASE-2C-IMPLEMENTATION-PLAN.md; H indicates gated historical work. Nothing is created now.

| # | Relation | Class | Why retain / initial role | Future wave | Approval gates | Limitation / review finding |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `projects` | A | Shared source/project scope; project labels do not establish funders. | F2 | D02,D14,D15 | Empty reference shape can be drafted independently; source label merges require review. |
| 2 | `centres` | A | Canonical centre reference is needed by placements and all centre-scoped modules. | F2 | D02,D11,D14 | No global unique-name assumption or automatic village-to-centre equivalence. |
| 3 | `centre_aliases` | H | Preserves source spellings/context without rewriting source snapshots. | F2/H | D02 | Approve each ambiguous alias; residence and centre are distinct. |
| 4 | `academic_years` | A | Results need explicit year identity, unlike the current student-round key. | F2 | D05 | Year labels can exist without guessed date boundaries; no forward fill. |
| 5 | `assessment_periods` | A | Keeps source Q1-Q4 within a year and separates frontend F aliases. | F2 | D05 | Do not install an implicit Q1=F1 mapping or guessed quarter dates. |
| 6 | `children` | A | Shared confirmed person registry underlies operational joins. | F2 | D01,D10,D11 | Internal UUID only for adjudicated people; missing source ID stays NULL. |
| 7 | `private_child_profiles` | A | Minimal scoped identity projection supports Student Profile and detail views. | F2 | D01,D10,D11 | Approve retained identity fields; no general access to sensitive baseline/DOB. |
| 8 | `placement_observations` | H | Sourced class/centre/shift observations must survive without invented effective dates. | F2/H | D01,D02 | An observation is not proof of enrolment start, transfer or exit. |
| 9 | `enrolments` | A | Necessary for new registration, as-of eligibility and safe placement edits. | F3 | D01,D02,D13 | Load only confirmed intervals; unresolved historical dates remain observations. |
| 10 | `roster_reviews` | H | Preserves retain/remove decisions and reasons independently of guessed exit dates. | F2/H | D01,D02,D10 | Normalize actions only after review; do not convert Remove into a fabricated dated exit. |
| 11 | `private_baseline_surveys` | H | Needed only if preserving this questionnaire in the database is authorized. | Deferred H | D10,D14 | Defer default build/population; conditional history requirement, not permission to retain all sensitive fields. |
| 12 | `private_baseline_answers` | H | Preserves versioned column/block meaning in an authorized questionnaire archive. | Deferred H | D10,D14 | Defer with surveys; generic responses must not become the operational reporting model. |
| 13 | `staff` | S | Confirmed staff identity is separate from Auth accounts and spreadsheet officer strings. | F2 | D01,D11 | No name-only account linking; owner approves actors and identity correspondence. |
| 14 | `staff_assignments` | S | Business assignment history supports officer attribution and scope review. | F2 | D02,D11 | Assignment does not itself grant access; missing historical dates are not filled. |
| 15 | `user_scope_grants` | S | Server-controlled explicit capability/scope is required for real-data access. | F2 | D11,D14 | No default global scope from NULL; no client role-dropdown authority. |
| 16 | `attendance_codes` | A | Literal source vocabulary must survive without H coercion. | F3 | D03 | Technical lookup may preserve labels; no unapproved denominator or status semantics. |
| 17 | `cac_sessions` | A | Current session entry and session-based attendance ratio need explicit session facts. | F3 | D03,D12,D13 | Source grid is not a held-session calendar; build only as approved future-entry contract. |
| 18 | `attendance_records` | A | Supports source dated observations and current single/bulk correction workflows. | F3 | D01,D02,D03,D04,D13 | Canonical grain/eligibility and conflict behavior must be settled before business constraints. |
| 19 | `assessment_definitions` | A | Separates year, quarter, paper, scale and revision. | F4 | D05,D06 | Do not equate observed highest score with configured maximum or rewrite paper scales. |
| 20 | `assessment_batches` | A | Current group comment/date form needs a stable entry context. | F4 | D06,D12,D13 | Essential for the full existing form contract, not a source-backed historical entity; no filter-string ID. |
| 21 | `assessment_results` | A | Preserves per-child/period/paper scores and corrections without year overwrite. | F4 | D01,D05,D06,D13 | Resolve nullable attempt uniqueness and canonical recorded-date policy before DDL. |
| 22 | `monthly_activity_returns` | H | Historical source is a monthly return, not a dated event. | F4/H | D01,D07 | Source month is known; person/project/duplicate handling must be confirmed. |
| 23 | `monthly_activity_responses` | H | Preserves each slot and Yes/No/unknown distinction. | F4/H | D07 | No category/date/Held inference; event bridge stays NULL unless verified. |
| 24 | `activity_events` | A | Existing two-stage activity form needs future explicit event storage. | F5 | D07,D12,D13 | Initial-core conditional module, not authority to invent past Saturday events. |
| 25 | `activity_participation` | A | Required for per-event marks/bulk participation and eligibility. | F5 | D02,D07,D12,D13 | Keep separate from historical monthly slots; scope changes need reconciliation/transactions. |
| 26 | `centre_visits` | A | Supports new dated visits and approved reporting/corrections. | F5 | D02,D09,D11,D12,D13 | All 200 undated legacy candidates stay quarantined unless authenticated/corrected. |
| 27 | `programme_cohorts` | A | Morarji view needs explicit cohort identity and approved period labels. | F5 | D08,D12 | No guessed source cohort year from example date, grade or filename. |
| 28 | `cohort_memberships` | A | Preserves repeated person participation across confirmed cohorts. | F5 | D01,D08 | Unique child/cohort rule remains conditional on repeat-attempt policy. |
| 29 | `morarji_outcomes` | A | Separates application/exam/pass/school from unsupported awards. | F5 | D08,D12 | Approve source-backed fields first; extra outcome fields remain disabled/NULL, not backfilled. |
| 30 | `followup_actions` | A | Current follow-up form needs durable actions rather than latest-note overwrite. | F5 | D12,D13 | Essential for live core form parity; append episodes and project the latest state to existing UI. |
| 31 | `guidance_sessions` | O | Optional later-module frontend with no source dataset. | Optional | D08,D11,D12 | No historical guidance import or generated session dates. |
| 32 | `guidance_participants` | O | Optional module needs explicit person/session identity. | Optional | D01,D11,D12 | Do not create student links from free-standing names. |
| 33 | `guidance_followups` | O | Optional repeated contact/destination/evidence history. | Optional | D11,D12,D13 | Sample destinations and evidence labels are not approved enums. |
| 34 | `guidance_feedback` | O | Optional feedback needs real session/author scope. | Optional | D11,D12 | Do not carry the global prototype feedback string into real mixed-user data. |
| 35 | `funders` | O | Live donor reporting needs verified identities, not inferred project labels. | Optional | D11,D12 | No donor account or external access is approved. |
| 36 | `centre_funding_periods` | O | Future donor attribution needs verified dated funding and overlap rules. | Optional | D02,D11,D12 | No invented funding dates or double-counted people across funders. |
| 37 | `source_files` | S | Immutable snapshot catalogue and restricted storage references. | F1 | D10,D14,D15 | Shape can be drafted without child/metric decisions; real artifacts require approved storage/retention. |
| 38 | `source_sheets` | S | Exact tab/header classification includes hidden/report/template sheets. | F1 | D10,D14,D15 | Metadata shape independent of canonical business rules; no invented Google IDs. |
| 39 | `import_batches` | S | Versioned extraction/import attempts and checkpoint/counter accounting. | F1 | D13,D14 | Shape is independent; confirm retry and reconciliation contract before applying. |
| 40 | `source_rows` | S | Immutable source occurrence and column/cell lineage; not person identity. | F1 | D10,D14,D15 | No hash-only person/dedup keys; restrict row locators and raw payload references. |
| 41 | `identity_resolutions` | S | Reviewed crosswalk is necessary because source person IDs are absent. | F2 | D01,D10,D11,D13 | Specify accepted/current revision representation before unique constraints; preserve rejected/ambiguous evidence. |
| 42 | `import_exceptions` | S | Private failed/quarantined occurrence register; reason flags may overlap. | F1 | D10,D13,D14 | General logs remain non-identifying; row locators/review details are restricted. |
| 43 | `audit_events` | S | Attributable corrections, provenance and grant changes require append-only audit. | F1/F2 | D10,D11,D13,D14 | Metadata shell can be drafted early; payload retention, actor integrity and append-only enforcement need approval. |

## What can be developed independently later

No table is approved to create in this phase. After a separately approved implementation task and D10/D11/D14 security/project boundary:

- The **metadata shapes** for source_files, source_sheets, import_batches, source_rows, import_exceptions and minimal audit_events can be drafted/tested with synthetic data while D01-D09 remain unresolved. Real payload access, actor/audit enforcement, retention and final retry details still need D10/D11/D13/D14. Six independent shapes are not six approval-free deployments.
- Empty projects/centres references can be drafted without choosing real aliases. Academic year/period structures can be drafted without filling source years, boundaries or F aliases. An attendance literal-code lookup can be drafted without defining credit/denominator semantics. These are empty technical contracts, not accepted source mappings.
- Identity resolution workflow can be designed/tested synthetically before resolving real people, but the current-accepted revision/target rules require D01/D13 before constraints are frozen.
- Enrolment overlap, canonical attendance grain, paper/attempt uniqueness, scale constraints, historical activity/event bridges, cohort identity, visit promotion and allowed RLS paths must wait for their listed decisions. Do not over-permit them merely to bypass gates.

## Schema details to settle before SQL

These are review findings, not changes to Phase 2B or additions to its 43 relations:

1. **External-ID issuer scope (D01):** children.external_student_id alone cannot enforce the dictionary's scoped uniqueness. Keep it NULL/unconstrained as an unapproved field until issuer scope is defined, or approve an explicit scoped identifier design in a later revision. Do not add a 44th table silently.
2. **Identity resolution versions (D01/D13):** the dictionary requires one current accepted resolution but has no explicit current/revision selector. Approve an append-only revision/supersession/current-state contract before a partial unique index. Never overwrite the only evidence record to simulate history.
3. **Nullable business keys (D02/D06):** PostgreSQL ordinary UNIQUE permits repeated NULLs. Define accepted child/definition/attempt grain and NULL treatment; do not default unknown attempts to 1. Apply the same review to context-sensitive aliases, source origin keys and issue-register fields. Verify database version before relying on NULLS NOT DISTINCT.
4. **Source occurrence versus canonical fact (D02/D13):** unique origin_row_id + origin_fact_key prevents repeated extraction of the same observation; it does not prove that two different sources report different facts. Canonical reconciliation needs approved identity/grain and reviewed source equivalence.
5. **Temporal eligibility (D02/D03):** distinguish observed source placement, confirmed enrolment interval, explicit session date and recorded attendance. Cross-FK centre/shift/date agreement needs reviewed transactions/constraints; a child ID FK alone is insufficient.
6. **Approved definition/maxima (D05/D06):** revisioned paper definitions must be immutable once referenced; maximum validation cannot be a CHECK that queries another row. Specify a trusted transaction/trigger/RPC with matching RLS enforcement. Pending/unknown scales must not drive published comparisons.
7. **Provenance/audit scope (D10/D13):** shared technical metadata should not be blindly applied to immutable snapshot/audit tables as mutable fields. Importer timestamps are not original event dates/authors. Audit entity locators are intentionally not business FKs; define allowlists/retention without copying full private row snapshots into general logs.
8. **Database versus browser boundaries (D11/D14):** private namespace exposure, Auth identities, grants, storage policies, security-invoker views and adapter config require actual project/version inspection. No client role label or absence of a menu item is an authorization rule.

## Frontend conclusions

All 23 interactions have a reviewed path in PHASE-2C-FRONTEND-COMPATIBILITY.csv. Seven can retain their present layout with the required adapter/security behavior; ten need focused semantic/form/filter/display changes; four belong to deferred live modules; two require safety-boundary changes. These are design estimates, not tested implementations. All future real-data interactions require async save/loading/error/conflict/session handling; layout preservation does not mean zero JavaScript change.

Global integration needs approved sign-in/session handling, real server scopes and removal of localStorage as the authoritative personal-data store. Keep existing page architecture; do not rewrite the frontend framework or redesign charts. Necessary changes are limited to truthful identity/period/status context, the source-supported School Name field, historical monthly-versus-event distinction and safety controls. No frontend change is made now.

## Readiness conclusion

The design is ready for the user's review of scope and D01-D15, with the schema clarifications above included. It is **not ready for unqualified SQL implementation, historical migration, production Auth/RLS or a real-data frontend release**. A separately authorized metadata-only/synthetic foundation track can progress before every historical exception is resolved, once its own security/platform/technical gates are approved. Business modules and data promotion remain independently gated.

Exact approval checklist and migration/test sequence: PHASE-2C-IMPLEMENTATION-PLAN.md. Compact approval choices: PHASE-2C-APPROVAL-REGISTER.md. This review accepts none of those choices on the user's behalf.
