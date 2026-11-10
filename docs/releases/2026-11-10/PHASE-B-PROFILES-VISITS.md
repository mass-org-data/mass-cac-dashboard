# Phase B — student profiles and visit refresh

Depends on Phase A / PR #10.

## Requirement status

| Requirements | Result |
| --- | --- |
| F12–F14 attendance register | Already working from PR #8. The saved centre/shift/date table is newest-first and existing shared table controls paginate it at ten rows. Popup Save, individual clear, correction reason, whole-register deletion confirmation, version token, duplicate-request protection, and audit receipts are preserved unchanged. Creator/modifier and note fields were not invented without the exact approved requirement/API contract. |
| F15–F17 student profiles, B04 | Live search now covers authorized student name, permanent student ID, and centre label. Sort options cover name, ID, centre, numeric grade, and newest enrolment; deterministic name/ID tie-breaking keeps pagination stable. The existing ten-row navigation and scoped Add Student workflow remain connected to the protected registration API. |
| F18 visits, B05 | Visit records render newest-first. After a successful protected save/correction and full data refresh, the saved month, centre, and shift become the active selection and that month's protected visit list is reloaded immediately. Existing dated assignment and revision-history checks remain authoritative. |

## Hosted read-only verification

The hosted database was inspected without changing records or permissions:

- 27 current officer-assignment rows across nine centres.
- zero role/centre mismatches between scope grants and directory assignments.
- one saved visit and one immutable visit revision.
- zero future-dated completed visits.

No hosted visit, profile, attendance, assignment, grant, feature flag, or schema value was changed.

## Files

- `src/live/profile-list.js`: normalized profile search and stable sorting.
- `src/app.js`: profile sort control, live search integration, and newest-first visit rows.
- `src/live/original-actions.js`: post-save visit selection and protected list reload.
- `tests/frontend/profile-list.test.mjs`: search and sort coverage.
- `tests/frontend/operational-completion.test.mjs`: immediate saved-visit selection/reload coverage.

## Validation

- `npm run lint`: passed.
- `npm run check`: passed.
- `npm test`: 22 frontend test files passed; 27 workflow/removal checks passed.
- `npm run test:staff-access`: 22 scoped backend assertions passed.
- `npm run build`: passed.

The undeclared Node `playwright` dependency remains a later test-harness gap recorded in Phase A.
