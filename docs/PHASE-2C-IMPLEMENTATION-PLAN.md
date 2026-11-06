# Phase 2C — phased implementation and readiness plan

This is a plan only. No SQL migrations, tests, fixtures, schemas, resources, Auth settings or frontend code are created by this phase. Phase 2A/2B documents remain unchanged. Implementation needs a subsequent authorized task, verified target and the relevant D01-D15 approvals. All table references resolve to the proposed Phase 2B dictionary and Phase 2C classification.

## Boundaries and target

Recommended backlog: 35 relations across core functions, non-expanded-baseline history, security and provenance; defer six optional guidance/funding relations and two sensitive baseline relations by default. These deferred historical tables are conditional on retention approval, not an instruction to delete or indefinitely keep original data. Every real-data relation remains subject to privacy/access controls.

Compatibility legend: L = layout retained with required adapter/security behavior (7 interactions); M = focused semantic/filter/form/display change (10); D = deferred live module (4); S = required safety-boundary behavior (2). PHASE-2C-FRONTEND-COMPATIBILITY.csv covers all 23 existing interactions. These are review estimates, not test outcomes.

## F0 — approve and inspect, without changing live systems

Inputs: scope/priority selection, D01-D15 disposition, schema-clarification resolution, authorized owners and source snapshot authority. An unresolved historical fact may stay quarantined; it cannot be silently approved by accepting the model.

Later read-only platform review must identify the actual existing Supabase project/region/PostgreSQL version, exposed schemas, Auth/redirect/session settings, existing tables/policies/storage/grants, backup capabilities and recovery process. Do not assume a new project is necessary. Approve a separate local or nonproduction synthetic target and least-privilege management access. Never paste credentials into chat or place them in code/docs/Git.

Exit: approved implementation scope and environment boundary (D10/D11/D14), plus technical fixes required for the selected track. No database work is currently authorized.

## F1 — technical foundation with synthetic data only

Candidate independent shapes: source_files, source_sheets, import_batches, source_rows, import_exceptions and minimal audit_events. D01-D09 may remain open while these are drafted, but retention/access/audit/retry decisions and D14 still gate applying them. Metadata alone does not approve private payload loading.

Design deterministic source occurrence keys, row/column locators, mapping/extractor version attribution, checkpoints after commit and minimal non-PII reason counters. Do not use a hash or row locator as a person identity. Use append-only snapshot/audit paths with tightly controlled service access; no arbitrary browser inserts/updates/deletes.

Exit evidence after future implementation: clean synthetic install, repeat extraction no duplicates, checkpoint recovery, private-schema/storage denial, immutable snapshots/audit and no raw private values in ordinary logs.

## F2 — references, identity, history and access

Implement only approved empty reference structures; seed source labels/aliases only when accepted. Resolve technical identity/issuer scope and accepted-current resolution revision design. Use confirmed children/private identity, source placement observations and separate dated enrolments. Staff identity, business assignment and actual user grants remain separate.

Approve the real capability/scope matrix, including historical read/edit rules, exports, grant administration and private-field projection. Start with no anonymous/implicit real-data access. Server-controlled actor/revision values cannot be forged. No source person matching or historical loading takes place merely because the tables exist.

Exit: synthetic namesakes/unknown IDs do not merge; unknown episode dates stay observations; forged grants/actors and out-of-scope reference changes are rejected; approved users can perform their explicitly allowed paths.

## F3 — registration and attendance pilot

Enrolments, literal attendance codes, explicit CAC sessions and dated attendance facts after D01-D04/D10-D13. Define canonical grain, multi-shift/overlap handling, unknown/clear semantics, source-cell versus canonical-fact idempotence and explicit session evidence. Approve codes/calendar/denominator before derived metrics; do not invent Held sessions or map WO/MM/L to H.

Exit: synthetic single/bulk correction and clear work atomically with revisions/audit; correct eligibility by date/centre/shift; all unknown/code cases remain distinct; counters and ratios reconcile to an approved synthetic oracle. No historical anomalies are promoted by default.

## F4 — academic results and historical monthly activity

Approve D05-D07 before paper/year/quarter/scale/attempt constraints or transformations. Keep definition revisions immutable, decimal rules configurable to approved paper policy and missing distinct from zero/Absent. Nullable attempt uniqueness is explicit, not a loophole or a guessed attempt number.

Build monthly source returns/responses independently from dated events, preserving slot ordinal and unknown flags. Scope/provenance/identity are mandatory before any real promotion. No event bridge is generated without evidence.

Exit: synthetic multi-year and multi-paper cases do not overwrite; mixed scales do not produce unapproved comparisons; sparse-year/date input remains quarantined; monthly slots reconcile independently with Yes/No/NULL totals.

## F5 — conditional core modules

After their specific decisions, add explicit new event/participation writes, authenticated dated visits, confirmed programme cohorts/memberships/Morarji outcomes, and appended follow-up actions. Batch comments also need the approved input/history contract. These preserve core frontend workflows but cannot create historical data that sources do not contain.

All undated/template-like visit rows, unknown Morarji cohort periods and conflicting outcomes remain staged until reviewed. Extra Morarji training/award outcomes require separate field approval and no source backfill. Separate old monthly returns from new events in reports.

Exit: eligibility and scope-change reconciliation are transactional; cohort history supports repeated membership; old notes survive correction; pass does not imply scholarship; no undated row becomes Completed.

## Optional/deferred tracks

- private_baseline_surveys/private_baseline_answers: only after D10's purpose, field-level retention, access and deletion plan. Preserve versioned question/column/block meaning; do not turn raw survey answers into unapproved operational facts.
- guidance_sessions/participants/followups/feedback: only after approved real requirements, identity/session/evidence vocabulary and scoped permissions. No source historical dataset is assumed.
- funders/centre_funding_periods: only after verified funder identities, periods/overlap attribution and permitted aggregates. No donor accounts or raw child access are inferred from project names.

Deferral leaves the current frontend untouched. A later real-data product rollout must explicitly state module availability; do not silently remove functions or mix prototype records into live results.

## Proposed SQL migration sequence — filenames only, not created

Use reviewed versioned files under supabase/migrations in a future implementation task. Generate actual version prefixes then; order dependencies explicitly and inspect all existing schemas first.

| Order / proposed suffix | Purpose and dependency cautions |
| --- | --- |
| 01_security_namespaces_and_base_grants.sql | Approved private/staging exposure and deny defaults; no automatic client grants |
| 02_source_catalog_and_import_batches.sql | source_files/source_sheets/import_batches; no invented original IDs |
| 03_source_rows_and_exceptions.sql | Frozen source occurrences/self-reference, first-batch FK, reason/register constraints |
| 04_reference_identity_and_observations.sql | References, children/private identity, staff, aliases, placement observations and roster reviews; apply only approved fields/grain |
| 05_identity_reviews_access_and_audit.sql | Explicit resolution revision/current constraints, business assignments, server-owned grants and audit contract; referenced Auth identities exist in managed auth schema |
| 06_enrolments_and_attendance.sql | Approved interval/code/session/fact grain; source-cell keys; scope/date consistency |
| 07_assessment_definitions_batches_results.sql | Verified period/paper/scale/attempt uniqueness and trusted cross-row validation |
| 08_monthly_activity_and_explicit_events.sql | Keep source returns distinct; create event relation before any optional response->event FK; no implicit bridge population |
| 09_visits_cohorts_outcomes_followups.sql | Confirmed dates/cohort identity and approved new-entry/outcome/history contracts |
| 10_approved_views_rpcs_and_policies.sql | Scoped read/write/aggregate/export interfaces; RLS/grants ready before any real data or client access |
| Later optional_baseline_or_guidance_or_funding.sql | Separate reviewed modules only if approved; no assumption all 43 are needed in first release |

A migration must not temporarily expose data between table creation and RLS/grant setup. Keep relations deny-by-default/unexposed from their first migration; later allowed policies are added only after review. Do not deploy permissive intermediate schemas to a live client. Do not use cascade deletion to erase lineage/audit, disable constraints to load failures, or mutate an applied migration to hide changes. Prefer forward corrective migrations after review.

Source-backed canonical origin FKs are added only after source_rows exists. source_rows first_batch_id references already-created import_batches. Accepted identity resolutions reference already-created children/staff. General audit locators are not falsely declared business FKs. Final namespace/function/constraint choices depend on the actual database version and approved design clarifications.

## Synthetic seed and automated test contract

Do not reuse real source names, contact details, dates of birth, row-level exceptions or personal identifiers as fixtures. Generate deliberate fictitious records with clearly synthetic references. Supabase test Auth identities are synthetic; no staff accounts are auto-created from source names. Reference/lookup fixtures may model literal status tokens, but do not portray unresolved semantics as approved business policy.

| Test track | Required evidence before acceptance |
| --- | --- |
| Schema install/upgrade | Fresh isolated install and sequential upgrade succeed; FKs resolve, private exposure/grants are correct; no real credentials or destructive remote reset command |
| Identity | Two namesakes remain separate; missing IDs do not gain fake source IDs; rejected/ambiguous/current resolution revisions are represented and constrained |
| Time/history | Transfers do not rewrite old facts; unknown dates remain unknown; valid multi-shift cases follow the approved policy; overlap and NULL semantics tested |
| Attendance | All source code/unknown cases, partial calendar, missing/future dates, explicit sessions and single/bulk/clear atomicity; approved formula oracle and coverage |
| Assessments | Multiple years/quarters/papers/scales, zero versus missing/Absent, configured precision, duplicate/unknown attempts and immutable definition revisions |
| Activity/cohort/visit | Month slots do not become dates; repeat cohorts do not overwrite; conflicts and undated visits remain unresolved; event-scope changes reconcile marks |
| Provenance/retries | Same snapshot/row/cell does not duplicate; identical legitimate rows keep distinct locators; changed snapshots/retries do not overwrite newer human corrections |
| Security/RLS | Direct API allowed/denied tests: anonymous, other-centre/project, forged actor/scope, changed assignments, unauthorized parent refs, exports/private schema/raw storage/grant/audit tampering |
| Transaction/concurrency | Two clients editing the same row get a deterministic conflict; failed bulk/event/batch writes leave no partial mutation; audit/checkpoint follows commit |
| Reporting/export | Counts reconcile at accepted grain, null/unknown coverage retained; no mixed-scale/unsupported causal metrics; approved payload minimization and CSV formula-prefix protection |

Use reviewed SQL assertions/pgTAP or equivalent appropriate tooling later; no tool dependency is installed now. Prefer security-invoker views/RPCs where supported. Test any security-definer helper's fixed search_path, grants, scope enforcement and privilege boundary. Never treat hidden buttons as RLS tests.

## Future frontend integration / Preview gate

The 23-row compatibility review governs minimal changes. Add a small async data-access boundary to the vanilla JS architecture, with approved Auth/session/scope handling, saves/errors/conflicts and loading states. Keep layouts unless source correctness demands context/field changes. Do not redesign or introduce a framework migration. Do not make localStorage the authoritative store of real personal records or silently keep the role-preview authority.

Run source-code checks/build and repeat targeted browser workflows against synthetic APIs: profile, attendance, marks, events/participation, visits, cohorts, follow-up, scoped exports and mobile navigation. Validate actual Preview only in a separately authorized deployment phase; never merge to main automatically. Do not claim Preview/browser success from this design review.

## Future secure historical validation and reconciliation gate

Only after separate data-processing/import approval and secure target verification: stage immutable approved snapshots outside Git/source ZIP, run versioned transformations, resolve person/period/source conflicts, and review quarantines. Original Sheets remain unchanged.

Reconcile source row occurrences = accepted + quarantined + explicitly excluded for each snapshot/tab/track, and separately reconcile expanded attendance/day and activity/slot cells. Alternative rosters/reports cannot be added as extra people. Candidate duplicates are not automatically merged. Record actual source facts, unresolved cases, decision evidence, lineage and approved differences from source summaries. No error-free or complete-history claim is made merely because SQL returns success.

Retry after partial failures must be idempotent and auditable. Back up before real writes, verify recovery against the actual platform, and use batch-aware reversal that preserves later approved corrections. Review operational metrics/coverage and secure exports against accepted facts before any real-data release. No such operation occurs now.

## Readiness checklist

| Gate | Present status | Required evidence / approval |
| --- | --- | --- |
| Phase 2A/2B preserved | Verified by file checksums during this review | Do not edit historical baselines implicitly |
| 43 relation classifications | Prepared, recommendations only | User approval of selected scope and conditional modules |
| All D01-D15 analyzed | Prepared; all Pending | Authorized owner decisions with exact rules/values and conditions |
| 23 frontend interactions reviewed | Prepared, no code/tests run | Approve necessary changes and live-module rollout boundary |
| SQL key/history clarifications | Open | Issuer scope, accepted resolution versions, NULL uniqueness, grain/period/max constraints |
| Real identity/period/code/scale resolution | Not approved | Source-owner accepted rules and protected adjudication, no fabricated facts |
| Private data purpose/retention/access | Not approved | D10/D11 including minimal identity, source payloads and error/audit handling |
| Existing project/isolated test target | Not verified by this phase | D14 read-only assessment and explicit target authorization |
| SQL migrations/schema tests/RLS | Not created or run | Later authorized implementation and reviewed synthetic test results |
| Historical import/reconciliation | Not performed | Separate secure import approval and accepted/quarantined/excluded reconciliation |
| Production/Preview deployment | Not performed | Separate release authorization; no automatic merge or deployment |

## Exact approvals requested

1. Accept/revise the 35-relation staged target and six-table metadata-first draft, with six optional and two expanded-baseline relations deferred. State whether full live guidance/donor parity is required initially instead.
2. Approve D01/D02 identity, source precedence and historical handling, explicitly leaving unsupported matches/dates unresolved.
3. Supply/approve D03-D09 code/calendar/year/date/scale/slot/cohort/visit rules for each selected operational track. Approving quarantine is a valid interim disposition; it is not approval to fabricate missing values.
4. Approve D10/D11 data minimization, retention, real user capabilities/scopes and minimal projections before any real data or allowed RLS path.
5. Approve D12/D13 future-entry extension scope, minimal UI corrections, versioned edits/audit, atomic bulk operations and separation of demo reset.
6. Approve D14 verified platform/test/migration process and D15 snapshot/process authority; provide missing guidelines where available.
7. Issue a separate implementation authorization after the selected track's gates are satisfied. No action in this plan constitutes that authorization.

## What changed in this phase

Only five new Phase 2C review documents were added locally on feature/source-data-discovery. All Phase 2A/2B files, application/business logic, main and source workbooks remain unchanged. No workbook audit was repeated, no personal data was read/copied into this review, no dependencies were added, no SQL/test/seed files or Supabase resources were created, no data was migrated and no commit/push/merge/deployment occurred.
