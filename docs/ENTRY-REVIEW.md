# Teacher and Cluster Officer entry review

27 October 2026.

Added Correct / remove entries to operational views. The tool lists only assigned centres, uses a date selector for attendance and offers record-specific edit/remove actions for attendance, exams, activities, CAC sessions, student profiles, Morarji and follow-up notes. Visits are available to Cluster Officers only. Leadership has no correction/removal controls.

Removal requires confirmation and explains its scope. Missing remains unrecorded, not zero/absent. Removing an activity removes its participation; removing an erroneous profile removes linked current records. Genuine programme exits use enrolment status. The last removal can be undone before another saved change or reload, in the same role. Production implementation needs backend permission enforcement and durable audit/recovery.

Fixed missing visit editing (updates existing record, not append); session centre validation; old participation attached to changed activity groups; accidental clearing by tapping an already-selected attendance code.

Validation: node tests/entry-workflows.mjs passes 27 callback-level workflow/scope/removal/undo checks. Browser tested teacher removal confirmation/undo, marks outside maximum rejected, zero score saved with date, Cluster Officer visit creation and edit, and assigned-centre-only forms. npm run check and npm run build passed. Fictional browser-local data only; shared-backend persistence and concurrent users remain untested.
