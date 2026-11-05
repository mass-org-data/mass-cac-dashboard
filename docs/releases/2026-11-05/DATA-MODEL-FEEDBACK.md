# Response to MASS data-model feedback

Source: [Feedback on Data Model](https://docs.google.com/document/d/12Iwcm975CwZA7CLEMm9c7ACRruZLNkZDPhRYfygf5iw/edit?usp=sharing),
by Swapneel, read 5 November 2026. Compared against the fresh hosted catalog and
the existing frontend/RPC/migration contracts. This is a response and change log;
it does not authorize a new database design or reinterpret missing source data.

## Changes completed

The existing editable model was updated from the live catalog: **35 tables,
249 columns, seven pages, zero arrows**. Every table has a plain table-name
header, column names on the left and actual PostgreSQL types with PK/FK markers
on the right. The schema is stated separately; composite foreign keys are
explained in each table's footer. Installed officer/visit/revision and delivery
tables now appear as installed. Private controls and the one-use attendance
cleanup receipt table are separated from programme data.

The model is a physical inventory, not a claim that every write workflow is
activated. It contains metadata only. No student, staff or source row values are
included. `scripts/schema/render_review_model.py` reproduces this format from a
read-only catalog export without connecting to a database.

## Responses and implementation decisions

| Feedback | Verified current behaviour and response | Action |
| --- | --- | --- |
| `mass_core.` prefixes | `mass_core` is an actual PostgreSQL schema, not part of each table's name. For example the name is `children`, qualified as `mass_core.children`. Private schemas have different access boundaries. | Keep schemas; drawing shows schema separately. |
| Confusing arrows | The old drawing could imply the wrong column-to-column relationship. | All arrows removed. Exact FK targets and composite column lists appear in table footers. |
| `row_version` | This is a server-managed optimistic revision, not a student's version, date or duplicate ID. A form submits the revision it loaded; a stale update returns `PT409` rather than silently overwriting a newer edit. Revision history and audits use the same number. It is not present on every immutable/reference table. | Retain on mutable records. Actual presence is shown in the live model. |
| Clearer foreign-key names | The naming suggestion is sound: a new field should identify its referenced entity, e.g. `activity_event_id`. Existing `event_id` references `activity_events`; `definition_id` references `assessment_definitions`; `period_id` references `assessment_periods`. These are used by installed FKs, RPCs and adapters. | Clarify exact targets now. Defer physical renaming to a separately tested compatibility migration; no cosmetic rename of working live contracts. |
| Separate `children` and `private_child_profiles` | `children` holds durable person identity and permanent student ID. Profiles hold restricted personal attributes such as name and gender. A person can have several historical enrolments without receiving several identities. Profile RLS can mask personal fields while allowing approved programme reporting. Leadership profile access is deliberately restricted. | Retain the privacy separation. This is not two competing master records. |
| Start/end dates | `starts_on` is inclusive; `ends_before` is exclusive. `[1 April, 1 May)` includes 30 April and avoids overlapping transfers. Academic-year end 1 April 2027 represents an April–March year, not an extra reporting day. Silently renaming this to an inclusive `end_date` would change history and filter results. | Keep stored semantics. Recommended user-facing labels are “Start date” and “First inactive date” until MASS confirms whether an “End date” input means the last active day or first inactive day. Do not add/subtract a day without that decision. |
| Attendance-code lookup versus enum | An enum is viable for a new design. The existing lookup contains the approved code meanings and is referenced by FK/API validation. Replacing it saves one very small table but changes types/contracts and future vocabulary migration. P/A/L/MM/WO and the approved denominator must stay unchanged. | Retain the working lookup. No benefit justifies an immediate live type migration. |
| Scheduled versus delivered session | The Boolean `cac_sessions.is_scheduled` records confirmed calendar applicability/holidays. It does not claim a session was delivered. Installed migration 022 separately provides `cac_delivery_records.status` with `Planned`, `Held`, `Cancelled`; activity events also have `delivery_status`. Missing delivery data stays unknown. | This distinction is already implemented in storage. Drawing now includes it. Entry activation and real source coverage remain separate work; no historical Held/Cancelled values were guessed. |
| Merge assessment definition into period | The current model is one definition per period, with max score fixed at 25. Merging is technically reasonable in a simpler new model, but results currently reference definition IDs; historical import receipts, RPCs and forms use those IDs. Four quarters and all original scores are already configured/preserved. | Retain current identifiers while the working app is completed. A future simplification needs an explicit ID mapping, compatibility API and regression migration. It is not needed to make quarterly scoring work. |
| Repeated child/centre/shift on results | A composite FK enforces that `(enrolment_id, child_id, centre_id, shift_code)` matches one historical enrolment. Those values cannot disagree. The stored centre supports direct per-centre RLS and scoped reporting; the shift identifies the observed historical context, not the child's current assignment. Enrolment ID alone is logically sufficient if all consumers join the episode correctly. | Keep the enforced historical/security contract for now; do not remove columns piecemeal. Document the deliberate redundancy. |
| Subject/topic/competency assessment detail | The live source currently supports quarterly overall scores, maximum 25. Subject or competency breakdown would be more actionable, but the assessment instrument, domains, item weights/maxima and relationship to the approved total have not been supplied. | Requires MASS/Aashini's actual instrument and scoring definition. No invented subjects, weights, competency thresholds or replacement total. A future additive detail model can coexist with the approved overall score. |
| One Morarji status versus three flags | The concern is valid: the current nullable flags do not enforce `passed → attended → applied`. NULL is unverified, not false. A single stage needs explicit definitions for not applied, applied, did not attend, attended/result pending, failed and passed, and must preserve independently missing historical facts. Passed/failed also must not be confused with selected/admitted/scholarship outcomes. | Confirm the stage vocabulary and allowed transitions before migrating. Prefer a clear status control backed by an audited mapping; retain original facts/history and reject contradictions, rather than guessing earlier stages. Existing cohort-specific follow-up fix remains intact. |
| Simplify source provenance | Source provenance currently supports import idempotency, duplicate/name reconciliation, held exceptions, immutable source fingerprints and target receipts. It is linked to real imported records and their audit trail. File/sheet/row/column labels alone do not preserve those guarantees. Migration provenance and ongoing application audit are different concerns. | Keep the private technical relations out of ordinary staff forms and the main programme pages of the drawing. Do not delete them merely because future entry moves into the app. A later retention/archive decision requires dependency and recovery review. |

## Boundaries preserved

No live table/column rename, enum conversion, table merge, date reinterpretation,
profile-permission expansion, assessment-rule change or provenance deletion was
performed in response to this review. The existing frontend, 24 chart contracts
and calculations are preserved. The only hosted mutation in this follow-up was
the separately user-authorized five-record attendance cleanup described in
[ATTENDANCE-TEST-CLEANUP.md](ATTENDANCE-TEST-CLEANUP.md).

The original feedback document was read without modification or comments. No
message or task was sent to Aashini or another recipient.
