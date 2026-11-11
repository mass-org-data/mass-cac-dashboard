# MASS CAC Dashboard agent context

This file is the reusable working context for coding agents. Read it before changing the repository. Treat dated deployment and PR details as a snapshot: fetch the remotes and inspect GitHub, Vercel, and Supabase before acting on them.

## Project and services

- Repository: `mass-org-data/mass-cac-dashboard`
- Production: <https://mass-cac-dashboard.vercel.app/>
- Vercel project: `mass-cac-dashboard`
- Supabase project: `pbkwpfdpdtelmvbkzgvx`
- Node version: 24.x
- The current frontend is a custom Node/ES-module static application built by `scripts/build.mjs` into `dist/` and hosted on Vercel. The repository does not currently depend on Next.js. Do not introduce Next.js assumptions without an explicit migration decision.
- Supabase/PostgreSQL is the backend. Reviewed SQL migrations live in `supabase/migrations/`; the browser uses scoped `mass_api` functions and aggregate reads.

Never print or commit credentials, tokens, private student data, or private source-workbook data.

## Baseline and current PR stack

The verified Production baseline on 10 November 2026 was `main` at `26dd33b80071d95b8b20d2c3fd2cd1d55b5f6ef8`. It includes:

- PR #8, attendance popup/register: merge commit `9053d45`.
- PR #9, scoped multi-role staff access: merge commit `26dd33b`.

The following ready, non-draft PRs were then built as a dependent stack. They were not merged or deployed to Production when this file was created:

| Order | PR | Branch / base | Commit | Scope |
| --- | --- | --- | --- | --- |
| 1 | #10 | `feature/requirements-phase-a` / `main` | `b55fb50` | Role-scoped loading |
| 2 | #11 | `feature/requirements-phase-b` / Phase A | `0c3a4b6` | Profiles and visit refresh |
| 3 | #12 | `feature/requirements-phase-c` / Phase B | `0ad2dc0` | Assessments and activities |
| 4 | #13 | `feature/requirements-phase-d` / Phase C | `238c602` | Leadership and donor reporting |
| 5 | #14 | `feature/requirements-phase-e` / Phase D | `7c09e70` | Navigation and accessibility |
| 6 | #15 | `feature/requirements-phase-f` / Phase E | `122fc76`, `74ed90e` | End-to-end validation |

All six PRs had green GitHub `frontend` and `portable-sql` checks and Ready protected Vercel previews. Before new work, run `git fetch`, check whether these PRs have since merged, and branch from the latest intended baseline. Do not recreate already merged work or continue from an obsolete branch.

The intended merge order for the stack is #10, #11, #12, #13, #14, #15. Do not merge, rebase the stack, or deploy Production without the user's approval. Create actual ready PRs rather than draft PRs unless the user explicitly changes that preference.

## Release records

Read the relevant dated record before modifying a completed area:

- `docs/releases/2026-11-09/ATTENDANCE-POPUP.md`
- `docs/releases/2026-11-09/SCOPED-STAFF-ACCESS.md`
- `docs/releases/2026-11-10/PHASE-A-ROLE-LOADING.md`
- `docs/releases/2026-11-10/PHASE-B-PROFILES-VISITS.md`
- `docs/releases/2026-11-10/PHASE-C-ASSESSMENTS-ACTIVITIES.md`
- `docs/releases/2026-11-10/PHASE-D-LEADERSHIP-REPORTING.md`
- `docs/releases/2026-11-10/PHASE-E-LAYOUT-ACCESSIBILITY.md`
- `docs/releases/2026-11-10/PHASE-F-END-TO-END-VALIDATION.md`

Older schema, deployment, privacy, and reconciliation evidence is under `docs/releases/2026-10-29/` and `docs/releases/2026-11-05/`.

## Functionality that must be preserved

### Attendance and audit behavior

- Saved centre/shift/date register and charts.
- Add/Edit Attendance popup with student names for authorized roles.
- Mark changes remain drafts until explicit Save.
- Individual clears, audited corrections, and whole-register deletion.
- Version checks, request/idempotency tokens, duplicate protection, exact deletion, and immutable history.
- Saved registers are newest-first and use ten-row pagination.
- Do not weaken record guards or audit requirements to make a frontend action pass.

### Scoped roles and loading

- Verified-role switching among only roles returned by the server.
- Role-specific centre scope for Teacher and Cluster Officer.
- Leadership uses aggregate reporting reads and is read-only unless the user selects a separately verified operational role.
- Default to Leadership when authorized (including all-role accounts), otherwise Cluster Officer then Teacher. Always land on Overview; fetch another role only when selected.
- Detailed records load only for the active operational role's centres. Do not load the union of all writable centres or the full database.
- Unknown roles and unauthorized centres must fail before or at server authorization. Client filtering is not a security boundary.

### Profiles and visits

- Profile search covers authorized name, permanent student ID, and centre.
- Stable sorting covers name, ID, centre, numeric grade, and newest enrolment; pagination remains deterministic.
- Add Student uses the protected registration API.
- Visit rows are newest-first. A successful save/correction refreshes the protected list immediately and selects its saved month, centre, and shift.
- Assignment dates and visit revision history remain authoritative.

### Assessments and activities

- Assessment entry is a two-step flow: choose one authorized centre and observed date, derive F1-F4, then show one scrolling roster with one atomic Save.
- Academic year is April-March. Round mapping is implemented in `src/live/assessment-round.js`.
- Maximum score is 25.
- Corrections retain the original observed date and version token.
- Historical quarter-only records keep an unknown date; never invent one.
- The installed schema currently permits one result per child/assessment definition. Retests require a programme/data-model decision.
- Activity participation remains separate from classroom attendance and uses participation wording and RPCs.

### Leadership reporting

- Page order is Filters, Scorecards, Student/Grade Breakdown Charts, then Centre Table.
- Scorecards include boys, girls, and current donor-association totals calculated from the full filtered population.
- The centre table is sortable and paginated at ten centres.
- Attendance Over Time is a monthly line chart; unknown months are gaps, not zeroes.
- Annual Donor Summary is a separate page with explained CSV export.
- Annual attendance sums P, A, and L before calculating the rate; never average monthly percentages.
- Current donor association is not historical funding evidence.
- Existing bounded `reviewed_chart_metrics` responses and approved calculations remain authoritative.

### Navigation and accessibility

- Live navigation uses task labels such as Attendance, Student profiles, Assessments, Activities, Visits, and Morarji scholarship.
- Annual donor reporting has its own route and label.
- Desktop sidebar collapse and accessible mobile menu/scrim behavior must remain.
- Maintain labelled controls, 44-pixel mobile targets, responsive filters/actions, and MASS branding.
- Keep only the simple general About page in the live application; do not restore historical numbered “About these records” screens.
- Number navigation pages, scorecards and charts consistently (1.1 style, without the word Chart). Preserve stable internal `data-chart` identifiers for calculations and tests.

## Approved programme rules

- Academic year: April through March.
- Attendance codes: P = Present, A = Absent, L = Leave, MM = Monthly Meeting/holiday, WO = Weekly Off.
- Attendance rate: `P / (P + A + L) * 100`.
- Missing attendance and scores remain unknown. Do not infer records or count a missing score as zero.
- Assessments have four quarterly rounds and a maximum of 25 marks.
- Cluster Officer target: four completed visits per centre per month, two Morning and two Evening.

## Open programme decisions

D01 is answered: L means Leave. D02-D08 remain unresolved unless a later reviewed approval is found:

- D02: session types and overlapping sessions.
- D03: assessment uniqueness and how to represent retests. Preserve the current one-result rule meanwhile.
- D04: approved activity reporting metrics.
- D05: Morarji results and rounds.
- D06: broader Leadership editing permissions. Preserve current read-only Leadership behavior.
- D07: programme meaning of an enrolment exit date. Existing historical boundaries are exclusive; do not silently reinterpret data.
- D08: subject/skill-level assessment scoring.

Continue independent work while these decisions remain open. Do not invent programme rules to close them.

## Important code areas

- `src/app.js`: main live rendering, routes, reporting, menus, dialogs, and exports.
- `src/live/original-review.js`: live startup, refresh, role transitions, and scoped reads.
- `src/live/original-actions.js`: protected operational forms and writes.
- `src/live/role-data.js`: authorized role order and role-specific read plans.
- `src/live/attendance-register.js`: attendance register model/helpers.
- `src/live/profile-list.js`: profile search and stable sorting.
- `src/live/assessment-round.js`: April-March date-to-round mapping.
- `src/live/leadership-report.js`: centre sorting, annual attendance, and line-chart rendering.
- `src/live/api.js`, `reads.js`, `backend-capabilities.js`: Supabase API boundaries and feature capabilities.
- `src/live.css`: live layout and responsive/accessibility styles.
- `scripts/imports/render.py`: reviewed import SQL rendering.
- `supabase/migrations/`: append-only reviewed schema and security migrations.

Do not reset Supabase, replay already installed hosted migrations, rewrite migration history, or overwrite hosted records. New schema work requires a new reviewed migration and rollback/security validation.

Directory import reconciliation deliberately excludes two separately managed columns from source-row equality:

- `staff_members.auth_user_id`, managed by reviewed Auth linkage.
- `centre_staff_assignments.verification_reference`, managed by operational verification.

Imports must preserve those values while continuing to compare every source-managed identity and relationship field.

## Validation workflow

Use the checks appropriate to the change. The full release gate is:

```bash
npm ci
npm run lint -- --no-cache
npm run check
npm test
npm run build
npm audit --audit-level=high
npm run test:staff-access
npm run test:sql:portable
npm run test:attendance
npm run test:activation
npm run test:directory
npm run test:imports
npm run test:students
npm run test:api
npm run test:browser
MASS_CHROMIUM_EXECUTABLE=/usr/bin/chromium MASS_TEST_MULTI_ROLE=1 npm run test:attendance:browser
```

Playwright 1.55.1 is a declared development dependency. In the managed cloud environment, browser tests may need permission to bind a local `127.0.0.1` server and use `/usr/bin/chromium`.

Docker-backed integration suites create disposable PostgreSQL containers but some scripts can still contend for Docker/test resources. Run `test:students`, `test:imports`, `test:directory`, `test:api`, and `test:browser` sequentially. A parallel run previously produced a false current-schema failure through shared test interference.

Current expected high-level results as of PR #15:

- 25 frontend test files and 27 workflow/removal checks.
- 47 Chromium/PostgREST release scenarios.
- 32 multi-role browser assertions.
- 52 attendance-register SQL checks.
- 22 scoped staff-access assertions.
- 1,440 portable calculation cases.
- Current catalog: 28 forced-RLS `mass_core` tables; 34 protected application/import tables across `mass_core` and `mass_foundation`.

If catalog counts change through a reviewed migration, measure the current schema in a disposable database and update explicit replay expectations. Do not guess the count.

## Release discipline

- Preserve Production and existing hosted data.
- Use small reviewable branches and ready PRs with protected Vercel Previews.
- Include the problem, resulting behavior, security/data impact, validation, branch, commit, PR, and Preview in release notes.
- Keep dependent PR bases explicit and state the merge order.
- Do not merge to `main`, deploy Production, publish a cloud-environment draft, or alter hosted permissions/data without authorization for that action.
- Read-only hosted inspection and local disposable testing are acceptable. Use isolated synthetic test data; never fabricate programme outcomes.
- Verify GitHub, Vercel, and Supabase state at the start of deployment-sensitive work because this file may lag later merges.

## Requirement snapshot

- Phases A–F are implemented through PRs #8–#15. The signed-in acceptance review found gaps; see `docs/releases/2026-11-10/FRONTEND-ACCEPTANCE-CORRECTIONS.md`. Do not label all F01–F24 complete until the corrected deployed preview and hosted metadata migration pass acceptance.
- D01 answered.
- D02-D08 need programme decisions as described above.
- No Supabase schema/data/grant change was required for Phases A-F; they reused existing protected APIs and aggregates. Phase B included read-only hosted verification of officer assignments and visit history.


## Single-PR acceptance follow-up (10 November)

Continue the corrections in PR #16 (`fix/frontend-acceptance`); do not create a duplicate PR. PR #10 is now merged; #11–#15 and #16 must be rechecked before any release. Current user approval is implementation and one PR, with production frontend held.

Initial Overview loading uses the aggregate APIs for every role. Operational modules load on demand through `__massEnsureView`; Profiles, Assessments and Activities request only their needed facts. Explicit individual student detail loads the supporting modules. Keep root rendering safe against nested blur/change callbacks. Assessment and participation entry rosters use `data-paginate="false"`.

The pending metadata migration also includes bounded server profile paging and the existing nullable Morarji contradiction rule at the server boundary. Do not claim hosted installation from a local test. Keep the feature gates unchanged and report the actual hosted migration state in the PR.


## Confirmed attendance UI rule (10 November follow-up)

New attendance entry offers A, P, H, MM only. The user confirmed H means Holiday and is excluded from attendance percentages. Preserve old L and WO records and their meanings; legacy L remains eligible in P/(P+A+L). Do not convert history or map H to another code. The pending metadata migration advertises `holiday_code`; older hosted APIs must show H as unavailable until installed. Keep larger readable text, aligned scorecards, inline ID/name search and the persistent Sign out account bar.

## 11 November centre-event clarification and authorised continuation

The latest user clarification supersedes the older MM UI rule above: MM is a separate centre-wide monthly meeting, not a new classroom attendance mark. One MM and four planned activities per centre/month cover both shifts together. Individual participation remains separate from classroom attendance and the >20-day rule. Historical MM/L/WO are preserved.

Continue this work in PR17 (`fix/centre-event-review`), on top of PR16. The user explicitly authorised applying the pending attendance metadata migration, enabling registration/activity entry, and building centre-wide MM/activity records. This does not authorise a main merge, Production frontend deployment, new staff grants, or unrelated feature activation. Supabase connection and actual hosted state must be verified before claiming installation. See `docs/releases/2026-11-11/CENTRE-EVENTS-AND-ACTIVATION.md`.
