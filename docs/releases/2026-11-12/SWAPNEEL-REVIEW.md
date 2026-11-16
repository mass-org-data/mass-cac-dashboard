# Swapneel review — 12 November

Continues **PR #16**, reusing the centre-wide event implementation from PR #17. Source: [MASS IDS Changes from Swapneel Review](https://docs.google.com/document/d/1YtJNg6aSDowqShkMkBnrzllBhOpAiuKf8CshZ9CsTKk/edit). The source's inline comment limits the first shared-form step to **Monthly Meeting in Session Type**; the full Activity/Morarji shared form is deferred. Main and the production frontend are held.

| Item | Implementation / deliberate boundary |
| --- | --- |
| 01 | Session Type comes first. Classroom Session, Monthly Meeting and Holiday are available. MM opens the existing centre-wide event workflow, covering both shifts once. Full unified Activity/Morarji entry follows the source comment's deferral. Analysis remains separate. |
| 02 | New activity categories use the already confirmed Cultural/Sports dropdown; no free category text is introduced. Historical unknown categories remain unknown. |
| 03 | Centre, Shift and Date align in the entry grid. Single-centre Teacher forms and filters show a prefilled disabled Centre dropdown; its submitted value remains protected by server scope. |
| 04 | Holiday records one centre/shift/date calendar entry, hides individual marks and writes no per-student Holiday marks. Existing classroom marks/scheduled calendars prevent a conflicting holiday. Holiday requests retain notes, actor and retry identity. |
| 05 | Individual classroom choices are P/A. Clear and per-student H/MM buttons are removed. Save is disabled until every eligible learner has an explicit answer. The new server wrapper independently verifies the complete roster; old clients/APIs remain compatible. Audited whole-register deletion remains. |
| 06–07 | Morarji backend impact is documented below, as requested by the Grade 5 comment. No preparation-selection flag is inferred from entrance-exam outcomes. The full shared form remains deferred with item 01. Existing Morarji follow-up stays available under its existing gates. |
| 08 | Edit Student Profile includes Academic Year Profile: year, verified grade and Active/Graduated/Dropped Out. Previous-year rows are read only; Current Grade is read only. Grade changes require a verified assignment, never an automatic progression. Current-year status writes have version checks and retained revisions. Profile/name and year status save in one transaction. Historical unknown status remains unrecorded. |
| 09 | Generated student codes are removed from visible live profiles, rosters, searches, sorting controls and student exports. UUID relationships remain. The compatibility `student_id` column is retained because installed older clients, registration/ID allocation, source receipts and existing API result signatures depend on it; dropping it while the production frontend is held would break those clients. A later contract migration can remove that private compatibility dependency. |
| 10 | Source reconciliation/import is handled separately. Real source records, workbooks, names, credentials and execution payloads are not committed in this PR. |
| 11 | One visible MASS logo per layout: sidebar on desktop/collapsed desktop, header when the mobile sidebar is closed. Repeated workspace/role/breadcrumb and Live Imported Records badge are removed. Collapse and Sign out remain. |
| 12 | Donor Summary is a permanent Leadership menu item and a separate route, not an Overview toggle/dialog. The rest of the menu remains available on that page. |
| 13–16 | Consistent readable card headings, aligned values, compact chart text and a three-column demographic grid. Grade/gender/shift plots share geometry. Count axes use clean whole-number ticks. Loading, failed and unavailable data states have explicit text. Error/footnote content is escaped. |
| 17 | Displayed attendance explanation uses present divided by recorded classroom attendance. H/MM and unknowns are explained separately. Historical L remains in the approved calculation; history is never converted to make a displayed formula simpler. |
| 18 | Remove separate sort dropdowns where headers sort. Profile headers request whole-population server sorting; register headers request a sorted server page. Centre comparison retains whole-selection sorting before pagination. |
| 19 | Attendance by Centre is a sortable, paginated table: Centre, Number of Students, Attendance Rate. It has no exam-score column. |
| 20 | A separate scoped aggregate supplies observed days-present distribution without requiring an invented calendar. A zero-present bin requires recorded P/A/L evidence; completely unrecorded learners are excluded. The range can extend beyond 25 when actual monthly observations do. Axes are Students and Days Present. Complete-calendar low-attendance classifications remain separate. |
| 21 | Record a Visit is on Centre Visits, not the CO Overview. |
| 22 | Register is directly after scorecards, before the monthly line and remaining charts. Newest-first is the initial order. Ten compact records fit without a second internal vertical scroll. Saving resets register paging so the newest record is visible. |
| 23 | Sign-in stays aggregate-only. Individual Overview summary is loaded on explicit request and scoped to selected centres/month. Attendance uses aggregate/chart reads and ten-row server register pages, not annual raw attendance downloads. Filters/sorts apply before server pagination; requests show loading/error states. |
| 24 | Search focus/caret survive both input and background-response renders; clearing works. Profile sorting uses headers. Authorised profile saving uses existing staff scopes and the separately reviewable profile activation configuration. |
| 25 | A production merge/deployment is not part of this request. Verify the actual production release after a later approved merge; do not mark it complete from a preview. |
| 26–29 | Teacher-to-training-centre mapping, automatic year rollover, subject-level learning and broad informational-copy review remain explicitly post-launch / awaiting confirmation. Validation and error messages are retained. |

## Backend installation

The code includes the existing centre-wide event migration and new `20261112163945_swapneel_review_workflows.sql`. Install only missing migrations after checking hosted history. The new migration creates two private, forced-RLS academic-history/revision tables; it adds scoped paging, distribution and session/profile RPCs and advertises capabilities. It does not rewrite students, enrolments, attendance, scores or historical grades and does not enable feature flags.

`supabase/configuration/2026-11-12-profile-editing.sql` is separate. It enables only profile corrections, preserves every other hard-off control and retains the existing staff/centre/profile permissions. The earlier registration/activity configuration remains separately applicable; do not infer activation from a visible form. Do not replay previously installed metadata migrations or reset hosted history.

Every new browser-callable RPC requires a staff session and verified centre/child scope. PUBLIC, anonymous and service-role execution is revoked. Raw history/revisions are not granted to browsers. Current-year writes check the server's April–March year, expected revision and verified grade assignment. Historical years and grade identities are immutable to the editing workflow. The combined profile RPC rolls back a name/gender change if the academic-year write fails.

## Morarji preparation backend impact (items 06–07)

Preparation and entrance-exam outcomes need separate facts:

- A dated, academic-year-specific preparation membership/selection linked to the student's verified Grade 5 enrolment. Do not infer selection from Grade 5, Applied, Attended or Passed.
- A preparation session with its actual date, one event identity and explicit source-centre assignments. A combined session must not become two events just because it includes both shifts.
- P/A preparation attendance keyed by session and selected membership, with one answer per student/session and retained corrections. Non-selected Grade 5 learners remain visible but disabled.
- Phase 1 writes scoped to a verified Cluster Officer's dated assignments. Teacher writes remain disabled until teacher-to-training-centre mappings are confirmed; this mapping need not block a later CO launch.
- Existing `cohort_memberships` / `morarji_outcomes` represent entrance-exam/cohort stages and must not be reused as a preparation-selection flag. Preparation attendance must not add classroom days or imply exam selection, passing, admission or scholarship receipt.

The source comment asks to check these model changes before providing the Grade 5 selection workflow. No preparation flags, training locations, cross-centre teacher scopes or historical dates are fabricated in this PR.

## Verification

Tests use isolated synthetic data. Coverage includes unchanged-history installation and injected rollback; full-roster/foreign/anonymous/service-role denial; holiday replay without per-student marks; full-population sorting and paging; recorded-zero versus missing attendance; current-year version conflicts, prior-year denial and academic revisions; browser save/reopen/correction/delete/failure retry; disabled Teacher Centre, name-only search/caret retention and profile persistence.

Final local verification passed: syntax, lint, build, 125 frontend tests, 27 workflow checks, 208 attendance SQL assertions (including 45 new review assertions), 30 centre-event checks, 22 staff-scope checks, 1,440 calculation comparisons and 113 browser assertions. Activation rollback/provider replay also passed. Desktop/mobile screenshots were inspected using synthetic fixtures.

Read-only hosted inspection confirms the new centre-event/review RPCs are not installed and profile/activity/registration activation is still disabled. This PR contains the tested installation/configuration changes; it does not claim a live database rollout. No hosted data, grants or activation controls were changed during this review. GitHub CI and the updated protected Preview are recorded in the PR after push.
