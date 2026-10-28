# Phase 4 — frontend integration and finalized read APIs

## Source and production boundaries

Working branch: **feature/supabase-frontend**, based on database release `15cbc3f2a417c13201aa60ee053d7b92a0bd8444`. Manager-approved frontend source: **migration/frontend @ 0b57ea193e5dd8decb9a451d0b1cea44e22322fb**. Its app.js, style.css, data/dropout helpers and assets are preserved; the original entry-workflow test and review document are included. Files were adopted explicitly without merging branches. Live modules reuse the approved layout, CSS, logo/icons, cards, tables, modal patterns and navigation; old sample logic remains isolated in explicit demo mode.

The user confirms the 15 baseline migrations are deployed to pbkwpfdpdtelmvbkzgvx (Mass CAC Dashboard, Mumbai). This work did **not** query or modify the hosted database, import records, create accounts/scopes, change Vercel, merge PR #1 or execute hosted SQL. The integration branch was subsequently published at user request; finalization is also authorized for GitHub publication, with Vercel skip rules user-verified for this branch. Production configuration/managed Auth were not independently verified here.

All 15 existing SQL files remain byte-for-byte unchanged. Migration **016** is now finalized at `supabase/migrations/202610280016_frontend_reads.sql`, byte-identical to the preserved proposal snapshot. MIGRATIONS.sha256 appends only the new entry. [Read contracts](PHASE-4-READ-API-CONTRACTS.md) explain its nine invoker RPCs, one helper, six column-level SELECT grants and one own-active-scope SELECT policy. Original 71 policies/19 definers remain unchanged; the local post-016 total is 72 policies/20 mass_api functions, with the same 23 tables/155 columns/27 FKs. See [the authoritative deployment handoff](MIGRATION-016-DEPLOYMENT-HANDOFF.md). This promotion/publication is not authorization to execute hosted SQL.

## Implemented application behavior

- Official Supabase JS SDK handles password sign-in, session persistence/refresh and local-session sign-out. Session identity is verified through Auth getUser, not accepted from browser storage or business-role claims. No signup, staff provisioning, scope mutation, admin-client flow or service key is used.
- Only Auth session material is kept in sessionStorage for this tab. Programme records are held in memory, never copied from the sample localStorage key, and cleared on authentication checks, identity changes, sign-out and failed scope refresh. In-flight reads are aborted/epoch-guarded; an old account's late response cannot restore its records. Signing out hides protected content immediately and prevents a new login until SDK/local credential cleanup finishes. Provider revocation may fail on a network error; JWT access-token lifetime remains a provider property.
- The production project URL is pinned and the browser key must have the publishable format. Service-role/secret/legacy JWT keys are rejected. Build-time public config is injected into the browser bundle, not saved in source or the source ZIP. No actual key was supplied or committed.
- Baseline mode uses only existing list_students and attendance_summary with user-provided centre IDs and server enforcement. It is deliberately read-only because the deployed 11 RPCs do not discover scopes, business roles, revisions or reference history. It never silently loads demo data.
- frontend-reads-v1 mode requires finalized migration 016 and validates its API version/current user ID before loading. Actual centres, role/capability flags and private-field rights come from the server. Leadership has no write controls; teachers/COs get edits only on a selected writable centre. Combined reports are per-authorized-centre reads; select one centre before writing. Staff role preview exists only in demo.
- Supported live workflows include permanent-ID registration, explicit historical assignment add/close, profile/history viewing, attendance entry and correction, recorded assessment score entry/correction, named single-shift event creation, individual participation correction, Morarji membership/outcomes and real scoped dashboard filters. Gender filtering is offered only with profile capability; private fields are still filtered by backend RLS. Historical grade/shift filters use the fact's enrolment episode rather than rewriting history.
- Attendance uses P/(P+A+L), with WO/MM/confirmed holidays excluded and zero denominator unknown. Missing marks never become Absent. Repeated status taps are no-ops. Calendar confirmation is not fabricated session delivery. Dates/periods/cohorts use explicit records; no static TODAY, cohort/year fill, F-to-Q alias, score rescaling or donor mapping is used in live mode.
- Writes pass actual revisions. Conflicts reload and ask for review; ambiguous network saves reload without automatic retries. API error detail/hint/tuple payloads are discarded so personal values are not copied to UI/logs. Inputs retain approved controlled values and whole-mark 0–25 entry; stored numeric results are displayed without rescaling.

## Workflow coverage and unsupported operations

The [34-row workflow mapping](PHASE-4-FRONTEND-API-MAPPING.csv) covers the original 23 interactions, eight manager-approved record-management types, undo and Auth/discovery. Supported corrections use typed existing RPCs. **Read APIs do not authorize new mutations.**

Unsupported live workflows are clearly unavailable, never replaced with a client-only save or private-table call:

- Every removal, cascade, clear/delete-to-unrecorded and undo-restore operation. The backend rejects deletion and audits revisions without a recoverable before-value archive. No live record snapshot is stored in the browser. Participation NULL is a recorded response, not row deletion.
- Name/gender/board/profile-note corrections, enrolment reopening or silent context overwrite. Historical add/first closure are available with explicit dates, original revisions and server history checks; closure labels the first day outside an episode instead of silently converting a legacy exit date.
- Atomic bulk attendance/participation/results, grouped comments, Absent/clear assessment statuses, assessment date/context retagging, routine repeat attempts, F aliases and unapproved comparison/band rules.
- Activity category/catalogue/delivery status, Both-shifts auto-splitting, immutable event detail editing/removal; CAC Planned/Held/Cancelled delivery writes and H/calendar authority.
- Follow-up/private notes, visits and guidance modules, richer Morarji training/selection/admission/scholarship fields, automated dropout/engagement rules and school-result reporting.
- Student/donor exports or print reports without independent entitlement/disclosure/audit approval. [Donor reporting](PHASE-4-DONOR-REPORTING-PROPOSAL.md) is a separate unimplemented addition requiring donors and centre_funding; sample funding assumptions are never used live.

All original sample features, including managed removal/undo, remain in the preserved demo app. They cannot reach Supabase. No historical workbook/source discovery was repeated.

## Environment and existing Vercel project

Use the existing mass-cac-dashboard project; do not create/reconnect another project. Current scripts remain a static vanilla-JS frontend with an esbuild bundle, no UI framework or SSR. Node 22+ is required by the SDK; **Node 24.x** remains the intended Vercel runtime. Repository root; Framework Other; build `npm run build`; output `dist`. `npm ci` must install build-time dev dependencies (esbuild); use `npm ci --include=dev` only if the approved build environment otherwise omits them. No Vercel command/settings change was executed here.

| Build variable | Value / purpose |
| --- | --- |
| MASS_APP_MODE | live for authenticated UI; demo explicitly opens the original browser-local sample app. |
| MASS_SUPABASE_URL | https://pbkwpfdpdtelmvbkzgvx.supabase.co |
| MASS_SUPABASE_PUBLISHABLE_KEY | Approved project publishable key, configured outside Git. No secret/service-role key or database credential. |
| MASS_READ_API | baseline for the deployed 11-RPC read-only adapter; frontend-reads-v1 only after separately approved migration 016 is applied/verified. |

See .env.example. The build reads environment variables; it does not automatically load .env files. A live build without URL/key shows a configuration gate and performs no Auth/data requests; partial/unsafe configuration fails the build. Browser runtime cannot read Vercel environment directly: changing these values requires a reviewed rebuild. Demo mode is explicit, never an error fallback or a production data reset.

## Local verification and its limits

```sh
npm ci
npm run check
npm test
npm run test:api
npm run test:browser
npm run build
sha256sum --check supabase/compatibility/MIGRATIONS.sha256
sha256sum --check supabase/proposals/FRONTEND-READS.sha256
```

- npm tests include pure validation/session/history/calculation/contract tests and the manager-approved 27 callback-level workflow/removal/undo checks.
- Chromium tests intercept **all** Auth/REST traffic; they cover login, server-derived access, restore/refresh, logout/network failure, zero scores, corrections/409/uncertain responses, profile XSS escaping, participation/Morarji, masks, mobile navigation, demo removal/undo and fail-closed configuration. They test UI behavior, not managed Auth or real hosted permissions.
- `test:api` uses a fresh synthetic PG 17.11 + real PostgREST 13.0.7 + actual Supabase SDK client on a Docker-internal network, no host ports/mounts or external target URL. It explicitly applies the 15 unchanged migrations, synthetic fixture and finalized migration 016, then validates centre/role/private-field boundaries, own-scope RLS, revocation, bounds, inherited BYPASSRLS rejection, SDK RPC writes/read-back and stale revisions. Auth users/issuance/JWT signing are test-only; no production project credentials are read.
- The original 207 foundation/core/HTTP checks are retained and pass; original 15 catalog/manifest consistency remains intact. No actual staff accounts, personal source records or cloud resources were used. npm audit reported no vulnerabilities at verification time.
- The source archive remains code-only and excludes runtime dist config/keys, Supabase SQL, backend fixtures, raw workbooks and dumps. The complete Git checkout is required for database/API tests; the frontend ZIP is for rebuilding/running the UI with its included environment example and approved sample test.

Verification results for this local review:

| Check | Result |
| --- | --- |
| Frontend unit/contract/session tests | 16 passed |
| Preserved manager workflow/removal/undo checks | 27 passed |
| Chromium UI checks, all remote traffic intercepted | 32 passed |
| Read API SQL/security assertions | 59 passed |
| Real SDK/PostgREST synthetic integration checks | 18 passed |
| Unchanged baseline behavioral checks | 207 passed |
| Finalized catalog | 23 tables, 155 columns, 27 FKs, 72 policies, 20 API functions, 19 unchanged definers |
| Syntax/build and both SHA-256 manifests | Passed |
| Dependency audit | 0 vulnerabilities |
| Credential/private-artifact scan | Passed; no real source records or private workbooks added |

Managed GoTrue login, provider JWT issuer/JWKS/session expiry/revocation, actual Data API exposure and real staff scopes remain **unverified**. Browser mocks and a local signed-token server do not establish them. Full provider testing needs an appropriately isolated, explicitly approved target/configuration and synthetic identities; no new cloud target or production test account is authorized implicitly.

## Exact remaining release sequence

1. Review the finalized migration release and [016 deployment handoff](MIGRATION-016-DEPLOYMENT-HANDOFF.md), including read-security evidence and recovery gates. The reviewed SQL is now in normal migration discovery; do not run an unattended hosted push.
2. Separately authorize an approved isolated managed target for real Auth/session/provider-role validation; local synthetic Auth is not managed Supabase certification.
3. Before any hosted SQL, separately approve target/release/operator and actual private backup/recovery evidence. Verify the pending ledger contains **016 only**, and follow the error-stop deployment/postflight sequence. Never replay/reset/repair 001–015.
4. An authorized administrator later provisions only approved non-personal centre/reference data, Auth identities and verified role/centre grants. No provisioning or personal-data import is included here; an empty/unassigned account remains empty/unassigned.
5. Review Data API configuration: expose the reviewed mass_api surface, never mass_core/mass_foundation/auth. Resolve actual privacy/retention/historical entitlement and programme eligibility gates before operations. Password recovery/OAuth/MFA are not claimed implemented or tested.
6. The user verified Vercel Ignored Build Step skips feature/supabase-frontend and feature/source-data-discovery. This authorizes GitHub publication only; no manual Vercel deployment/settings change or merge is included. Independently verify automatic build cancellation where Vercel access is available.
7. Only after backend/config/account gates, separately authorize Preview using live + frontend-reads-v1 and an approved publishable key; validate real Auth, masking/read-only access, centre isolation and workflows. Production activation remains a separate release decision.

**Status:** implementation and additive migration finalized for review; **NO-GO for production frontend activation/deployment now**. The fifteen production migrations, hosted project, staff grants, production frontend, Vercel settings and PR #1 remain unchanged. The pre-existing uncommitted Phase 3E assessment remains preserved outside this commit.
