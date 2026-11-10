# Phase E — navigation, layout, and accessibility

Depends on Phase D / PR #13.

## Requirement status

| Requirements | Result |
| --- | --- |
| F02 / F03 navigation and labels | Live menus now follow task order and use direct labels: Attendance, Student profiles, Assessments, Activities, visits, and Morarji scholarship. Role-specific routes and permissions are unchanged. The annual donor route has an explicit Annual donor summary label. |
| F04 loading/layout continuity | The existing role-loading state remains intact. Desktop sidebar collapse remains available; mobile navigation now exposes `aria-controls` and `aria-expanded`, uses 44-pixel targets, and provides a labelled backdrop button that closes the menu. |
| F23 titles, numbering, spacing, dropdowns, mobile | Historical chart/table numbers are no longer shown in the live interface; stable internal `data-chart` identities remain for calculation mapping and tests. Filter labels, line-chart overflow, header actions, modal buttons, and touch targets receive responsive styling. MASS branding is unchanged. |
| About screens | The live “About these records” workflow is replaced with one concise general “About this dashboard” page covering access, approved rules, and missing-data behavior. Public and fictional-demo help remain appropriate to their separate contexts. |

## Data and security

No Supabase migration, hosted data, permission, feature-gate, RLS, or Production value changed. Navigation changes do not add routes or capabilities, and Leadership mutation restrictions remain unchanged.

## Files

- `src/app.js`: role-specific menu order/labels, accessible mobile menu state, simplified About page, and live title numbering.
- `src/live.css`: filter-label, chart-overflow, touch-target, action, and mobile navigation styling.
- `tests/frontend/layout-accessibility.test.mjs`: navigation semantics, About-page removal, and live menu-label coverage.

## Validation

- `npm run lint`: passed.
- `npm run check`: passed.
- `npm test`: 25 frontend test files passed; 27 workflow/removal checks passed.
- `npm run test:staff-access`: 22 scoped backend assertions passed.
- `npm run build`: passed.

The undeclared Node `playwright` dependency remains a Phase F test-harness gap recorded in Phase A.
