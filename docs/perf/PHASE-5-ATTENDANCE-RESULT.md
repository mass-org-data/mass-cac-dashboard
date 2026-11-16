# Phase 5 (Attendance): live verification on preview

Date: 14 November 2026. Project: preview (`nilzfsahxoxibvrwsqkd`), synthetic data only. Browser: Playwright Chromium, `dist/` served locally with the production CSP headers.

## Preview database changes (approved by the owner)
1. Migration `20261112052348_feedback_register_reporting.sql` applied (adds `assessment_register_summary`, `attendance_register_summary_v4`, `student_profile_page_v2`).
2. `get_attendance_register_capabilities` re-applied from `20261112163945` straight after (the older body had replaced it).
3. `mass_core.attendance_register_control.enabled = true` with an approval reference. Rollback: set `enabled=false`.

Verified afterwards: 3 new functions exist, register entry enabled, capabilities advertise `session_entry` and `register_paging`.

## Real-browser results: `node scripts/perf/attendance-live.mjs` (23 of 23 checks passed)
- Leadership: register loads, 10 rows per page, next page differs, no Add Attendance button, no 375 px horizontal scroll, no failed RPC calls, no console errors.
- Teacher (Centre 01): Save disabled until every student is marked; new register saved; appears in the table; correction without reason refused, then saved with reason; deletion refused without the confirmation tick, then deleted and removed from the table; holiday saved and shown as "Recorded holiday".
- Cluster Officer: Add Attendance available; the centre list holds 9 centres (their scope).
- Audit: preview `audit_events` recorded the inserts (17 attendance rows, 1 session) and the correction (1 update). Deletion history is kept by the register-operation table (operation DELETE), not in `audit_events`; the SQL suite `npm run test:attendance` is what covers it, and it was not re-run here.

## Not covered
Concurrent editors (version conflict), network failure mid-save, other browsers, real mobile devices, Monthly Meeting (left to the standard application), the Student Performance Summary table.

## Side effects on preview
One holiday record was left on Centre 01 Evening on 2026-11-14 (holidays have no delete in the interface). Synthetic data.
