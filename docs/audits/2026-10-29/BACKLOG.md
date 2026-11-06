# Prioritized development backlog

These are audit findings, not authorization to change schema, data or permissions. Preserve the original design in subsequent work. Parent references and field-level acceptance tests are in the register.

## P0

### AUD29-G001: Grade filter / overview population

Classification: Filter or UI logic incomplete. Owner: Engineering with MASS approval where required.

Grade 1 keeps 1,458 students; SQL has 99. children() never tests state.grade.

Required resolution: Apply one date-effective filter scope to every calculation and export.

Acceptance: Grade 1 all-centre population must be 99 under the current imported scope.

Evidence: [`src/app.js:15`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L15). Parent: FT-003.

### AUD29-G002: Student Profile grade and gender

Classification: Filter or UI logic incomplete. Owner: Engineering with MASS approval where required.

profileTable() filters centre/shift/search but ignores grade and gender.

Required resolution: Use the same authorized dated roster predicate as the displayed controls.

Acceptance: Table matches centre + grade + shift + gender + query, with unknown gender separate.

Evidence: [`src/app.js:55`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L55). Parent: F-001.

### AUD29-G004: Quarter-only assessment visibility

Classification: API/RPC missing. Owner: Engineering with MASS approval where required.

207 results exist; dated read_assessments excludes the single NULL-date Q1 result. Review replay F1 result coverage is 0, SQL quarter coverage is 1.

Required resolution: Design a scoped period-based read preserving NULL exact dates; do not fabricate a date.

Acceptance: Q1 result count 1, mean 24/25, date shown as unknown; 207 total accessible results.

Evidence: [`supabase/migrations/202610280016_frontend_reads.sql:99`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/supabase/migrations/202610280016_frontend_reads.sql#L99). Parent: CH-004.

### AUD29-G007: Historical enrolment projection

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

seenStudents deduplicates child UUID across centres/episodes; first async worker wins, losing historical assignment context.

Required resolution: Keep immutable enrolment episodes and join facts by enrolment_id.

Acceptance: A student transferred between two centres retains correct facts and population in each period.

Evidence: [`src/live/original-review.js:41`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L41). Parent: C-001.

### AUD29-G008: Attendance projection identity

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

Attendance keys child|date discard centre, shift and enrolment context.

Required resolution: Preserve original fact ID and full historical context.

Acceptance: Two valid same-day episodes cannot overwrite each other.

Evidence: [`src/live/original-review.js:58`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L58). Parent: C-002.

### AUD29-G013: Current broad runtime grants

Classification: Role/access limitation. Owner: Engineering with MASS approval where required.

276 active grants: 92 per role. One account holds Teacher+Cluster Officer across all 92; a separate Leadership account covers all 92. Assignment approval evidence is not available.

Required resolution: MASS administrator must verify actual operational assignments; do not infer permissions from the directory or preview selector.

Acceptance: Evidence ties every effective user-centre grant to approved duties. No grants changed by this audit.

Evidence: [`supabase/migrations/202610270007_auth_scope.sql:18`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/supabase/migrations/202610270007_auth_scope.sql#L18). Parent: QA-003.

### AUD29-G014: Leadership demographic and profile design

Classification: Role/access limitation. Owner: Engineering with MASS approval where required.

Leadership has no private-profile capability; read_students masks gender/name. Review now adds a Leadership child-level profile page, contrary to original aggregate-only reference.

Required resolution: Confirm Leadership privacy scope; use approved aggregate demographics instead of broad profile grants.

Acceptance: 869 Girl / 589 Boy can be reconciled by an authorized aggregate without exposing identifying rows.

Evidence: [`supabase/migrations/202610270014_core_security_audit.sql:5`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/supabase/migrations/202610270014_core_security_audit.sql#L5). Parent: D-001.

### AUD29-G015: Review authentication lifecycle

Classification: Role/access limitation. Owner: Engineering with MASS approval where required.

One initial getUser/context check; no auth-state subscription or clear-on-expiry/signout/revocation handler for the globally held programme data.

Required resolution: Clear review data at identity boundaries and revalidate scope without weakening RLS.

Acceptance: Expired/revoked/switched identity cannot retain the prior view; prove with isolated lifecycle tests and authorized hosted sessions later.

Evidence: [`src/live/original-review.js:10`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L10). Parent: QA-003.

### AUD29-G016: Stored-session cleanup consistency

Classification: Role/access limitation. Owner: Engineering with MASS approval where required.

Client defaults to localStorage; clearStoredSession defaults to sessionStorage. A failing SDK signout can leave the persistent store uncleared.

Required resolution: Use one explicit storage contract and confirm shared-device persistence policy.

Acceptance: Failure/throw on logout clears the actual configured store and records are removed from DOM/memory.

Evidence: [`src/live/client.js:17`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/client.js#L17). Parent: D-001.

### AUD29-G018: Read-only review unmapped mutation controls

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

Routing guard omits data-morarji/data-guidance/data-event; their callbacks mutate the in-memory object before persist() throws.

Required resolution: Prevent transient local mutations and make unsupported operations explicit.

Acceptance: Every mutation path either persists to the intended RPC or leaves model/storage unchanged with a clear limitation.

Evidence: [`src/app.js:129`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L129). Parent: F-012.

### AUD29-G021: Unknown activity coverage classified as low

Classification: Calculation incorrect or undefined. Owner: Engineering with MASS approval where required.

No activity data yields act=0 and unknown=0. engagementCategory can label complete observed attendance low rather than activity coverage unknown.

Required resolution: Represent collection/coverage separately from observed zero participation.

Acceptance: No event dataset produces an empty/unclassified engagement state, not a verified zero/low classification.

Evidence: [`src/app.js:37`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L37). Parent: CH-002.

### AUD29-G040: CSV export privacy and formula safety

Classification: Role/access limitation. Owner: Engineering with MASS approval where required.

Role preview controls aggregate-vs-identifying export shape. csvExport only quotes cells and does not neutralize spreadsheet formula prefixes.

Required resolution: Authorize export shape from actual role/capability and define formula-safe output/minimization.

Acceptance: Leadership export remains approved aggregate; entered text beginning =,+,-,@ cannot execute as a spreadsheet formula.

Evidence: [`src/app.js:117`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L117). Parent: QA-003.

## P1

### AUD29-G003: Search / KPI / export scope consistency

Classification: Filter or UI logic incomplete. Owner: Engineering with MASS approval where required.

Query filters summary/profile rows only; KPIs and csvExport use unsearched children().

Required resolution: Make effective scope explicit and common to values, tables and exports.

Acceptance: A no-match search cannot leave a nonzero KPI while an export claims the same scope.

Evidence: [`src/app.js:15`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L15). Parent: FT-003.

### AUD29-G005: Review assessment fixed window

Classification: Historical coverage limitation. Owner: Engineering with MASS approval where required.

Read window is hardcoded 2026-07-01..2026-11-01, including yearFrom/yearUntil.

Required resolution: Read approved academic periods independently from the attendance month.

Acceptance: April–June/Q3/Q4 and later years can be requested without hardcoded dates.

Evidence: [`src/live/original-review.js:35`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L35). Parent: CH-004.

### AUD29-G006: Review multi-year F1–F4 alias

Classification: Business decision required. Owner: Engineering with MASS approval where required.

Quarter maps to F1–F4 without retaining year; first result wins if another year/definition exists.

Required resolution: Confirm display aliases and preserve definition/academic year in keys.

Acceptance: Two years cannot overwrite or silently discard each other; comparability is explicit.

Evidence: [`src/live/original-review.js:48`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L48). Parent: D-001.

### AUD29-G009: Review active/enrolment date

Classification: Calculation incorrect or undefined. Owner: Engineering with MASS approval where required.

Active uses a fixed 2026-10-29 cutoff. children() does not require starts_on<=report date and uses >= on an exclusive exit date.

Required resolution: Use selected as-of date and half-open intervals; preserve source assumptions.

Acceptance: No pre-enrolment or end-exclusive date is counted; date changes affect the roster.

Evidence: [`src/live/original-review.js:45`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L45). Parent: C-001.

### AUD29-G010: Assumed enrolment-date presentation

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

All 1,458 imported enrolment receipts mark dates assumed; original/profile UI displays normal enrolment dates without the assumption marker.

Required resolution: Expose an approved minimized assumption indicator; keep technical receipts private.

Acceptance: Every assumed April 1 date is labelled assumed, not observed.

Evidence: [`src/live/original-review.js:45`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L45). Parent: D-001.

### AUD29-G011: Officer filter and visit officer series

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

Adapter sets officer to empty and never calls get_centre_staff; original visit chart still hardcodes Meera/Kavya.

Required resolution: Use verified staff IDs/roles/centre associations; separate directory observations from authorization.

Acceptance: Officer options and chart labels use verified scope, never fictional names.

Evidence: [`src/live/original-review.js:25`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L25). Parent: FT-005.

### AUD29-G012: Centre-dependent filter options

Classification: Filter or UI logic incomplete. Owner: Engineering with MASS approval where required.

Grade/shift/gender options come from all donor-permitted centres, not the selected centre.

Required resolution: Cascade options from the current effective population and reset invalid children.

Acceptance: Every displayed option has eligible data for the selected centre, or is explicitly an unknown/empty choice.

Evidence: [`src/app.js:24`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L24). Parent: FT-002.

### AUD29-G017: Original form-to-workspace handoff

Classification: Data-entry operation incomplete. Owner: Engineering with MASS approval where required.

Capture handler routes many original mutation controls to ?view=workspace without preserving operation/child/centre/date. A displayed original form is not a verified write.

Required resolution: Preserve original workflow design and map each supported action to its exact authorized write.

Acceptance: Save the intended record, reload from DB and prove revision/audit; unsupported actions show an explicit limitation.

Evidence: [`src/app.js:125`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L125). Parent: F-001.

### AUD29-G019: Activity session modal crash

Classification: Data-entry operation incomplete. Owner: Engineering with MASS approval where required.

Isolated Chromium reproduces ReferenceError: activityCatalogue is not defined on the original Add activity session modal.

Required resolution: Confirm actual approved catalogue and repair this control only in a later implementation phase.

Acceptance: Original modal opens with approved options; no invented catalogue.

Evidence: [`src/app.js:67`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L67). Parent: F-005.

### AUD29-G020: Activity category / delivery model

Classification: Backend table or column missing. Owner: Engineering with MASS approval where required.

activity_events has name/date/single shift but no category or Held/Planned/Cancelled status; adapter maps both to empty strings.

Required resolution: Approve category/status requirements and transaction/correction semantics before implementation.

Acceptance: Held/category-dependent charts cannot silently count every event or zero out valid participation.

Evidence: [`supabase/migrations/202610270012_named_activities.sql:3`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/supabase/migrations/202610270012_named_activities.sql#L3). Parent: SG-001.

### AUD29-G022: CAC scheduling versus delivery

Classification: Backend table or column missing. Owner: Engineering with MASS approval where required.

is_scheduled correctly no longer maps to Held/Cancelled, but the delivery chart still counts every calendar row as planned total. No delivery status/API exists.

Required resolution: Collect actual planned/held/cancelled session evidence and establish calendar authority.

Acceptance: A scheduled observation never proves held, cancelled or membership of an original delivery plan.

Evidence: [`src/app.js:43`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L43). Parent: SG-003.

### AUD29-G023: Visit module and source coverage

Classification: Backend table or column missing. Owner: Engineering with MASS approval where required.

Visit XLSX logs exist; no operational visit table/RPC exists. UI emits zero/gap/target comparisons from an empty array.

Required resolution: Review dated source identities, officer assignments, targets and privacy before designing an import/module.

Acceptance: Original visit chart/log preserved with verified data or meaningful unknown state.

Evidence: [`src/app.js:73`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L73). Parent: SG-004.

### AUD29-G024: Unconfirmed visit targets still displayed

Classification: Calculation incorrect or undefined. Owner: Engineering with MASS approval where required.

Overview still shows 92×4=368 expected visits; evening footnote and coverage logic still use two visits despite partial live-label fixes.

Required resolution: Use only a confirmed target with validity dates; otherwise show not configured.

Acceptance: No unsupported expected/covered/visit-gap label survives in any original chart or KPI.

Evidence: [`src/app.js:42`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L42). Parent: D-003.

### AUD29-G025: Morarji review mapping

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

reads.centre fetches Morarji rows, but adapter never maps rows.morarji; cohort refs and school names are ignored.

Required resolution: Preserve approved applied/attended/passed/school values and explicit cohorts.

Acceptance: Future nonempty authorized outcomes appear without inferring selection/admission/scholarship.

Evidence: [`src/live/original-review.js:39`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L39). Parent: SG-005.

### AUD29-G026: Morarji held identities and extra outcomes

Classification: Identity or source record awaiting human review. Owner: Engineering with MASS approval where required.

548 source rows lack verified centre/grade linkage. Training days/selection/admission/scholarship and pending semantics are not approved core fields.

Required resolution: Resolve identities/cohort evidence privately; separately approve additional outcome requirements.

Acceptance: No name-only matching or passed⇒admitted/scholarship inference.

Evidence: [`scripts/imports/history.py:46`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/scripts/imports/history.py#L46). Parent: SG-005.

### AUD29-G027: Career guidance, feedback and notes

Classification: Backend table or column missing. Owner: Engineering with MASS approval where required.

Original forms/controls exist, but no guidance/follow-up/challenge schema/API or verified source dataset is supplied. Grades 11–12 are outside the student grade contract.

Required resolution: Define programme cohort identity, minimal fields, permission and sensitive-note retention before implementation.

Acceptance: Source-backed participants/contact/evidence can be entered and audited without fabricating student identity or outcomes.

Evidence: [`src/app.js:79`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L79). Parent: SG-006.

### AUD29-G028: Student profile correction / Class 10 board

Classification: API/RPC missing. Owner: Engineering with MASS approval where required.

Name/gender/board columns exist but are immutable and have no correction RPC; challenge column is absent.

Required resolution: Approve correction/audit/retention contract; keep historical assignment facts immutable.

Acceptance: Correct a field with expected revision and attributable audit; do not overwrite enrolment history.

Evidence: [`src/app.js:88`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L88). Parent: F-001.

### AUD29-G029: Bulk attendance / session-participation atomicity

Classification: API/RPC missing. Owner: Engineering with MASS approval where required.

Only individual attendance/participation RPCs exist. Original bulk/default/group/session+participation saves cannot be treated as one atomic operation.

Required resolution: Specify batch eligibility, revisions, confirmation and all-or-nothing retry handling.

Acceptance: An injected late failure leaves no partially changed group.

Evidence: [`src/app.js:119`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L119). Parent: F-003.

### AUD29-G030: Absence and clearing assessment results

Classification: Backend table or column missing. Owner: Engineering with MASS approval where required.

Only numeric score rows exist. Original Recorded/Absent/Not entered and group comments cannot be represented as the same scalar update.

Required resolution: Approve separate absent/unrecorded semantics and group evidence; retain zero as a score.

Acceptance: Absent never equals 0; clearing cannot silently delete attributable history.

Evidence: [`src/app.js:59`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L59). Parent: F-004.

### AUD29-G031: Quarter-only correction UI

Classification: Data-entry operation incomplete. Owner: Engineering with MASS approval where required.

Existing result uses required readonly date input, so a NULL-date result would be uneditable even after fixing its read RPC. API date() also rejects NULL.

Required resolution: Preserve period-only evidence during numeric corrections without manufacturing a date.

Acceptance: Correct the score with NULL exact date unchanged, original period enforced and revision checked.

Evidence: [`src/live/workspace.js:181`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/workspace.js#L181). Parent: F-004.

### AUD29-G032: Delete / clear / undo contracts

Classification: API/RPC missing. Owner: Engineering with MASS approval where required.

Every backend canonical removal is blocked; original hard-delete cascades and whole-localStorage undo have no server equivalent or recovery policy.

Required resolution: Approve record-specific retire/void/restore semantics, dependencies and authorized audit evidence before implementation.

Acceptance: Each original remove/undo action has a safe explicit contract or remains visibly unsupported.

Evidence: [`src/app.js:110`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L110). Parent: F-012.

### AUD29-G033: Session holiday codes and daily defaults

Classification: Business decision required. Owner: Engineering with MASS approval where required.

Original daily form offers P/A/H and draft P. Approved backend codebook is P/A/L/WO/MM; unrecorded remains unknown.

Required resolution: Preserve layout while aligning confirmed codebook and explicit holiday authority; never map H by assumption.

Acceptance: Unknown marks remain unknown until an explicit confirmed save; L/WO/MM meanings preserved.

Evidence: [`src/app.js:45`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L45). Parent: D-002.

### AUD29-G034: Incomplete-calendar attendance bands/dropout

Classification: Calculation incorrect or undefined. Owner: Engineering with MASS approval where required.

Live stats use a centre-wide union of observed dates, not a verified expected-day/shift/held-session calendar. Missing unobserved days cannot be identified.

Required resolution: Keep recorded P/(P+A+L) separate from completeness and monthly classifications.

Acceptance: No unsupported complete/low/dropout assertion when calendar authority or eligible sessions are absent.

Evidence: [`src/app.js:20`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L20). Parent: C-003.

### AUD29-G035: Decimal score band consistency

Classification: Calculation incorrect or undefined. Owner: Engineering with MASS approval where required.

DB numeric permits decimals. Original chart bins exclude (8,9), (15,16), (20,21) while examBand uses contiguous <= boundaries; UI accepts integers only.

Required resolution: Confirm precision and common boundary semantics without rescaling historical values.

Acceptance: Every valid numeric score falls in exactly one approved bucket or is explicitly unbanded.

Evidence: [`src/app.js:46`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L46). Parent: D-001.

### AUD29-G036: Historical donor attribution

Classification: Historical coverage limitation. Owner: Engineering with MASS approval where required.

Current centres.donor_id is applied retrospectively; no effective funding/association history or donor account policy exists.

Required resolution: Report current verified association only until historical attribution and external access are approved.

Acceptance: Donor/date changes never invent past funding or expose child details.

Evidence: [`supabase/migrations/202610280017_donor_staff_directory.sql:18`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/supabase/migrations/202610280017_donor_staff_directory.sql#L18). Parent: SG-008.

### AUD29-G037: Human-readable student ID projection/search/export

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

studentId is populated but original tables/search/CSV use UUID id. Under named staff profiles, searching the generated ST_ ID is not reliably supported.

Required resolution: Use permanent display ID for presentation/search while UUID remains the identity key.

Acceptance: ST_ search, detail, table and export consistently identify the same child without UUID substitution.

Evidence: [`src/live/original-review.js:44`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/original-review.js#L44). Parent: F-001.

### AUD29-G038: Large-scope workspace coverage

Classification: Filter or UI logic incomplete. Owner: Engineering with MASS approval where required.

Workspace defaults to one centre and rejects >10; does not begin with all 92 authorized centres in aggregate. Review path eagerly loads seven modules per centre.

Required resolution: Provide approved scoped aggregate loading and bounded detail retrieval without changing original visuals.

Acceptance: All permitted centres represented initially; large selections fail explicitly, never silently drop centres.

Evidence: [`src/live/workspace.js:62`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/workspace.js#L62). Parent: FT-001.

### AUD29-G039: Reference/quarter availability

Classification: Source data missing. Owner: Engineering with MASS approval where required.

Only Q1/Q2 definitions exist; Q3/Q4 are absent, not zero-result rounds. No source-backed records for those periods yet.

Required resolution: Distinguish configured periods from recorded observations; configure only under separate approval.

Acceptance: Unconfigured quarter is explicit; no future marks or dates invented.

Evidence: [`src/live/workspace.js:33`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/live/workspace.js#L33). Parent: CH-004.

### AUD29-G041: Zero/empty-state fidelity and stale labels

Classification: Frontend mapping incomplete. Owner: Engineering with MASS approval where required.

Current review footer/guide still claim fictional sample records and six centres. Several unsupported sections render 0 instead of unavailable.

Required resolution: Retain original visuals with truthful source/coverage/empty-state labels.

Acceptance: No source data unavailable is presented as a confirmed zero; no sample labels appear on live records.

Evidence: [`src/app.js:81`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/src/app.js#L81). Parent: D-001.

### AUD29-G042: Held-source reconciliation granularity

Classification: Identity or source record awaiting human review. Owner: Engineering with MASS approval where required.

1,177 student rows; 889 attendance cells; 1,591 assessment rows; 548 Morarji rows are held. 9,525 technical exception records are not 9,525 children.

Required resolution: Maintain field/observation/person units, reviewed dispositions and exact source references.

Acceptance: Held sources are neither silently dropped nor imported; operational identities do not automatically close all old field-level exceptions.

Evidence: [`docs/STUDENT-HISTORICAL-IMPORT-HANDOFF.md:53`](https://github.com/mass-org-data/mass-cac-dashboard/blob/61893eb6d3d9dfe4fc9936a63ac87b578dd5ce3d/docs/STUDENT-HISTORICAL-IMPORT-HANDOFF.md#L53). Parent: SG-009.

## P2

After P0/P1 acceptance: large-scope performance profiling, accessibility/visual regression depth and audit tooling ergonomics. These do not replace missing functional requirements.

## AUD29-G043 — P0 source omission

Morarji per-sheet header offsets skipped two physical source rows before staging. Source total550; staged548. Correct first-data-row coverage and provenance under separate import authorization, without guessing identities or outcomes. No source or operational data changed during this audit.
