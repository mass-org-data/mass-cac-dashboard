# Attendance register and popup workflow

The Attendance screen now opens with a saved centre × shift × date register and the existing attendance charts. Teachers, Cluster Officers and Leadership can view their authorized reporting scope. Teachers and Cluster Officers with existing write grants can open Add Attendance or Edit attendance. Leadership remains read-only, including accounts with mixed Leadership and operational roles.

The table shows Centre, Shift, Date, No. of students present, % students present and Action. Reporting month, centre, shift, grade and gender filters apply to saved summaries. P/(P+A+L)×100 remains the approved rate. WO and MM are excluded, and blank marks remain unknown. An editor always opens the complete selected centre/shift/date register; a filtered chart selection cannot silently narrow a deletion.

Marking, bulk marking and clearing a new draft stay in browser memory. Save Attendance sends only explicit changes through one atomic transaction. It does not automatically mark unrecorded students present or absent. Existing saved marks can be corrected with a reason. Cancel discards the draft after a discard confirmation. While saving, form inputs and dismissal are locked. An uncertain network result is never automatically retried; request identities also protect against duplicate transactions.

Each editor loads an opaque version token covering the entire saved register. Save and Delete reject stale tokens. Request IDs make exact repeated requests idempotent. Successful writes invalidate summary and reviewed-chart caches, reload authorized data and redraw charts/table. If a write succeeds but the following refresh fails, the popup states that it was saved and requires a reload rather than submitting again.

The red Delete Attendance panel requires a reason and typing DELETE. It removes exactly the selected centre, shift and date. Original attendance rows, actor, reason and timestamp remain in immutable, private `mass_core.attendance_register_actions`. Corrections also retain the previous register snapshot, alongside the existing per-record audit revisions. No client role can read or modify that private history table. Attendance's specialized deletion guard requires an exact matching receipt in the same transaction. The existing shared guard and all other table protections remain unchanged. No general-purpose record removal endpoint or client DELETE privilege is added.

## Installation and hosted verification

- Source migration: `supabase/migrations/20261109063107_attendance_register_workflow.sql`.
- Hosted migration receipt: `20261109064810`, name `attendance_register_workflow`, project `pbkwpfdpdtelmvbkzgvx`.
- The migration installs two private, forced-RLS tables and five scoped RPCs. Writes default to disabled. The additive API names are classified by the existing sealed installer without relaxing legacy feature gates.
- After installation and a disabled-gate read/denial probe, the dedicated register control was enabled under `MASS-20261109-user-approved-popup-register-save-correct-delete`.
- The existing attendance_corrections feature remains false. Assessment, visit, profile, transfer and other write controls are unchanged.
- Hosted pre/post fingerprints match for all 47,325 attendance records, all staff grants, all existing API definitions and the shared record guard. No student/attendance/test observation was inserted, corrected or deleted on the hosted database by this implementation.
- PR #7's separate query-support index migration remains a separate installation item; this release does not silently install it.

## Verification

- 92 frontend tests and 27 existing demo/workflow checks pass.
- 45 dedicated SQL assertions cover initial/bulk save, atomic failure, corrections and revisions, stale edits/deletes, exact request replay, anonymous/service/foreign/expired/Leadership/mixed-role denial, masked CO names, CO save/delete, private audit retention and both disabled write controls. The installer is also tested with an injected failure, rollback and exact retry.
- Existing core, visit/delivery and definer-security SQL suites pass, with 1,440 independent SQL/frontend calculation comparisons.
- 18 browser assertions exercise the actual original-interface application through a local RPC bridge to isolated PostgreSQL 17: draft-only marking, Save, immediate table and KPI updates, correction, persistence after reload, cancellation, deletion, masked CO view, read-only Leadership and mobile layout.
- Lint, syntax, production build, Python browser-fixture syntax and diff whitespace checks pass. Original approved stylesheet and image hashes are unchanged; popup styling is scoped in `src/attendance.css`.
- Native Docker/PostgREST browser release suite could not be rerun in this executor because Docker is absent. Its Attendance assertions were updated, and the new browser bridge suite provides executable isolated SQL coverage without Docker.
- Synthetic browser Auth does not certify managed hosted sign-in or a real hosted save. Hosted management checks are read-only for programme observations. Staff should verify the Preview with their existing accounts before this frontend is merged to main.

## Reproduction

`npm test`, `npm run lint`, `npm run check`, `npm run build`, `npm run test:sql:portable`, `npm run test:attendance`.

With Playwright/Chromium available: `npm run test:attendance:browser`. Optional test-only variables: `MASS_PLAYWRIGHT_MODULE`, `MASS_CHROMIUM_EXECUTABLE`, `MASS_CHROMIUM_MODULE`, `MASS_ATTENDANCE_SCREENSHOTS`. All fixtures use an isolated local database and signed-in identity stubs, never production credentials.

## Follow-up: ratios, clear, names and deletion confirmation

The present count now displays present/enrolled for the selected date, grade and gender (for example 1/17). The percentage includes its exact approved P/(P+A+L) fraction, for example 5.9% (1/17). If unmarked students remain, the count still uses the enrolled roster while the rate uses recorded P/A/L only; incomplete attendance is explicitly labelled. Confirmed MM/WO marks do not falsely make coverage incomplete.

Clear is now available for saved marks. It changes only the local draft until Save Attendance, then removes that individual observation through the atomic register API. The previous row is retained in the immutable action snapshot; missing is never changed into absence. A clear mixed with an invalid mark rolls back the entire transaction. Direct client DELETE and unrelated write operations remain blocked.

Names and IDs are both returned in the writable attendance roster for authorized Teachers/Cluster Officers. This explicitly approved operational name access is limited to the attendance endpoint: broader profile permissions, ordinary student reads, role grants and Leadership restrictions are unchanged. If a source name is absent the form says Name not recorded and retains the student ID.

The previous Delete Attendance button opened a second confirmation requiring a typed DELETE and final footer submission. It now reveals a checkbox and a visible Confirm deletion button in the red panel, with the correction/deletion reason retained. The save footer is hidden while deletion is being confirmed.

Source migration: `20261109070814_attendance_register_clear_names_totals.sql`; hosted receipt `20261109072249`. It installs a backward-compatible v2 summary endpoint and updates the scoped save/name contracts. All 47,325 live attendance rows and staff-grant fingerprints are preserved. Real hosted delete and individual-clear paths were additionally exercised inside transactions that were explicitly rolled back; postflight fingerprint matches and no action receipts or attendance changes persisted.

Validation: 93 frontend tests, 27 workflow checks, 52 register SQL checks, existing SQL/security suites, 1,440 independent calculation comparisons, and 22 browser assertions. Browser coverage includes saved-clear draft isolation and persistence, both roster names and IDs, ratios, correction/deletion, and mobile layout. Managed signed-in Preview testing still belongs to staff review.
