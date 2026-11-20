# Permission architecture Phase 6: React frontend cutover

**Date:** 20 November 2026  
**Branch:** `fix/permission-architecture`  
**Implementation commit:** `1acfcb1fe0b89af4eded6ec356d2427696659c28`  
**Protected Preview:** <https://mass-cac-dashboard-rfaenhepd-mass-data-dashboard.vercel.app/> (`READY`)  
**Environment:** Preview only  
**Production:** unchanged

## Problem

Phases 1–5 established a single governed role, hierarchical database authorization and narrow destructive workflows. The React interface still reflected parts of the earlier independent multi-role model: it offered role switching, treated Leadership as read-only in operational screens, and did not expose the reviewed deletion confirmations.

## Result

- The signed-in React session consumes exactly one server-selected application role. The role switcher and assumed-role state are removed.
- Navigation and operational screens follow server capabilities. Leadership can use inherited Teacher and Cluster Officer workflows across its global scope.
- Cluster Officer and Leadership visit logs use the protected scoped visit API, including visits created by another officer when the centre is authorized.
- Official CSV export controls are shown only when the server context grants Leadership export authority.
- The Preview database rejects export-sized attendance and generic table-page requests for non-Leadership roles, so hiding the button is not the security boundary.
- Student, attendance-mark, attendance-register, assessment-result, assessment-register and visit deletion flows call the narrow Phase 5 RPCs. They show impact or scope information, require a reason and preserve one request identifier across retries.
- A 401/403 response clears cached context and terminates the local session, so inactive-user or inactive-assignment decisions take effect on the next server request.
- `read_attendance_register` now returns the protected attendance-row identifier needed for individual deletion; it adds no student data.

## Legacy interface

No file under the legacy `src/` interface was changed. The `/vanilla/` route retains its existing behavior at the owner's direction and is planned for removal in a later phase.

## Database installation

Migration `20261119180000_permission_frontend_cutover.sql` was:

1. dry-run inside a rolled-back transaction on Preview;
2. installed with the reviewed activation seal;
3. recorded in the Preview migration ledger; and
4. verified by reading the installed function definitions.

Preview verification established:

- both export-sized page functions contain the Leadership-only server gate;
- the protected attendance-register response contains the immutable attendance record identifier;
- the existing `attendance_entry`, `assessment_entry`, `visit_entry` and `student_deletion` activation values were not changed.

Production verification established that the migration is absent and both new export gates are absent. No Production setting, schema, function, data or activation switch was changed.

## Validation

- `npm run web:typecheck`
- `npm run test:web` — 27 files, 207 tests
- `npm run lint -- --no-cache`
- `npm run check`
- `npm test` — 137 frontend tests and 27 workflow/removal checks
- `npm run build`
- `npm run test:sql:portable` — includes Phase 6 export-gate and attendance-identity assertions

Vercel confirms that the protected Preview was built from the implementation commit on `fix/permission-architecture` and reached `READY`. The repository's Preview/Production isolation guard ran as part of that build. Automated fetching was not performed because the available protected-deployment tool would create a temporary share link accessible to anyone holding it; no such broader access was authorized. Signed-in role-by-role manual acceptance therefore remains a review step for the owner.
