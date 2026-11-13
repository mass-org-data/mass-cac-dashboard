# Phase 5 (Student profiles): result

Date: 14 November 2026. Preview project (synthetic data), real Chromium, `dist/` served with the production CSP: `node scripts/perf/attendance-live.mjs` (43 of 43 checks, Attendance and Profiles together).

## What was built (`web/src/pages/Profiles.tsx`, `web/src/profiles/`)
- **List (3.1):** the same server function as the current page, `student_profile_page_v2`: ten students per page, search (name, ID or centre) and a separate ID search, filters (centre, grade, shift, gender), click-to-sort on the server (ID, name, centre, grade, shift, gender, enrolled from), ascending first then descending, every change returns to page 1. Student details come from `read_students` for the role's centres, read once per centre and kept until a save.
- **Access:** only the active operational role's writable centres are requested (same rule as the current page). Leadership sees an aggregate-only note and no student request is made.
- **Add student:** `register_student_once` with one request id per dialog (a retry cannot register twice); verified name, observed start date (not in the future) and shift required; unknown gender is sent as null.
- **Edit profile:** loads the profile revision and academic-year history, saves name, gender, board result and current-year status with `save_student_profile_year` (or `correct_profile` when no current year exists), using the revision tokens the server issued.
- **Switched off until activation:** the server's activation gates (`registration`, `profiles`) are off on preview, as in the current interface. The dialogs open for review, say so, and Save is disabled. Nothing is saved.
- **Left to the standard application:** transfers between centre, grade or shift (they need the old end date and a new start date).

## Checks
- Unit and component tests: 103 web tests (20 new: editor rules, service, page, dialogs, axe), 138 frontend tests, lint, syntax check, both builds, `npm audit --audit-level=high` all pass.
- Real browser (Teacher, Cluster Officer, Leadership): first page of 10, next page differs, grade sort ascending then descending (server order verified), ID search narrows to one student, Leadership has no student table, Add student opens with saving off, no horizontal scroll at 375 px, no failed RPC calls, no console errors, no axe violations including colour contrast, with and without the dialog open.

## Not covered
- Saving a student or a profile edit on preview: the activation gates are off, and enabling them is a separate preview change that needs the owner's approval.
- Side-by-side numbers against the current Profiles screen; concurrency conflicts; real mobile devices; Student Performance Summary and per-student detail pages (attendance and assessment history), which belong to later screens.
