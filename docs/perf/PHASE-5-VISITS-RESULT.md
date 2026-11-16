# Phase 5 (Visits): result

Date: 14 November 2026. Preview project (synthetic data), real Chromium, `dist/` served with the production CSP: `node scripts/perf/attendance-live.mjs` (76 of 76 checks, all screens built so far, after the visit seed below).

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

## Visit seed on preview (owner-requested, 14 November 2026)
Synthetic data only. One transaction acting as the preview Cluster Officer account (the same guards as a real save): 9 earlier-dated officer assignments (2026-04-01 to 2026-11-13) for the existing verified links, 183 visits (167 completed, 16 planned, July to November, Centres 01-09, mostly 2 Morning + 2 Evening per month; Centre 04 is one Evening short in October, Centre 07 has no November visits, Centre 09 starts in September) and their 183 first revisions. The existing assignments start on 2026-11-13 and cannot be edited, so earlier cover was added beside them. Visits and assignments cannot be deleted by design, so this seed is permanent on preview.

Live after the seed: Leadership shows 32 completed against a target of 368 for November (8 centres x 4; Centre 07 has none), Teacher (Centre 01) shows 4 of 4.

Still open: the preview Cluster Officer account is linked to nine different officer identities (each synthetic centre has its own directory officer), so the Cluster Officer view is correctly unavailable (the current interface requires one verified identity too). Testing the Cluster Officer view and Record a visit needs a single-centre Cluster Officer test account (a new preview account) and the `visit_entry` gate; both need separate approval.
