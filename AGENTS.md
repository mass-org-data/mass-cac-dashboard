# MASS CAC Dashboard agent context

This file is the reusable working context for coding agents. Read it before changing the repository. Treat dated deployment and PR details as a snapshot: fetch the remotes and inspect GitHub, Vercel, and Supabase before acting on them.

## Current permission work (21 November 2026)

Use this section for the current handoff. Dated status statements below and the earlier phase documents are historical. Fetch and verify the relevant remotes and hosted state before deployment-sensitive work.

- Work on the existing `fix/permission-architecture` branch. The pushed ref and protected Vercel branch Preview include the React-only removal commit `4c9ef08` at `https://dev-mass-cac-dashboard.vercel.app/`, backed by Preview Supabase `nilzfsahxoxibvrwsqkd`. GitHub PR #26 squash-merged the earlier Phases 1–6 into `staging` at `2bd3e1d`. Phase 7, Phase 8 and interface removal have no PR. Production Vercel and `main` remain at `3be1a4e` against Production Supabase `pbkwpfdpdtelmvbkzgvx`.
- Preview has the live Phases 1–6 database objects. The ledger has Phase 4 under provider version `20261119030757`, Phases 5–6 under their canonical versions, and Phase 7 under `20261121120000`. Phase 1–3 catalog objects were verified but their matching ledger entries are missing. Preserve that discrepancy for provenance review. Replaying installed migrations is unsafe.
- The approved Phase 7 migration and activation seal are installed on Preview only. The Custom Access Token Hook is enabled. The restricted database login and the Preview Edge Function secrets `MASS_ADMIN_DATABASE_URL` and `MASS_ADMIN_INVITE_URL` are provisioned. `leadership-admin` v1 is Active and verified from the deployed React UI. The Auth Admin credential stays inside Supabase Edge Runtime.
- Active Leadership can invite staff, link a verified manually provisioned Auth account, change other users’ roles, manage centre assignments and assignment history, and deactivate or reactivate other accounts. One Leadership actor is sufficient. Self-role change and self-deactivation are forbidden. The UI omits administration history, while immutable administration events remain in the backend.
- The live synthetic Teacher lifecycle passed. An existing JWT, password sign-in, and refresh were denied on deactivation. The old JWT and untouched old refresh were denied after reactivation. Supabase returned HTTP 500 for that rejected refresh. Fresh sign-in and refresh worked. The original centre was restored through a new assignment, with the ended assignment and completed events retained.
- Preview uses Resend SMTP with `onboarding@resend.dev`. The exact branch URL is allowlisted and its invite template routes to React password setup. The owner approved one invitation to the mailbox bound as `PREVIEW_INVITE_TEST_EMAIL`. Supabase and the Edge Function accepted it. The owner confirmed email receipt and that the link opened the password setup page. A read-only directory check confirmed the Teacher email and one centre assignment. The owner confirmed successful password setup and a fresh sign-in to the Teacher Overview at the assigned centre. The Phase 7 Preview invitation acceptance is complete. Keep mailbox addresses, invite URLs, tokens, and passwords out of chat and logs. Avoid a duplicate invite.
- The latest Preview snapshot has four governed accounts and twelve active centre assignments. Both legacy/governed mismatches were explained by completed Phase 7 events, covering the extra Cluster Officer centre and the new governed-only Teacher invite and assignment. Assessment entry remains enabled. Attendance entry, visit entry and deletion, and student cascade deletion remain disabled.
- The signed-in Vercel Preview checks passed for all roles, including Leadership-only directory access, hidden self-administration actions, and the token-free password setup screen from a synthetic URL. Portable SQL tests, native concurrency tests, and the React build passed. The broader Docker release and centre-events test suite failures reproduce at the pre-Phase-7 branch baseline.
- Phase 7 Preview acceptance is complete. Reconciliation has zero unexplained drift. Preserve historic evidence and do not delete retained legacy authorization rows without a later explicit approval.
- Phase 8 migrations `20261121180000_permission_legacy_retirement.sql`, `20261121183000_permission_context_compatibility.sql` and final `20261121190000_permission_context_retirement.sql` are installed on Preview only with canonical ledger entries. The final stored statement matches the reviewed file. All eighteen officer assignments are governed-linked; legacy rows remain retained; obsolete browser/operator privileges are revoked; staff Auth linkage and visit runtime use governed accounts; reconciliation remains at two explained mismatches and zero unexplained drift; gates are unchanged; Production is unchanged. Fresh final contexts passed for Teacher, Cluster Officer and Leadership with one authoritative role and no compatibility role arrays or operational-role flag. Anonymous context, Teacher foreign-centre reads and Teacher Leadership-directory access were denied. Preview public signup is disabled while invitation email and confirmation remain enabled. Details and rollback limits are in `docs/releases/2026-11-21/PERMISSION-PHASE-8-LEGACY-RETIREMENT.md`.
- The separately approved legacy-interface removal is deployed and accepted on protected Preview at `4c9ef08`: React is the sole build output, the `/vanilla` redirect and retired entry point are removed, and shared `src/live/` modules used by React are retained. Release metadata identifies the exact commit and contains `legacyRemoved: true` with no legacy path; `/vanilla` and `/vanilla/` return 404. Fresh sessions for Leadership, Cluster Officer and Teacher passed Overview, role-correct administration visibility, About, absence of the retired link and sign-out with no page errors or failed application responses before sign-out. Temporary browser/session artifacts were removed. Record: `docs/releases/2026-11-22/LEGACY-INTERFACE-REMOVAL.md`.
- Obtain separate approval for every Preview database or Supabase/Vercel control-plane mutation. Get explicit approval before opening a PR, merging, promoting, or acting on Production. Production release requires its own backup, rehearsal, dry run, sealing, postflight and release record. Leave operational feature gates at their reviewed values.

Current release details are in `docs/releases/2026-11-21/PERMISSION-PHASE-7-LEADERSHIP-ADMINISTRATION.md`. Use the current section above for the latest invitation result.

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

> **Status on 14 November 2026 (supersedes the table below where they differ):** PR #10 is merged; `main` is `3c5d7ef` and is what Production runs. #11-#17 are open as a dependent stack and are all contained in `perf/overview-load-and-ui-rebuild` (see "Performance branch and new interface" at the end). Merge order: #11-#15 into `main` in order, then the new branch's PR (which carries #16 and #17); close #16 and #17 afterwards. Prefer merge commits, not squash. Production's database was installed by sealed provider payloads and hand-applied migrations, so it differs from a fresh replay (see that section).

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

## Branch workflow and Vercel preview feedback (16 November 2026)

- Workflow: feature branches into `staging`; only `staging` is merged into `main`. The Vercel domain `preview-mass-cac-dashboard.vercel.app` serves the `staging` branch; Production is `mass-cac-dashboard.vercel.app` (`main`). Open PRs against `staging`, not `main`, unless the owner says otherwise.
- `vercel.json` sends three header rules: the common security headers, the strict Content-Security-Policy for every host except preview hosts (this is Production), and a relaxed policy only for preview hosts (the staging domain, `mass-cac-dashboard-<hash>-mass-data-dashboard.vercel.app` and branch URLs) that additionally allows the Vercel toolbar hosts (`vercel.live`, Vercel and Pusher) so preview users can leave Vercel Comments. `tests/frontend/security-policy.test.mjs` pins this: Production is never relaxed, and the relaxed policy only adds those hosts. After any change to these rules, check `curl -sI https://mass-cac-dashboard.vercel.app` shows the strict policy (one `script-src 'self'`, no `vercel.live`).
- Reading preview comments: `vercel comments` (Vercel CLI) lists unresolved threads for the linked project and branch; resolve each with a short note once fixed.

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

D01 is answered: L means Leave. D06 is answered for the permission redesign described in the 20 November 2026 update below. D02-D05 and D07-D08 remain unresolved unless a later reviewed approval is found:

- D02: session types and overlapping sessions.
- D03: assessment uniqueness and how to represent retests. Preserve the current one-result rule meanwhile.
- D04: approved activity reporting metrics.
- D05: Morarji results and rounds.
- D06: Leadership inherits operational Teacher and Cluster Officer permissions in the approved permission redesign. This is implemented on the permission branch and Preview only; Production keeps its current behavior until a separately approved release.
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
- `src/live/config.js`: approved Supabase project allow-list (production and preview). `scripts/runtime-config.mjs`: shared build-time config and the production/preview isolation guard.
- `src/live/limiter.js`, `reviewed-aggregate.js`, `perf.js`: two-at-a-time report queue, aggregate view built from one reviewed report, opt-in timing (`?perf=1`).
- `web/`: the sole React interface (see the last section). `scripts/perf/overview-react.mjs`: browser load measurement (`npm run perf:overview`).
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

Also required for changes to `web/`: `npm run web:typecheck` and `npm run test:web` (CI runs both; `npm run build` now builds both interfaces). The portable SQL suite includes the monthly-series parity cases. `tests/release/visits.sql` is time-zone correct (it once failed between 18:30 and 24:00 UTC).

Expected high-level results as of PR #15 (later work adds to them: 138 frontend tests, 45 web tests, 63 series parity cases, 22 guarded functions in a fresh install):

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

## Feedback review (12 November)

Continue PR #16 and preserve production. Source and requirement matrix: `docs/releases/2026-11-12/FEEDBACK-IMPLEMENTATION.md`. Scorecard values are larger while labels stay compact. Gender charts display only Girls/Boys; missing source genders remain unchanged. Attendance is aggregate-first and ends with its register. Teacher/CO Overview has a background current-month student summary; Leadership remains aggregate-only. New register audit/timestamp reads and reversible profile paging require the new additive feedback migration after the pending metadata migration. Neither migration was installed hosted during implementation. Keep filters/cards/charts/register order, sorting before pagination, draft-only attendance marks and scoped server audit reads.

## Swapneel review, 12 November

Continue the requested review in PR #16. Reuse centre-wide Monthly Meeting/activity support from PR #17 without opening another PR. The document comment defers the full unified attendance/Morarji form; add Monthly Meeting to Session Type now. Preserve historical L/WO; new individual marks are P/A. Keep production frontend held.

## Performance branch and new interface (13-14 November 2026)

Branch `perf/overview-load-and-ui-rebuild` (cut from `fix/centre-event-review` `c075cc3`, then merged `fix/frontend-acceptance` so it holds #11-#17; existing branches and `main` are untouched). PR base to propose: `fix/centre-event-review` while the stack is reviewed. Do not open a PR until the owner asks. Plan: `/Users/swapneelrane/.claude/plans/pasted-content-id-8391-you-are-shiny-cherny.md`; results: `docs/perf/` (`BASELINE.md`, `PHASE-2-RESULT.md`, `PHASE-3-RESULT.md`, `PHASE-5-OVERVIEW-RESULT.md`); working notes for the analyst: `docs/knowledge-sharing/WORKING-WITH-CLAUDE-CODE.md`.

### Environments
- Production Supabase `pbkwpfdpdtelmvbkzgvx`: real data, read-only diagnostics only, changed only through a gated release after merge to `main`. Vercel Production deploys `main`.
- Preview Supabase `nilzfsahxoxibvrwsqkd`: schema from the repo migrations, proposal 024, activation control and seal, including `20261112052348_feedback_register_reporting.sql`, which was missed at first and applied on 14 November with the owner's approval (it adds `attendance_register_summary_v4`, `assessment_register_summary` and `student_profile_page_v2`; applying it out of order replaced `get_attendance_register_capabilities`, so that function was re-applied from `20261112163945`). Register entry (`attendance_register_control`) and the `registration` and `assessment_entry` activation features are enabled on preview for acceptance testing (rollback: `enabled=false`). The `profiles` feature cannot be enabled anywhere: a check constraint on `mass_activation.features` keeps it hard-off. `mass_api` exposed, only `reviewed_reads` enabled, SYNTHETIC data only (92 centres, 1,500 students, about 200,000 attendance rows, about 3,700 assessments). Test accounts for Leadership (92 centres), Teacher (Centre 01) and Cluster Officer (Centres 01-09) are in the git-ignored `.env.preview-test-account`; never print or commit them. Visits, activities and monthly meetings are not seeded (owner will populate visits; activities and monthly meetings may be discarded; leave them untouched).
- Vercel project variables are split: Preview uses the preview project URL and key, Production the production ones. The build refuses a Production build with a non-production project and a Preview build with the production project (override `MASS_ALLOW_PRODUCTION_IN_PREVIEW=1`). `vercel.json` `connect-src` lists exactly `'self'` and the two project hosts; a test keeps it equal to `APPROVED_PROJECTS`.
- Supabase access uses a personal access token (`sbp_...`); secret API keys do not work with the Management API. Every preview database change needs the owner's approval each time and is applied as a reviewed migration file; preview changes are applied with temporary role grants inside one transaction (`mass_data_importer` for data, `mass_core_admin` for grants). The `mass_core_owner` role cannot insert facts directly (policy `can_write`).

### Overview load fix (done on the branch)
Cause: the Overview started about 10 all-centre `reviewed_chart_metrics` reports plus 92 per-centre `programme_aggregate` calls at once; concurrent heavy reports hit the database statement timeout and cards showed "Unavailable". Fixes: the per-centre loop is skipped when reviewed charts exist and the aggregate view is built from the single reviewed report (`reviewed-aggregate.js`); reviewed reports run two at a time (`limiter.js`); the 12-month chart loads when it scrolls into view and uses one `mass_api.reviewed_attendance_series` call (sealed behind `reviewed_reads`, advertised as `reviewed_attendance_series`, falls back to per-month reports if absent); capability probes run in parallel; the startup refresh reuses the just-verified identity and scope. The 30-second scope re-verification is unchanged. Measured on preview: first scorecards 10.6 s to 2.0 s median, whole page 11.7 s to about 4.7 s, requests 111 to 11, failed cards 7 of 7 runs to 0. Production gets this only after merge and release; the series migration `20261113120000` is not on Production and the client tolerates its absence.

### Drift between Production and a fresh replay (do not guess)
**Resolved on 17 November 2026:** the owner took a `pg_dump` backup, then eight migrations were applied to Production one transaction each (dry run of the whole chain first), each with `seal.sql` and its `supabase_migrations.schema_migrations` row: `202611060025`, `20261111120000`, `20261112163945`, `20261113120000`, `20261114120000`, `20261114140000`, `20261114130000`, `20261117120000`. A Preview-vs-Production comparison then showed identical functions, columns, indexes, constraints, triggers and policies; only the `attendance_entry` and `registration` gates differ on purpose. Order matters: `20261117120000` must follow `20261114130000` (it restores the centre-event report patch). Record: `docs/releases/2026-11-17/PRODUCTION-DATABASE-RELEASE.md`. The older note below is history.

Production has `assessment_register_summary`, `attendance_register_summary_v4`, `student_profile_page_v2` that preview lacks and lacks the `centre_event_*` functions and two `user_scope_grants` indexes (`202611060025`). `supabase/compatibility/MIGRATIONS.sha256` covers only files up to 023. A gated production workflow (GitHub Environment approval, ledger, preflight/postflight, only unapplied migrations) is proposed but not implemented.

### React interface (`web/`, the sole interface at `/`)
Vite, React 19, TypeScript, Tailwind 4, shadcn/ui-style primitives, TanStack Table pinned to 8.x. `npm run build` cleans `dist/` and writes only the React interface; it must not produce `dist/vanilla`. Navigation is a collapsible side menu (`web/src/app/SideMenu.tsx`: Leadership has no Student profiles, only Leadership has the Annual donor summary, numbers are fixed). The header and side menu are fixed on screen; only `main` scrolls. Shared `src/live/` modules supply config checks, client, verified sign-in, read APIs, role rules and CSV escaping. Shared components every page must use: `DataTable`, `Scorecard`, `ChartCard`, `AsyncState`. Rules: no inline script or handlers (CSP), no external fonts, controls at least 44 px, unknown is a dash never zero, never a service key. Activities and monthly meetings were not rebuilt (owner decision). Screens only save when the server's activation gate is on. `scripts/perf/attendance-live.mjs` is the real-browser check for all screens. Removal record: `docs/releases/2026-11-22/LEGACY-INTERFACE-REMOVAL.md`.

### Working rules for this effort
Plan then build in owner-approved phases; one phase per approval. Commit small logical commits on the new branch; push only that branch. Verify claims with measurements and parity runs; say what was not measured. Heavy tools: Playwright Chromium is installed in `~/Library/Caches/ms-playwright`; run `npm run perf:overview -- --runs N --label X --build` for load numbers (uses the preview project and the Leadership test account).

## UI cleanup, server paging and localization (18 November 2026)

Branch `feature/ui-cleanup-pagination-i18n` was created from `main` at `3be1a4e`; existing branches were not changed. The branch is pushed through `e005a3f` and has no PR yet. Its protected Vercel deployment is `https://mass-cac-dashboard-7kg88qix6-mass-data-dashboard.vercel.app/`, built from `e005a3f` against Preview Supabase `nilzfsahxoxibvrwsqkd`. GitHub and Vercel reported the deployment Ready. Ask the owner before opening a PR; when asked, target `staging` and include “Prepared with Codex” in the description.

### Completed scope

| Area | Status | Result |
| --- | --- | --- |
| Dashboard cleanup | Done | Improved reporting layout and scorecard/table presentation while preserving the approved calculations and unknown-value rules. |
| Attendance cleanup | Done | Improved register editing and audit/timestamp presentation without weakening version checks, draft behavior or audit requirements. |
| Server-side pagination | Done | All React `DataTable` screens request bounded, sorted and filtered server pages; the initial page is ten rows. Next/Previous fetch the required page rather than the entire table. Explicit CSV export still downloads all filtered rows in the selected sort order. |
| Language switcher | Done | English/Kannada toggle on sign-in and in the signed-in top bar. English remains the default and both languages use Latin numerals. |
| Saved default language | Done | Each authenticated staff user can save `en` or `kn` through scoped `mass_api` functions. The verified Auth email is shown in the new account menu; authorization still comes only from server context and assignments. |
| Kannada font | Done | Noto Sans Kannada is self-hosted under `web/public/fonts/` with its OFL license; no external font host was added. |
| Kannada copy | Needs human review | All machine-drafted Kannada strings are isolated in `web/src/i18n/kn.ts`. A fluent Kannada reviewer must approve or correct them before Production release. |
| Permissions | Deferred | No broad permission redesign, Leadership editing or student-profile deletion was added. Preserve the existing server-enforced permission model until the owner provides the next permission audit/direction. |
| Audit-history decision | Open | Confirm with Aashini whether the requested audit-history presentation remains a programme requirement. Existing protected audit behavior must not be weakened meanwhile. |

### Database state

- Preview only: `20261117180000_server_table_pages.sql` and `20261117190000_user_language_preferences.sql` were dry-run, applied one transaction at a time with `supabase/activation/seal.sql`, entered in the migration ledger and postflight-checked.
- `20261117180000` adds bounded table-page APIs for the React tables. Normal pages allow ten rows; explicit export can page through bounded batches up to 500.
- `20261117190000` adds forced-RLS `mass_core.user_preferences`, defaulting to English, plus authenticated self-service `mass_api.get_user_preferences()` and `mass_api.set_default_language(text)`. Authenticated users have no direct table access and anonymous callers have no function access.
- Production is unchanged and remains read-only. Do not apply either migration to Production without a separate gated release approval.

### Validation snapshot

- `npm run web:typecheck`: passed.
- `npm run test:web`: 27 files and 207 tests passed.
- `npm run lint -- --no-cache`, `npm run check`, `npm test` and `npm run build`: passed; the existing frontend suite reported 137 tests and 27 workflow/removal checks.
- `npm run test:sql:portable`: passed, including 1,440 calculation parity cases, bounded page execution under authenticated scope, language-preference round-trip/grant checks and 31 forced-RLS `mass_core` tables in a fresh replay.
- Deployment inspection confirmed Preview mode, the Preview Supabase project, React at `/`, the original interface at `/vanilla/`, and the deployed Kannada font. Interactive automation reached Vercel Authentication, so signed-in manual acceptance of the deployed language and pagination flows remains required.

### Follow-up acceptance

- Manually test the protected Preview with Leadership, Cluster Officer and Teacher accounts: table pagination/search/sort, all-filtered-row CSV export, sign-in language toggle, signed-in toggle, saving a default language and retaining it after the next sign-in.
- Have a fluent Kannada reviewer check `web/src/i18n/kn.ts` in context, including field terminology, error messages, dates and relative timestamps.
- Student deletion remains out of this phase. The current direction is that Teachers must not delete student profiles and any future deletion workflow should be limited to Cluster Officers or higher roles after a separate permission/security design.
- Historical note: the deprecated interface remained unchanged during this phase. Its separately approved removal is recorded in `docs/releases/2026-11-22/LEGACY-INTERFACE-REMOVAL.md`.

## Feedback round 2: Vercel comments on `staging` (22-23 November 2026)

Branch `fix/feedback-round-2` (cut from `origin/staging` `c9917e2`), ONE PR into `staging`, opened after Workstream 1 and extended by later workstreams. Source of truth: the Claude Sheet "Vercel Review Comments" (https://claude.ai/artifact/HXwnbaRvoW5NoBrm4MXPvV): one row per Vercel comment with its Vercel thread id, a screenshot flag, a "Address in next round?" tick and the owner's notes. Fetch comments with `env -u VERCEL_TOKEN vercel comments list --project mass-cac-dashboard --all-branches --status all --json` (the shell has a stale `VERCEL_TOKEN`; the project is not linked, so pass `--project`). Reply to and resolve each thread with `vercel comments resolve <thread> --message ...` once its fix is on `staging`. Not in this round (owner): "Compare round" removal (`qJN_SAqNEwHc`); `c5G3oWsrB8El` is already resolved; page-number box duplicate `iy3irhHO4DBx` is covered by the all-tables one.

### Owner decisions (22 November)
1. Leadership can add/edit attendance for ALL centres (no per-centre approval); same for visits, assessments, profiles.
2. The hard-off block on the `profiles` (and `morarji`) activation features may be lifted by a reviewed migration (Preview first; Production only through a separate gated release).
3. Enrolment "Graduated": add a REAL enrolment status (do not use the end date; students are not re-enrolled each April, a move to the next grade is just recorded). Note `status_code` already exists on enrolments (see `student_profile_page_v3`); check it before adding a column.
4. "Visit conducted by" is stored on the visits table itself; a Leadership user can be named.
5. Assessment round stays derived from the date (`src/live/assessment-round.js`); show the round clearly in the UI.
6. Chart 7.3 = mean of each mapped centre's annual attendance rate (each centre's P, A, L summed first), centres without records excluded, labelled as such. Done.
7. Chart 4.3 is in this round; "Compare round" is next round.

### Workstreams (status)
- **WS1 frontend only: DONE on this branch** (commits on `fix/feedback-round-2`). Shared: `FilterPanel`/`FilterSelect` (`web/src/components/FilterPanel.tsx`: active filter = green border, "Clear filters" button after the last filter, dropdown option text always English via `english()`), DataTable (page-number box, sort arrow always after the header text, no "Sorted and paged by the server" note, Export button in the title row, optional `searchLabel`), chart and table titles use the scorecard label size (`text-sm font-semibold`), menu renumbered (About last and unnumbered; User administration is 8; numbers green), document no longer scrolls past the shell (`relative overflow-hidden` on the shell root: absolutely positioned sr-only elements were extending the document). Pages: Overview (1.1 "Centers", 1.8 percent of enrolled with the count underneath), Attendance (old 2.2 removed and renumbered, line chart and bands side by side, by-centre table full width), Student profiles (charts 3.1-3.4 reuse the Overview report via `web/src/profiles/StudentCharts.tsx`, table is 3.5; columns Center, Shift, Grade, Student Name, Gender, Enrolled from, Action; Delete only inside the Edit dialog; search label "Search by Center Name or Student Name", ID field removed), Assessments (4.1 and 4.3 percent with absolute subtitle, 4.5/4.6/4.7 in one row, centre table 4.8 full width), Morarji (6.6 is a grouped vertical bar chart: `components/charts/GroupedColumnChart.tsx`), Annual donor (donor-name-only panel, no intro, scorecards 7.1-7.3, 7.3 as decided, chart 7.4, table 7.5 with Students Enrolled and Overall Attendance only).
- **WS2 permissions and switches: DONE on Preview (22 November), Production unchanged.** Verified in a real browser with the Preview Leadership account: Attendance shows Add Attendance and Edit on every register row, Student profiles shows Edit, Visits shows Record a visit, Morarji follow-up (6.8) loads. Changes: (1) migration `20261122120000_table_page_variable_conflict.sql` adds `#variable_conflict use_column` to `mass_api.dashboard_table_page` (fixes 42702 on `morarji_followup`; regression test in `tests/release/portable-sql.mjs`); (2) migration `20261122130000_activation_allow_profiles_morarji_enrolments.sql` plus `supabase/activation/control.sql` replace the hard-off CHECK with `features_preservation_boundary`, so only `attendance_corrections`, `assessment_corrections`, `visit_corrections`, `transfers`, `calendar` and `activities` stay hard-off; (3) both migrations were dry-run then applied to Preview with `seal.sql` and ledger rows; (4) Preview switches turned on with approval reference "Owner 2026-11-22 Vercel feedback round 2 (Preview acceptance)": `attendance_entry`, `visit_entry`, `profiles` (now on: assessment_entry, attendance_entry, profiles, registration, reviewed_reads, visit_entry; `morarji` and `enrolments` are allowed but still OFF until their screens exist in WS3, `student_deletion` off); (5) the User administration panel failed because the `leadership-admin` Edge Function allows CORS for exactly one origin, `MASS_ADMIN_INVITE_URL`; the Preview secret was changed to `https://preview-mass-cac-dashboard.vercel.app/` (preflight from that origin now returns 204 with the right `access-control-allow-origin`). NOT verified end to end: signing in to the staging domain and using the panel (Vercel Authentication blocks automation). A future invitation link also uses that origin. **Production still needs a gated release** of both new migrations (after `20261117180000`, which Production lacks), no Production switch was touched.
- **WS3 new screens and backend work: CODE DONE on this branch (23 November), migrations dry-run on Preview but NOT YET APPLIED.** Owner answers: (1) enrolments: a student who moves to the next grade at year end gets status `Promoted` on the closed enrolment (end date = the 1 April boundary); a student who leaves mid-year keeps `Left programme` with the real end date; `Graduated` stays for finishing the programme. (2) Chart 2.2 "Students with low attendance" = students with fewer than 10 recorded present days in the selected month (recorded days only, no scheduled-day coverage).
  Migrations (all idempotent text patches or additive, each ends in `NOTIFY pgrst`; apply in this order, each in its own transaction with `supabase/activation/seal.sql` and a ledger row, Preview only; the five-migration dry run passed and rolled back on Preview): `20261122140000_annual_recorded_days.sql` (`recorded_days` in the `annual_centres` source, sort key `days`), `20261122150000_profile_default_sort.sql` (profile sort key `default`: centre A-Z, Morning before Evening, grade 1-10, name), `20261122160000_enrolment_promoted_status.sql` (adds `Promoted` to the enrolment and academic-profile status checks, shows it in `student_academic_history`, new `mass_api.promote_student(p_enrolment,p_expected,p_grade,p_start,p_shift,p_centre)` gated by `enrolments`: closes the open enrolment as Promoted on a 1 April and opens the next-grade enrolment atomically), `20261122170000_assessment_register_per_round.sql` (assessment register source grouped by centre, shift and round: latest date, summed students, student-weighted average), `20261122180000_visit_conducted_by.sql` (column `cluster_officer_visits.conducted_by`, `mass_api.visit_conductors(uuid[])`, `record_visit` gains `p_conducted_by`; the old signature is dropped; it must follow the Phase 8 migrations, so the portable test applies it after them). `seal.sql` and `API-GATES.csv` list `promote_student`; `visit_conductors` is in the seal allow-list only.
  After applying: (a) turn on `enrolments` and `morarji` on Preview with an approval reference (both are allowed by the migration of 22 November but still OFF), (b) check in the browser as Leadership, Cluster Officer and Teacher: Student profiles Add Enrollment (Promoted shows in the history), Assessments entry (centre, shift, date, one table, marks prefilled for an existing register) and register Edit/Delete, Visits "Visit conducted by" and the log column, Morarji Add Record and Edit, Annual donor "Attendance Recorded For (Days)", chart 2.2.
  Frontend: `web/src/profiles/StudentDialogs.tsx` (`AddEnrolmentDialog`, `nextYearStart`; button shows when the server reports `writes.enrolments`), `web/src/assessments/{EntryDialog,editor,service}.ts*` (shift in the start step, Grade/Student name/Gender/Marks table, a changed saved mark is a correction that keeps its date and sends its version; `assessment_corrections` maps to `assessment_entry` once governed, so no switch change is needed), `web/src/pages/Assessments.tsx` (register 4.9 one row per centre+shift+round, Edit only, Delete inside the edit dialog, multi-date deletion), `web/src/visits/{VisitDialog,service}.ts*` and `pages/Visits.tsx` (conducted-by field after Visit Date, hidden when the function is missing; log column), `web/src/morarji/{MorarjiDialogs,service}.ts*` and `pages/Morarji.tsx` (Add Record, Edit outcome, disclaimer removed), `pages/Attendance.tsx` (low-attendance scorecard), `pages/AnnualDonor.tsx` (days column).
  Known limits: historic assessment results with no observed date are not returned by `read_assessments` for a year window, so such a student shows blank in the edit dialog (existing behaviour); the visit dialog is create-only, so `conducted_by` is not editable after saving; historical visits show an unknown conductor; the Preview `browser-acceptance` CI job fails with `permission denied for table user_scope_grants` (a fixture still using the legacy table after Phase 8; it fails on `staging` as well).
  Production needs a gated release of every migration since `20261117180000` (see the WS2 note) plus these five; nothing here touches Production.
- **WS4 release:** each stage updates this file; every database change is a reviewed migration (dry run, Preview only) and Production needs a separate gated release.

### Pending tasks for later (owner-requested, not started)
- **Caching strategy.** Work out how to optimize caching for the application: whether to use Vercel's own caching (CDN caching headers for the static assets, anything at the edge), and whether to add a client-side store/cache inside the React app (for example TanStack Query or a small store) so screens reuse data instead of refetching (today only the Overview reports and student rosters have small in-memory caches). Measure first; keep the 30-second scope re-verification and never cache across users or roles.
- **DONE (14 Nov): every role sees all eight numbered menu items; unavailable ones are greyed out, not links, with an accessible reason** (`unavailableReason` in `web/src/app/SideMenu.tsx`: Leadership has no 3 Student profiles, Teacher has no 5 Visits, only Leadership has 7 Annual donor summary).
- **DONE (15 Nov, `perf/request-reduction`): returning to an already-loaded screen makes no database requests** (read-through cache in `web/src/session/readCache.ts`, 5 minutes, cleared by any save, sign-in/out and role change). Only the 30-second scope check and the tab-visible re-verification still run, by design. See `docs/perf/TAB-SWITCH-RESULT.md`.
- **Request and database-CPU reduction (done on Preview, PR #19, branch `perf/request-reduction`, base `perf/overview-load-and-ui-rebuild`).** Plan and per-phase results: `docs/perf/REQUEST-REDUCTION-PLAN.md`, `PHASE-A/B/C0/C1-RESULT.md`, `TAB-SWITCH-RESULT.md`. A (client): startup reads shared per session, shared Overview/Profiles/Morarji services (`web/src/data/shared.ts`). B: migration `20261114120000_batched_reads.sql` (`visit_coverage`, `read_visits_v2`, `morarji_followup`, `student_profile_page_v3`, `reviewed_attendance_by_centre_month`). C0: `20261114130000_reviewed_chart_metrics_efficiency.sql` (function now in the migration history, includes Production's H patch; upgrades only where installed, so a fresh database applies the proposal and then this file, as `tests/release/portable-sql.mjs` does). C1: `20261114140000_reviewed_shift_counts.sql`. C2 (rollup) skipped by the owner; D (compute size) only if the Supabase CPU graph shows throttling. Revisits: `web/src/session/readCache.ts` caches read-only RPCs for five minutes in memory, cleared by any save (`CACHED_READS` lists what is cached; add new read functions there, never version tokens or records opened for editing). The client uses each new function when present and falls back on 404/PGRST202 (`web/src/lib/batched.ts`, `web/src/test/legacy.ts` for fallback tests). Applied to the PREVIEW database only (dry run first, then migration plus `seal.sql` in one transaction); **Production is unchanged: the three migrations need the gated release**. Results on Preview: one cold pass through every screen 225/61/38 requests (Leadership/Cluster Officer/Teacher) down to 34 each; moving between screens 219/54/29 down to 6/7/7; returning to a loaded screen 0; Annual donor 12.4 s to 1.2 s; `reviewed_chart_metrics` 92 centres 1.24 s to 0.18 s. Still open: the gated Production release, an Overview cold time of about 2 s for Leadership, and the shared-CPU Preview database's run-to-run noise (Phase D evidence). The 30-second scope check and tab-visible re-verification are intentionally never cached.
- **Superseded by the 20 November permission work:** Leadership operational/profile access is implemented on the permission branch and Preview as described below. Production remains unchanged pending a separately approved release.

## Permission architecture Phases 1–6 (20 November 2026)

This section records the Phases 1–6 cutover on `fix/permission-architecture` and Preview Supabase. The current handoff at the top of this file supersedes the original branch, deployment, and next-phase status.

Plan and release evidence:

- `docs/PERMISSION-ARCHITECTURE-MIGRATION-PLAN.md`
- `docs/PERMISSION-ARCHITECTURE-REMAINING-WORK.md` (colleague handoff, remaining Phases 7–8, acceptance and release boundaries)
- `docs/releases/2026-11-20/PERMISSION-PHASE-6-FRONTEND-CUTOVER.md`

### Completed phases

1. **Governance foundation** — `20261118120000_permission_governance_foundation.sql` adds private forced-RLS application users and centre assignments, exactly one role per user, Active/Inactive authorization status and deterministic backfill. Assignment dates remain administrative history rather than access switches.
2. **Scope reconciliation** — `20261118130000_permission_scope_reconciliation.sql` compares the new governed role/scope with the prior model and fails closed on drift.
3. **Read cutover** — `20261118140000_permission_read_cutover.sql` makes the governed model authoritative for reads, returns one server role, limits Teacher/Cluster Officer access to active centre assignments and gives Leadership global read scope. Current enrolment controls identifiable student access.
4. **Write cutover** — `20261119120000_permission_write_cutover.sql` applies the Teacher → Cluster Officer → Leadership hierarchy to operational writes. Leadership inherits operational writes globally; Cluster Officers can work across their active centres, including CO visit authority. Legacy operational overrides are retired from authority.
5. **Destructive workflows** — `20261119150000_permission_destructive_workflows.sql` adds narrow, versioned and idempotent deletion APIs for attendance marks/registers, assessment results/registers, visits and Leadership-only student cascades. Student deletion previews dependent counts, requires exact confirmation and a reason, deletes dependent student records transactionally and retains only a minimal non-PII receipt. Direct table deletion remains unavailable.
6. **React frontend cutover** — `20261119180000_permission_frontend_cutover.sql` and `web/` remove the role switcher, consume one server-selected role, drive navigation from capabilities, expose inherited Leadership operational screens, restrict official bulk export to Leadership in both UI and server functions, connect the reviewed deletion confirmations and terminate the local session after a 401/403 authorization failure. Retryable deletions retain one request ID.

### Current rules and boundaries

- One application user has exactly one role: Teacher, Cluster Officer or Leadership.
- Teacher: at most one active centre; operational CRUD within that centre, subject to record-specific validation and activation gates.
- Cluster Officer: multiple active centres; inherits Teacher operations in those centres and can delete any visit in an assigned centre regardless of creator.
- Leadership: no centre assignments; global current/future-centre scope, inherited operational capabilities, student cascade deletion authority and official export capability.
- Active/Inactive status controls authorization immediately. `starts_at` and `ends_at` are retained as history but do not grant or revoke access.
- Database functions and RLS remain the security boundary. Hidden buttons are not treated as authorization.
- Preview activation values were preserved during Phase 6: `assessment_entry=true`; `attendance_entry=false`, `visit_entry=false` and `student_deletion=false`. Do not enable them without separate owner approval.
- Historical Phase 6 boundary: only React at `/` changed then. The later separately approved removal deletes the retired interface instead of retrofitting permission UI into it.
- Any future Preview database change still needs explicit owner approval and a reviewed migration. Production remains out of scope until a separately approved release.

### Validation snapshot

- `npm run web:typecheck`: passed.
- `npm run test:web`: 27 files, 207 tests passed.
- `npm run lint -- --no-cache`, `npm run check`, `npm test`, `npm run build`: passed; the existing frontend suite reported 137 tests and 27 workflow/removal checks.
- `npm run test:sql:portable`: passed, including the governance, read/write cutover, destructive-workflow and frontend export-gate assertions plus 1,440 calculation parity cases.
- Preview postflight confirmed all Phase 1–6 migration behavior, closed anonymous/service access where required, zero reconciliation drift, Leadership-only export-sized reads and the attendance record identity needed for narrow deletion.
- Production postflight confirmed the Phase 6 migration and its new function behavior are absent.

### Next phases from the Phase 6 handoff

- Phase 7 introduced protected Leadership user, role, and assignment administration. The current handoff above records its deployment and acceptance status.
- Phase 8 is complete on Preview; legacy authorization evidence remains retained and Production remains unchanged.
- The separately approved `/vanilla/` removal is deployed and accepted on the protected branch Preview. Production remains unchanged.
