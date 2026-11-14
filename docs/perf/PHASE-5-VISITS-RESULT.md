# Phase 5 (Visits): result

Date: 14 November 2026. Preview project (synthetic data), real Chromium, `dist/` served with the production CSP: `node scripts/perf/attendance-live.mjs` (76 of 76 checks, all screens built so far).

## What was built (`web/src/pages/Visits.tsx`, `web/src/visits/`)
- **Filters:** reporting month, centre, shift, and (Leadership and Teacher) officer. A Cluster Officer always sees their own coverage; one verified staff identity is required, otherwise coverage is unavailable with an explanation (names and directory entries do not establish permission).
- **Scorecards 5.1-5.4** from `visit_summary`: visits completed, Morning completed, Evening completed, centres meeting the standard 2 + 2. Target = selected centres x 4 (x 2 when a shift is chosen). Planned visits never count; no observations means unknown, not zero.
- **Tables:** 5.5 visits by officer (`visit_officer_summary`), 5.6 centre coverage, 5.7 visit log (Cluster Officer, their writable centres, `read_visits`, newest first). All use the shared DataTable (search, sort, ten per page, CSV).
- **Record a visit (Cluster Officer):** centre, shift, date, status Planned or Completed, feedback and next action; a completed visit needs feedback and a date that is not in the future; exactly one verified dated officer assignment must cover the centre and date; one visit id per dialog so a retry cannot duplicate; saving follows the server's `visit_entry` gate.
- **Left to the standard application:** correcting a saved visit (`visit_corrections` is hard-off) and the revision history.
- Summary and officer reads run six at a time, as in the current page; they are small queries (Leadership, 92 centres: first screen in about 1.3 s).

## Checks
- 142 web tests (19 new), lint, syntax check, 138 frontend tests, both builds, `npm audit --audit-level=high` pass.
- Real browser: Leadership and Teacher coverage lists centres; with no visits on preview the cards say "No verified visits recorded" rather than 0; no axe violations incl. contrast; no horizontal scroll at 375 px (a layout bug found here, tables pushing the grid wider than the phone, was fixed); no failed calls or console errors.

## Not covered
- The Cluster Officer view and Record a visit on live data: the preview Cluster Officer account has no verified dated officer assignment, and no visit rows exist (the owner will populate visits). Both need preview data changes and the `visit_entry` gate, which need separate approval. The recording rules, the assignment matching and the saved call are covered by unit tests.
- Numbers against the current Visits page; concurrent edits; real phones; monthly visit trends (the current page loads them on demand).
