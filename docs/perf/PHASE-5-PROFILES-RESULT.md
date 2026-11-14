# Phase 5 (Student profiles): result

Date: 14 November 2026. Preview project (synthetic data), real Chromium, `dist/` served with the production CSP: `node scripts/perf/attendance-live.mjs` (45 of 45 checks with `--register`, Attendance and Profiles together).

## What was built (`web/src/pages/Profiles.tsx`, `web/src/profiles/`)
- **List (3.1):** the same server function as the current page, `student_profile_page_v2`: ten students per page, search (name, ID or centre) and a separate ID search, filters (centre, grade, shift, gender), click-to-sort on the server (ID, name, centre, grade, shift, gender, enrolled from), ascending first then descending, every change returns to page 1. Student details come from `read_students` for the role's centres, read once per centre and kept until a save.
- **Access:** only the active operational role's writable centres are requested (same rule as the current page). Leadership sees an aggregate-only note and no student request is made.
- **Add student:** `register_student_once` with one request id per dialog (a retry cannot register twice); verified name, observed start date (not in the future) and shift required; unknown gender is sent as null.
- **Edit profile:** loads the profile revision and academic-year history, saves name, gender, board result and current-year status with `save_student_profile_year` (or `correct_profile` when no current year exists), using the revision tokens the server issued.
- **Activation gates:** a dialog saves only when the server's gate for it is on; otherwise it opens for review, says so, and Save is disabled. `registration` was enabled on preview on 14 November (owner-approved; rollback sets `enabled=false`). `profiles` cannot be enabled: a database check constraint (`features_check1`, the preservation boundary) keeps it hard-off, so Edit profile is review-only everywhere until a separate schema decision.
- **Left to the standard application:** transfers between centre, grade or shift (they need the old end date and a new start date).

## Checks
- Unit and component tests: 103 web tests (20 new: editor rules, service, page, dialogs, axe), 138 frontend tests, lint, syntax check, both builds, `npm audit --audit-level=high` all pass.
- Real browser (Teacher, Cluster Officer, Leadership): first page of 10, next page differs, grade sort ascending then descending (server order verified), ID search narrows to one student, Leadership has no student table, Add student opens with saving off, no horizontal scroll at 375 px, no failed RPC calls, no console errors, no axe violations including colour contrast, with and without the dialog open.

## Not covered
- Saving a profile edit: the `profiles` gate is hard-off by constraint, so the save path is covered by unit tests only.

## Live registration test (preview, `--register`)
Add student saved a synthetic student for Centre 01 (named "ZZ Test Student …"), the dialog closed and the student appeared in the list. Registered students cannot be deleted through the application, so each `--register` run leaves one synthetic student; the check is opt-in for that reason. The duplicate-protection request id is covered by unit tests, not by a live retry.
- Side-by-side numbers against the current Profiles screen; concurrency conflicts; real mobile devices; Student Performance Summary and per-student detail pages (attendance and assessment history), which belong to later screens.
