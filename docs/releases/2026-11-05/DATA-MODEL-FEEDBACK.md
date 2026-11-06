# MASS CAC — response to Swapneel’s data-model feedback

Original document: https://docs.google.com/document/d/12Iwcm975CwZA7CLEMm9c7ACRruZLNkZDPhRYfygf5iw/edit

MASS CAC — point-by-point response to Swapneel
Reviewed 5 November 2026 against the existing GitHub implementation and hosted Supabase project pbkwpfdpdtelmvbkzgvx.

Cleanup prerequisite verified: the five authorized 5 November test entries are absent; attendance is 47,323 rows; all five immutable cleanup receipts and original insertion audits remain; the original deletion guard hash is unchanged. No RLS, programme calculation or existing testing permission was weakened.

The SAME Drive model file has been updated: 35 tables, 249 columns, seven pages, no arrows, plain table labels, actual PostgreSQL types and exact FK mappings. This is the physical schema; installed tables do not imply every write gate is enabled.
Model: https://drive.google.com/file/d/1OQv7zA0IUbniuCFac2HZcw97Ob73qYCP/view?usp=sharing


## 1. Schema prefixes

**Original feedback**

> Each table name starts with `mass_core.`. If that's the schema name, then no problem, but don't have that as a prefix in front of every table name.

**Explanation / answer:** mass_core is a real PostgreSQL schema; the table itself is named children, not mass_core.children. The schemas separate programme data, import/audit records and private controls, with different grants and RLS boundaries.

**Change implemented:** The model places the schema in page headings and table footers; plain table names appear in headers.

**Status:** Already Supported

**Unresolved reason / recommended alternative:** None. Renaming schemas would disrupt qualified SQL/RPC contracts without simplifying the staff interface.

**Implementation evidence:** supabase/migrations/202610270007_auth_scope.sql; scripts/schema/render_review_model.py

## 2. Relationship arrows

**Original feedback**

> Overall, the arrows don't seem to be helping in any way, so just delete them.

**Explanation / answer:** The previous arrows were intended to show foreign-key relationships, but table-level endpoints could misleadingly appear to connect an enrolment key to a revision column. That is a diagram defect, not the actual FK.

**Change implemented:** Removed every arrow from the supplied Drive drawing. Per-table footers now show the exact referenced columns, including complete composite FKs.

**Status:** Done

**Unresolved reason / recommended alternative:** None. The actual database FK constraints remain enforced.

**Implementation evidence:** Live PostgreSQL catalog; scripts/schema/render_review_model.py

## 3. Why row_version exists

**Original feedback**

> All tables seem to have a row_version column. What are you using that for?

**Explanation / answer:** row_version is an optimistic-concurrency counter. The form submits the revision it loaded; an outdated correction raises PT409/HTTP 409 instead of overwriting another staff member's edit. It also identifies revisions in audit/history. Not every table has it: immutable/reference tables differ.

**Change implemented:** Retained the concurrency controls and showed only columns actually present in the live catalog.

**Status:** Already Supported

**Unresolved reason / recommended alternative:** Removing this field would remove existing stale-edit protection; it is not unnecessary duplication.

**Implementation evidence:** supabase/migrations/202610270014_core_security_audit.sql; src/live/api.js

## 4. Foreign-key naming

**Original feedback**

> To avoid confusion, name the foreign‑key column to match the referenced table. In the example, the event ID column refers to the **activity_event** table, so it should be called **activity_event_id**. Alternatively, rename the table from **activity_events** to **events**. Consistently using the table name and column name makes it clear which table is being referenced.

**Explanation / answer:** The naming recommendation is valid for readability. Existing event_id points to activity_events, definition_id to assessment_definitions, period_id to assessment_periods, and membership_id to cohort_memberships. Those names are already used by installed composite FKs, RPC arguments and adapters.

**Change implemented:** Added explicit source-column and referenced-table/column mappings to every relevant table in the same diagram. Kept existing physical names and API argument names.

**Status:** Done

**Unresolved reason / recommended alternative:** Physical renaming is not recommended during completion of the working app. If later required, use a versioned compatibility adapter and staged migration; new future columns should use clear entity-specific names.

**Implementation evidence:** supabase/migrations/202610270011_assessments.sql; supabase/migrations/202610270012_named_activities.sql; src/live/api.js

## 5. Why children and private profiles are separate

**Original feedback**

> Why is there a children table when the child profiles table has all the details about a child, like name, gender, etc.?

**Explanation / answer:** children provides stable identity and the permanent student ID across multiple historical enrolments. private_child_profiles stores personal fields such as name and gender under separate profile-read permissions. This lets approved programme reporting work without exposing personal fields to every reporting role. The one-child profile relationship does not create a second competing identity.

**Change implemented:** Retained the identity/privacy separation and made both tables and their actual keys visible in the model.

**Status:** Already Supported

**Unresolved reason / recommended alternative:** Merging these tables would require reworking RLS, profile masking, joins and public-facing RPC projections. It would not be a cosmetic simplification.

**Implementation evidence:** supabase/migrations/202610270008_identity_history.sql; supabase/migrations/202610270014_core_security_audit.sql

## 6. Enrolment start and end dates

**Original feedback**

> What are the `starts on` and `ends before` columns being used for? If it's to track the date on which the student was enrolled and the date on which the student exited, then maybe call these columns `start date` and `end date`. Wherever you have used `ends before`, that can be a little misleading because the user will think: do I have to enter the date on which this enrollment is going to end, or will I have to mentally add one date and then put it? Instead of doing it like that, just call these columns `start date` and `end date`, and the user should put the exact start date and end date.

**Explanation / answer:** starts_on is inclusive; ends_before is the first inactive date, excluded from the old assignment. For example, 1 April to 1 May includes 30 April. The same half-open interval convention prevents overlapping transfers and represents the approved April–March academic year. Renaming ends_before to an inclusive end_date without conversion would change historical populations and attendance/assessment eligibility.

**Change implemented:** Changed the live form labels to Start date and First inactive date and explained that no day is added or subtracted. Field keys, stored dates, APIs and filters are unchanged.

**Status:** Needs Decision

**Unresolved reason / recommended alternative:** MASS must confirm only if it wants an End date input to mean the LAST ACTIVE day rather than the FIRST INACTIVE day. The former would need an explicit UI boundary conversion; no historical stored date should be rewritten merely to rename it.

**Implementation evidence:** src/live/original-actions.js; src/live/model.js activeOn; supabase/migrations/202610270008_identity_history.sql

## 7. Attendance codes table versus enum

**Original feedback**

> I don't think you really need an attendance codes table to capture present, absent, and absent values. You might just be able to handle that using enums on Supabase. That would save you one table here.
> Also, let's check that this arrow is starting from enrollment ID and ending on the row version column, and hence not making sense. We either use arrows deliberately or just delete them.

**Explanation / answer:** An enum is a reasonable alternative for a new design. The existing small lookup is already used by attendance FKs, code meanings and references returned to the frontend. It records the approved P/A/L/MM/WO vocabulary. Saving one tiny table does not justify a live type/API migration.

**Change implemented:** Kept the lookup, all five approved codes and P/(P+A+L) unchanged. The incorrect diagram arrows were removed.

**Status:** Not Recommended

**Unresolved reason / recommended alternative:** Do not convert the live field to an enum solely to reduce table count. Any future vocabulary change must preserve meanings and the approved denominator.

**Implementation evidence:** supabase/migrations/202610270010_attendance.sql; src/live/api.js

## 8. Scheduled, cancelled and delivered sessions

**Original feedback**

> For sessions, how are you using the "is scheduled" field, a boolean field? If you are tracking whether the session is scheduled and then delivered, you ideally need a dropdown status field that tracks whether the session was only scheduled, was cancelled, or was actually delivered. You need to track three different statuses, and a boolean field won't serve that need here.

**Explanation / answer:** is_scheduled records the confirmed calendar/holiday classification; it is not delivery status. Migration 022 is installed and separately stores cac_delivery_records.status as Planned/Held/Cancelled. activity_events also has delivery_status. Existing frontend session/activity forms already provide a status dropdown. There are currently zero calendar rows and zero delivery rows, so actual delivery cannot be inferred from attendance or a missing record.

**Change implemented:** Added the installed delivery tables/fields to the same drawing. Session/activity forms now show Planned, Delivered and Cancelled; Delivered maps to the existing Held value. Help text distinguishes delivery from confirmed holidays. Write activation controls remain unchanged.

**Status:** Already Supported

**Unresolved reason / recommended alternative:** Data entry is still controlled by the existing activities gate. Schema/form support is already present; no historical sessions were manufactured and no cancelled day was reclassified as a holiday.

**Implementation evidence:** supabase/migrations/202610290022_activity_delivery.sql; src/live/original-actions.js session-entry/new-activity; live catalog/counts

## 9. Merge assessment_definitions and assessment_periods

**Original feedback**

> On the `assessment_definitions` table, you can just merge it with the `assessment_periods` table because the only column that you are really tracking on the definitions table is `max score`. Since you are basically just tracking one `max score` per assessment period, you might as well just do it on the `assessment_periods` table. You can merge these two tables.

**Explanation / answer:** There is currently one definition per period, enforced by UNIQUE(period_id), and max_score is fixed at 25. Four periods and four definitions are configured; 207 existing results reference definition IDs. The separate definition identity also leaves room for a future reviewed instrument/component structure without changing the academic quarter identity.

**Change implemented:** Retained the four quarterly definitions, maximum 25 and all result IDs. The diagram now shows exact FK targets and types.

**Status:** Not Recommended

**Unresolved reason / recommended alternative:** The simplification is reasonable in a new model but would require mapping definition IDs, updating result FKs, RPCs, forms and import receipts. If approved later, expose a combined read projection first rather than merging live tables now.

**Implementation evidence:** supabase/migrations/202610270011_assessments.sql; supabase/configuration/2026-four-quarter-definitions.sql; live assessment counts

## 10. Repeated child, centre, shift and enrolment on results

**Original feedback**

> Why are you tracking the shift_code on the assessment results table? You only need to track the student. There's no need to record all three IDs, child ID, center ID, and enrollment ID. Tracking just the enrollment ID is sufficient, as it identifies the child. You may still want to record the center ID separately to know which center the child was enrolled in when the assessment was conducted.

**Explanation / answer:** Enrolment ID is logically sufficient to find the child and historical centre/shift. The implementation deliberately stores all four fields under one composite FK, so they cannot disagree. This supports direct centre-scoped RLS and historical shift filtering without interpreting a child's current assignment as the assessment context.

**Change implemented:** Retained the enforced composite relationship and displayed its complete columns together in the drawing.

**Status:** Not Recommended

**Unresolved reason / recommended alternative:** Removing individual context columns would require a reviewed RLS/query/foreign-key migration. Do not remove the shift field or leave an incomplete composite FK. This is enforced redundancy, not independently editable duplicate context.

**Implementation evidence:** supabase/migrations/202610270011_assessments.sql; supabase/migrations/202610270014_core_security_audit.sql

## 11. Subject, topic, skill and competency scores

**Original feedback**

> We’re only saving each student’s final score on an assessment; we aren’t recording the subject, topic, or the specific skills and competencies being assessed. Without that information, the data become far less actionable. You’ll know which students are performing well, or poorly, but you won’t know in which subjects they excel or struggle.
>
> Consider what level of granularity you need for tracking assessment scores. Aashini Goyalplease check

**Explanation / answer:** This feedback identifies a real functional gap. The live database and frontend record one overall quarterly score per student/definition, not subject/item/skill breakdowns. Four quarterly exams and maximum score 25 are approved; the actual assessment instrument, component maxima, weights and skill mapping have not been supplied. Overall totals cannot reveal subject strengths.

**Change implemented:** Documented a compatible additive alternative: assessment_components linked to the existing definition, plus component_results linked to the existing assessment result and component. These are design candidates only, not fabricated live tables or scores. Keep the approved overall score and all 24 chart contracts.

**Status:** Needs Decision

**Unresolved reason / recommended alternative:** MASS/Aashini must supply the paper/instrument, required subject/topic/skill hierarchy, component maxima/weights, absence/not-assessed treatment and whether components sum to the approved total or are separate diagnostics. Do not invent subjects or recalculate totals before that confirmation.

**Implementation evidence:** supabase/migrations/202610270011_assessments.sql; src/live/api.js recordAssessment; existing assessment forms and live catalog

## 12. Morarji outcome progression

**Original feedback**

> On the MORAJ outcomes table, using three columns, **applied**, **attended**, and **passed**, to track status is problematic because the statuses are interdependent. A student cannot attend the exam without first applying, and they cannot pass it without attending.
>
> If you create three Boolean columns, you could mark **attended** as true while **applied** remains false, which is misleading. How could a student attend the scholarship exam without having applied?
>
> Instead, use a single status field that progresses through the stages:
> applied
> attended
> passed (or failed)
>
> This single field accurately reflects the student's journey.

**Explanation / answer:** The concern is valid: independently nullable applied/attended/passed flags can express contradictory confirmed facts. They originally preserved independently incomplete source outcomes; NULL means unverified, not No. A single stage can improve entry but cannot safely reconstruct missing earlier stages or distinguish failed, absent and result pending without a reviewed mapping. There are currently zero stored outcomes.

**Change implemented:** Added shared form/API-client validation: Attended=Yes with Applied=No is rejected; Passed=Yes with Applied=No or Attended=No is rejected. Unknown values are retained without inference. Tests cover all 27 combinations and ensure contradictory input makes no RPC call. The selected-cohort membership fix remains intact; hosted Morarji writes remain disabled.

**Status:** Needs Decision

**Unresolved reason / recommended alternative:** MASS must approve the complete stage vocabulary and transitions, including not applied, did not attend, attended/result pending, failed and passed, and the relationship to selection/admission/scholarship. Client validation is not represented as a database constraint; server enforcement must be reviewed before this workflow is activated.

**Implementation evidence:** src/live/morarji.js; src/live/api.js; src/live/original-actions.js; tests/frontend/morarji-facts.test.mjs

## 13. Source provenance and model complexity

**Original feedback**

> The source‑provenance section should be evaluated for necessity. It proved valuable on a project like ProjectKHEL, which involved 50–60 different data sources shared with us. In that case we needed to trace data back to the original sheet from which it was migrated.
>
> If Mass does not have many Google Sheets, we should avoid creating numerous tables merely to track data migration. At most, we might record only:
> - file name
> - sheet name
> - row number
> - column name
>
> These four fields would indicate where the data was originally migrated from.
>
> This is also a temporary use case. Once MASS fully adopts the system, the tables will become redundant and should eventually be removed.

**Explanation / answer:** The hosted provenance is actively referenced: four imported source files, 37 source sheets and 51,904 private target receipts. The broader discovery audit and the currently imported subset are different inventories. The tables implement import retry identity, source/target reconciliation, quarantined exceptions and immutable fingerprints; file/sheet/row/column labels alone cannot replace these guarantees. Ongoing audit history is also distinct from migration provenance.

**Change implemented:** Separated import/audit and private operational controls onto their own model pages. Staff-facing programme pages no longer mix them into the main flow. Retained every existing source receipt and audit row.

**Status:** Not Recommended

**Unresolved reason / recommended alternative:** Do not delete linked provenance simply because future entry moves into the app. A later archive needs an explicit retention/dependency/recovery review. This is a future governance decision, not a blocker to completing ordinary frontend entry.

**Implementation evidence:** mass_foundation and mass_import live catalog/counts; supabase/migrations/202610280018_controlled_student_import.sql; supabase/migrations/202610280019_import_history_integrity.sql

Decisions genuinely needed from MASS
1. Assessment instrument: subjects/topics/skills, component maxima/weights, missing/absence treatment and relationship to the approved 25-mark overall score.
2. Enrolment date wording, only if an End date input is required: last active day or first inactive day? The clarified current form uses first inactive day and changes no stored date.
3. Morarji: complete stage vocabulary and permitted transitions; treatment of unknown earlier facts; distinction between exam result and selection/admission/scholarship.
4. Only for a future archive project: retention/dependency/recovery approval for provenance. There is no need to decide a retention period to continue ordinary application development.

Verification and boundaries
86 frontend tests and 27 existing workflow checks pass, including all 27 nullable Morarji combinations and the original selected-cohort regression. Build passes. The Drive model was read back and matched byte-for-byte. Database review is read-only in this feedback follow-up; the prior attendance cleanup is separately audited. No live table merge, column/type rename, new score dimensions, historical date change, write-gate activation, main merge or Production deployment was performed. The client checks do not substitute for server validation before Morarji activation. A successful post-cleanup browser sign-in/chart regression remains pending and is not claimed here.
