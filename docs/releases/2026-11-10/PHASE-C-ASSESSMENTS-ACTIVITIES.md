# Phase C — assessments and activity participation

Depends on Phase B / PR #11.

## Requirement status

| Requirements | Result |
| --- | --- |
| F19–F21 assessment entry and saved results | Assessment entry now starts with one authorized centre and one required observed date. The date maps to F1–F4 using the selected April–March academic year, then opens a scrolling roster with one atomic batch Save. New results retain that date; score corrections retain the original immutable date and revision token. Existing saved-result tables and individual edit controls remain available. Imported quarter-only records keep an unknown date rather than receiving an invented value. |
| Assessment uniqueness / retests | The installed schema and both assessment write functions enforce one result per child and assessment definition. A saved result's enrolment and date are immutable. The UI states that retests are unsupported and does not add a new constraint or reinterpret an existing result. A programme/data-model decision is still required before retests can be represented. |
| F22 activities | Activity participation continues to use its separate participation RPC and records; it does not write classroom attendance. The roster retains the familiar bulk-mark controls but now labels them “participated” and “did not participate” to prevent attendance terminology from changing the meaning. |

## Data and security

No migration, hosted data, permission, feature-gate, RLS, or Production value changed. Existing assessment batch limits, version checks, centre scope, score bounds, audit triggers, and activity write guards remain authoritative.

## Files

- `src/live/assessment-round.js`: April–March date-to-round and configured 25-mark definition mapping.
- `src/live/original-actions.js`: centre/date assessment setup, scoped batch roster, protected batch Save, and participation labels.
- `src/app.js`: matching activity participation wording in the non-live demonstration path.
- `tests/frontend/assessment-round.test.mjs`: F1–F4 boundary and approved-definition coverage.
- `tests/frontend/operational-completion.test.mjs`: entry-only assessment protection through the new two-step form.

## Validation

- `npm run lint`: passed.
- `npm run check`: passed.
- `npm test`: 23 frontend test files passed; 27 workflow/removal checks passed.
- `npm run test:staff-access`: 22 scoped backend assertions passed.
- `npm run build`: passed.

The undeclared Node `playwright` dependency remains a Phase F test-harness gap recorded in Phase A.
