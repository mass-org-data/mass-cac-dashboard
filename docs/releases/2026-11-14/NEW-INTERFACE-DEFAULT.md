# New interface becomes the default (branch `perf/overview-load-and-ui-rebuild`)

Date: 14 November 2026. Not on Production: nothing here is deployed until the owner approves a release (see "Merge order").

## Problem
Signing in took 30 to 60 seconds on the Overview, and the vanilla-JS interface was a single 158 KB string-template file that could not be improved incrementally.

## Resulting behaviour
- **`/` is the new React interface** (all eight screens: Overview, Attendance, Student profiles, Assessments, Visits, Morarji scholarship, Annual donor summary, About).
- **`/vanilla/` is the original interface, byte for byte unchanged**, for fallback and for Activities and monthly meetings (not rebuilt by decision). The side menu links to it. The two share the sign-in session (same origin and storage key).
- `/next` and `/next/...` redirect to `/` (links used during review keep working); `/vanilla` redirects to `/vanilla/`.
- The header and the side menu are fixed on screen (only the page content scrolls); the collapse button is always at the foot of the menu. Page headings use the menu numbering at one size ("1. Overview").
- Navigation is a side menu in the original style ("PROGRAMME", numbered items with icons, active item highlighted) that collapses to icons on desktop (choice remembered in the browser) and slides over the page with a scrim on a phone. Each role sees its own screens with fixed numbers: Leadership has no Student profiles (3), only Leadership has the Annual donor summary (7).
- The header is unchanged except the MASS logo, which was cropped of its blank margin and enlarged (about 64 to 72 px high).
- One build, no flag: `npm run build` writes the React interface to `dist/` and the original to `dist/vanilla/`; `release.json` records `ui: "react"` and `legacyPath: "/vanilla/"`. `MASS_NEXT_UI` is gone.

## Performance and data (from the branch)
First scorecards 10.6 s to 2.0 s, whole Overview 11.7 s to about 4.7 s, requests 111 to 11, failed cards 7 of 7 runs to 0 (see `docs/perf/`). One additive function `reviewed_attendance_series` (migration `20261113120000`) is on the preview database only; the client works without it.

## Security and data impact
- No change to authorization: the browser holds only the publishable key; the server decides roles, centres and activation gates. Gates the database keeps hard-off (profiles, corrections, transfers, enrolments, Morarji edits) stay in the original interface.
- CSP unchanged (`script-src 'self'`, no inline script, `connect-src` exactly self plus the two approved Supabase hosts). The Production build still refuses a non-production project.
- Production database untouched. Preview database changes made during this work (all owner-approved, synthetic data only) are listed in `AGENTS.md`.

## Validation
`npm run lint`, `check`, `test` (138 frontend tests, 27 workflow checks), `build`, `npm audit --audit-level=high`, `npm run web:typecheck`, `npm run test:web` (177 tests incl. automatic accessibility checks), and `node scripts/perf/attendance-live.mjs` (132 real-browser checks on preview: all screens for Leadership, Teacher and Cluster Officer, numbers checked against database counts, side menu, logo, phone width, `/vanilla/`). Docker-backed suites and the old-interface Playwright suites were not re-run for this change (see "Not covered").

## Tests that froze the original look
Removed at the owner's request: `tests/frontend/original-parity.test.mjs`, `tests/parity/visual.py` and `tests/parity/original-inventory.json`. Behaviour and number checks for the new interface are the web unit tests and `scripts/perf/attendance-live.mjs`. The original interface at `/vanilla/` is no longer pinned byte for byte by a test.

## Not covered
Real phones, many users signing in at once, other browsers, a side-by-side comparison of every screen with the original, the full Docker release gate (`test:sql:portable`, `test:attendance`, `test:browser`, ...), Activities and monthly meetings in the new interface.

## Merge order and branches (nothing merged or deployed)
Merge #11 to #15 into `main` in order, then open the PR for `perf/overview-load-and-ui-rebuild` (base `fix/centre-event-review` while the stack is reviewed; it carries #16 and #17), then close #16 and #17. Prefer merge commits. Production deploys `main` only after the owner's approval; apply `20261113120000` and the two `user_scope_grants` indexes (`202611060025`) to Production only through a gated release.
