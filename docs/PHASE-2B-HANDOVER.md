# Phase 2B handover — source audit and proposed database design

Date: 26 October 2026. Prepared on local `feature/source-data-discovery`, based on frontend commit `9428656acdb6e924e368e08bd43ba9a139c8f0c9` and six supplied XLSX snapshots. Status: design ready for review, **not approved/ready for Supabase implementation or real-data migration**.

## Completed work

All six attached workbooks and all 53 worksheets were inspected, including two hidden attendance tabs. The audit covers headers, extents versus named/input candidates, formulas/caches, 114 validation rules, date/academic context, explicit examples, scaffolding, missing identifiers, duplicate candidates and cross-file relationship limits. The source workbooks were read without saving/recalculating them. `MASS | Shared Project Tasklist` was excluded. The existing 23-interaction frontend inventory/matrix was reused, not restarted.

The Pre-KC-2 Pilot Guidelines PDF is still missing; no process-compliance claim is made against it. Original Drive IDs/versions and live Drive history remain unverified; exact uploaded filenames and SHA-256 snapshots are recorded.

## Review package

| Document | Contents |
| --- | --- |
| SOURCE-INVENTORY.md | Six file fingerprints, all 53 worksheet entries, header fields/types, validation/period/formula evidence and count definitions |
| DATA-QUALITY-REPORT.md | Aggregate issues plus per-worksheet quality details and private exception-register handling |
| DATABASE-DATA-DICTIONARY.md | 43 proposed relations, field types/nullability, explicit FKs, source/frontend justification, grain, keys/constraints and index requirements |
| DATABASE-ERD.md | Four Mermaid domain diagrams and cardinality/uniqueness qualifications |
| FRONTEND-DATABASE-MAPPING.csv | All 23 existing interactions mapped to verified source references, proposed destinations, operations, history/access needs and incompatibilities |
| MIGRATION-PLAN.md | Field-level source-to-destination plan, identity/provenance, secure staging, idempotency, retries, reconciliation, exceptions and testing gates |
| SECURITY-AND-RLS-PLAN.md | Sensitive data separation, Auth/scope approval requirements, deny-by-default approach and synthetic policy/API tests; no policies implemented |
| OPEN-DECISIONS.md | Fifteen unresolved owner/security/semantic decisions with explicit review gates |
| PHASE-2B-HANDOVER.md | This completion and continuation record |

## Proposed schema summary

The 43 relations separate reference projects/centres/aliases and academic periods; adjudicated children/private identity; placement observations and confirmed dated enrolments; source roster reviews/private baseline snapshots; staff assignments and explicit user grants; literal attendance codes/dated facts; year-quarter-paper definitions/results; historical monthly activity returns/slots; explicit future sessions/events; verified visits; repeated cohort membership and Morarji outcomes; optional future follow-up/guidance/funding requirements; and immutable source/import/identity-resolution/exception/audit infrastructure.

Not all 43 are an approved first-release implementation scope. Frontend-only/future extensions are labelled, justified and gated; they must not be backfilled from mock data. Private questionnaire answers are an intentional source-history exception, not a generic EAV replacement for the normalized operational model. Internal UUIDs are technical keys for adjudicated entities, not invented source student identifiers. No actual child IDs, matches, records, tables, policies or migrations were created.

Significant source-driven decisions: preserve monthly slot responses independently from dated event participation; separate observed placements from unknown effective enrolment dates; key assessment results by verified year/quarter/paper instead of only student+round; retain school-if-passed as a real Morarji field while marking extra frontend outcomes unsupported; and keep highly sensitive child/family baseline responses out of ordinary operational/donor payloads.

## Main verified findings

- Attendance: 15 centre tabs contain 494 named row occurrences; master also 494 and hidden undated helper 429. These are not additive populations. Codes include P/A/WO/MM/L, not the frontend's assumed H vocabulary. One tab extends an extra day, master repeats a day, one shift is missing and ATT-04 has 14 numeric COUNTIF values in a day-labelled column.
- Registration: 98 named baseline profiles plus one partial row; 72 missing local serials; 27 missing DOBs and 32 other date-text values. Roster review has 561 named rows with 82 action labels beyond normalized retain/remove. There is no proven global person ID.
- Visits: 200 non-example input rows, all without dates and all with template-like remarks. These cannot be imported as completed visits or reconstructed from summary totals.
- Morarji: 550 named rows, all without student ID or Date; cohort period unknown. MOR-02 has 30 attendance/application and five pass/attendance conflicts. No source training-day/selection/admission/scholarship fields exist.
- Monthly activities: 2,557 named row occurrences, all IDs blank; period context October 2026. There are 5,113 unknown slot cells and no dated/category-specific event records.
- Assessments: 1,798 named rows; 1,794 academic-year blanks, 948 date blanks, 373 non-ISO date texts and 105 missing scores. All 1,693 numeric scores are <=25 despite morning maximum metadata 100. Quarter mapping/maxima must be reviewed, not rescaled or filled from assumptions. Four other tabs contain 1,896 unnamed scaffolding rows, not results.
- Twenty-five labelled example rows were excluded from named/input counts. All 114 workbook validation rules permit blank values.

These are row/cell occurrences before identity adjudication, not unique-child or accepted-import counts. Private source locators/reasons are retained in the restricted scratch exception register; public documents contain no person records or real identifiers. Audit flag counts overlap and are not import failure counts. No import was attempted.

## Frontend integration implications

No frontend code changed. Existing layouts can generally remain, but the backend cannot faithfully preserve incorrect assumptions: asynchronous/authenticated persistence, history-effective edits, code vocabulary, Q-to-F/year handling, maximum/decimal rules, monthly versus dated activities, missing cohort/visit periods, and the missing School Name field require explicit review. Do not silently rewrite data to fit the current demo. Real-data reset, unrestricted CSV exports, static donor scope and browser role switching cannot be carried forward as authorization.

## Next steps and approvals

1. Source/programme owners resolve D01-D09: identities, precedence/aliases, calendars/codes/metrics, years/dates/scales, activity slots, cohort and visit authenticity.
2. Responsible data/security owners resolve D10-D14: private-baseline purpose/retention, real permissions/scopes, optional extension scope, audit/concurrency and existing Supabase project review.
3. Supply the missing guidelines/original metadata (D15); review the complete dictionary, diagrams and mappings. Record decisions, then revise design as necessary.
4. Only after approval prepare SQL under supabase/migrations, an isolated synthetic test environment, schema/RLS/idempotency/reconciliation tests and a reviewed adapter. No actual migration/deployment is authorized now.

## Changes and verification

Nine requested Phase 2B documents were prepared locally; the two Phase 2A documents were preserved. No commit/push, merge, application change, new dependency, Vercel deployment/configuration change, original Google Sheet write or Supabase operation occurred. `main` remains at the verified frontend commit. The six source files and extracted rows remain outside the repository; no real dataset was added to Git.

Validation covers archive/workbook readability, 53-sheet inventory accounting, aggregate arithmetic, 23-row matrix integrity, model FK/entity/diagram consistency, source hash preservation, documentation-only Git changes and a report scan against extracted person/contact values. No application regression tests are claimed from this documentation-only phase, and no SQL/RLS tests can be claimed before implementation. Full approval and resolved source exceptions remain prerequisites to implementation.
