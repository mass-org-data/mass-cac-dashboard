# MASS CAC Dashboard — frontend and local database

This package preserves the current frontend implementation, design, logo, styling, chart references and interactions. The application is vanilla JavaScript with HTML and CSS, **not React**; there are no React components or React dependencies to omit. No framework migration has been performed.

The repository contains the **17 SQL migrations implementing 26 relations** (001–016 user-confirmed deployed; 017 finalized locally, not hosted-applied), isolated synthetic tests, and schema/security documentation. Phase 4 adds authenticated Supabase adapters and a live workspace, preserving the manager-approved sample frontend from `migration/frontend @ 0b57ea1`. [Directory migration 017 and handoff](docs/MIGRATION-017-DEPLOYMENT-HANDOFF.md) add donor/staff associations and scoped UI; actual five-sheet reconciliation remains blocked by source access. The reviewed read API is finalized at `supabase/migrations/202610280016_frontend_reads.sql`; the exact original proposal remains as a historical snapshot. Hosted execution is not authorized by publication. See [016 deployment handoff](docs/MIGRATION-016-DEPLOYMENT-HANDOFF.md). No hosted change or Vercel release is performed by local commands below. See the [Phase 4 integration handoff](docs/PHASE-4-INTEGRATION-HANDOFF.md), [34-workflow mapping](docs/PHASE-4-FRONTEND-API-MAPPING.csv), [read API contract](docs/PHASE-4-READ-API-CONTRACTS.md) and [separate donor proposal](docs/PHASE-4-DONOR-REPORTING-PROPOSAL.md).

## Frontend modes and configuration

Use Node 24.x (the SDK requires Node 22+). `npm ci` installs the official Supabase JS SDK and build-time esbuild dependency. Browser configuration is injected at build time from environment variables; `.env.example` is a reference, not an automatically loaded dotenv file.

- `MASS_APP_MODE=live` (default): authenticated workspace, no sample fallback. Set `MASS_SUPABASE_URL=https://pbkwpfdpdtelmvbkzgvx.supabase.co` and `MASS_SUPABASE_PUBLISHABLE_KEY` outside Git. Only publishable keys are accepted; secret/service-role/legacy JWT keys are rejected.
- `MASS_READ_API=baseline` (default): uses the existing 11 RPC baseline for read-only lists/attendance totals; live editing is gated because no scope/history discovery is available.
- `MASS_READ_API=frontend-reads-v1`: full supported core flows, only after finalized migration 016 is separately authorized for hosted execution, applied and verified. It uses server-derived roles/centres, private-field RLS, real revisions and bounded reads. Removal/undo and other unsupported contracts remain disabled.
- `MASS_DIRECTORY_API=directory-v1`: separately opt in only after 017 is applied and verified, with live + frontend-reads-v1. Defaults to off; adds donor filtering/drilldown and scoped staff/shift directory, never financial reporting.
- `MASS_APP_MODE=demo npm run build`: original manager-approved sample app and its browser-local removal/undo/reset behavior. It never initializes Supabase or uploads local records.

An unconfigured live build shows a configuration screen without network calls or demo data. No real key is committed. No programme records are persisted to browser storage; Auth session material uses sessionStorage. Current Vercel production and the backend baseline remain unchanged.

```sh
npm run check
npm test
npm run test:api
npm run test:browser
npm run test:directory
```

The API tests use synthetic PostgreSQL/PostgREST/JWT fixtures in an internal Docker network; browser tests require Python Playwright and Chromium and intercept all Auth/REST requests. Managed Supabase Auth remains a separate validation gate. Original 001–016 migration bytes/hashes are unchanged; the manifest appends 017. Do not run an unattended hosted migration push. The pending hosted list must contain only 202610280017; no replay of 001–016.

## Database development and tests

Database-test prerequisites: Docker, Bash and Python 3 as `python`. Offline directory reconciliation additionally uses `openpyxl==3.1.5` from requirements-dev.txt (install in an isolated virtual environment); private workbook/mapping/output files must stay outside the checkout. Images are digest-pinned; first runs may download public development images. Baseline SQL tests need no Supabase credentials. The frontend API test also needs the installed npm dependencies and its pinned Node client image.

```sh
bash tests/foundation/run-local.sh
MASS_TEST_REST=1 bash tests/core/run-local.sh
bash tests/schema/run-local.sh
bash tests/deployment/run-local.sh
bash tests/deployment/run-role-probe.sh
bash tests/deployment/run-auth-probe.sh
```

The first suite applies the original six foundation migrations. The second applies the historical 001–016 baseline and runs synthetic core SQL/concurrency tests plus a real PostgREST HTTP suite with ephemeral signed test JWTs. The directory suite additionally applies 017 with a restricted non-superuser and exercises its APIs. The third checks the complete dictionary, ERDs, policy/ACL inventory and migration checksums against an independently migrated local catalog. All runners create disposable databases, use temporary storage, accept no hosted database URL and remove their containers on exit. SQL-only core testing (`MASS_TEST_REST=0`) does not verify API behavior.

The existing behavioral suite has **207 checks**: 87 foundation, 102 core SQL/concurrency/attribution and 18 signed-token API checks. Managed Supabase Auth is represented by a test-only stub; these results do **not** verify real signup/login/session refresh or the hosted project. Full local Supabase startup was blocked by an image-registry `Forbidden` response. See [compatibility evidence](docs/PHASE-3C-COMPATIBILITY.md).

The deployment suite additionally verifies the read-only preflight/postflight reports against a fresh closed installation, 15 catalog/security invariants, effective ACLs, initial reference data and failed-file rollback/retry. It never accepts an existing database target. See the [Phase 3D validation and deployment checklist](docs/PHASE-3D-DEPLOYMENT-VALIDATION.md) for current evidence, remaining hosted gates and the exact migration sequence.

The [final production preflight](docs/PRODUCTION-MIGRATION-PREFLIGHT.md) describes the original 15 [SQL hashes](supabase/compatibility/MIGRATIONS.sha256), reviews [all 19 SECURITY DEFINER functions](docs/PRODUCTION-DEFINER-REVIEW.md), and prepares a private Free-project backup/recovery procedure. The deployment suite also verifies all 22 non-reference tables are empty and restores a synthetic custom-format archive in isolation. These checks do not establish managed Supabase compatibility or authorize hosted execution.

The separate role probe reproduces the original PostgreSQL 17 failure in temporary legacy copies, then applies all corrected files as an isolated non-superuser with delegated Auth privileges and default creator settings. Migrations 01 and 07 explicitly grant SET/INHERIT membership on their new owner roles only to the deployment principal. Rollback/retry and effective owner membership are tested without a createrole_self_grant override. See the [role-membership correction and deployment handoff](docs/POSTGRES17-ROLE-MEMBERSHIP-FIX.md); actual managed-provider permissions remain a separate gate.

The [migration 007 Auth correction and resume handoff](docs/MIGRATION-007-AUTH-RESUME.md) supersedes fresh-install instructions for the reported production state with 001–006 already applied. The Auth-boundary probe uses direct Auth privileges without grant options, preserves committed foundation on failed 007 attempts, and resumes only 007–015. Managed Auth foreign keys are installed by the deployment principal; a private SQL SECURITY INVOKER wrapper preserves managed auth.uid() without delegating Auth-schema privileges or adding a definer.

- [Implemented dictionary: columns, types, PKs/FKs and constraints](docs/DATABASE-DATA-DICTIONARY.md)
- [Complete implemented ER diagrams](docs/DATABASE-ERD.md)
- [Exact implemented security/RLS and grants](docs/DATABASE-SECURITY-IMPLEMENTED.md)
- [Machine-readable schema and SQL checksums](docs/DATABASE-SCHEMA-INVENTORY.json)
- [Deferred relations and preserved 43-relation proposal](docs/DATABASE-DEFERRED-RELATIONS.md)
- [Core implementation handover](docs/PHASE-3B-CORE-HANDOVER.md)
- [Deployment gates and the approval-dependent apply sequence](docs/PHASE-3C-DEPLOYMENT-READINESS.md)

The current manifest covers 17 files; [the 017 handoff](docs/MIGRATION-017-DEPLOYMENT-HANDOFF.md) supersedes original-install counts. SQL under `supabase/migrations/` is authoritative and stays in filename order. Never run `tests/core/bootstrap.sql`, test fixtures or local role stubs on hosted Supabase. The frontend source-download ZIP is frontend-only; database migrations/tests are delivered through Git. Changes to SQL require reviewing schema documentation and running `bash tests/schema/run-local.sh --write` followed by the default check; this command still uses only a new local database.

## Deploy through the existing Vercel project

Use the existing GitHub repository `mass-org-data/mass-cac-dashboard` and existing Vercel project `mass-cac-dashboard` (ID `prj_MvZqQP2cdpRce7NxWR1JzvBsIBdL`). Do not create or import a replacement project.

In that project's Settings, inspect its Git connection and deployment triggers before any push. Connect this repository if needed, retain `main` as the intended production branch, and use a separate migration branch for preview validation. Do not push or merge to `main` before the preview is validated.

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | Repository root (`.`); files are not nested under `MASS-Frontend/` |
| Node.js | 24.x (local validation: 24.19.0) |
| Install command | `npm ci` with build-time dev dependencies included |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | `MASS_APP_MODE`, `MASS_READ_API`, `MASS_SUPABASE_URL`, `MASS_SUPABASE_PUBLISHABLE_KEY`; see Phase 4 handoff |

The included `vercel.json` specifies no framework, the build command, output directory, and clean URLs. Navigation is in-memory view switching, not browser pathname routing; no SPA fallback rewrite is needed for the existing behavior. Refresh returns to the initial view.

Only after separately authorizing a preview deployment and inspecting existing settings, push a non-production frontend branch such as `migration/frontend` and validate its preview. During database-only publication phases that prohibit Vercel deployment, a verified skip rule must cover the branch and PR before pushing; branch naming alone does not suppress deployments. Check all three role views, filters, charts, forms, browser-local persistence, downloads, mobile navigation, and browser errors. Vercel preview availability and production settings have not been verified from this environment; see [migration findings](docs/MIGRATION.md).

Use Node.js 24.x for a consistent runtime; Node 22+ is required by the official SDK. The app remains static vanilla JavaScript, bundled with esbuild. Live mode needs the public configuration above; demo mode needs no backend/key. `PORT` or `--port` changes the local development-server port only. Do not push this new feature branch until Vercel suppression or a later Preview is separately approved: the existing skip rule for `feature/source-data-discovery` does not automatically cover `feature/supabase-frontend`.

## Run locally

```sh
npm ci
npm run check
npm run build
npm run dev
```

With no live configuration, the default build displays the configuration gate. To inspect the preserved sample UI, build with `MASS_APP_MODE=demo npm run build`. Open `http://localhost:3000`. Set `PORT` if a different port is required. The local server serves the built `dist/` directory. Serve over HTTP rather than double-clicking index.html: browser ES modules require HTTP.

## Files

- `src/index.html`: HTML entry point.
- `src/entry.js`: validated live/demo entry point.
- `src/live/`: Auth/session handling, scoped API adapters and authenticated workspace.
- `src/app.js`: preserved manager-approved demo rendering, navigation, charts, role previews, forms and browser-local persistence.
- `src/data.js`: fictional sample data, programme helpers and bands.
- `src/dropout.js`: derived CAC dropout classification.
- `src/style.css`: full responsive styles and print styles.
- `src/mass-logo.jpg`: locally bundled MASS logo. Other bundled JPEGs are preview assets.
- `scripts/build.mjs`: bundles the selected frontend and validated public environment configuration into `dist/`, and generates the source-download ZIP.
- `scripts/zip.mjs`: dependency-free ZIP writer for that download.
- `scripts/serve.mjs`: dependency-free local static server.
- `vercel.json`, `package.json`, `package-lock.json`: deployment/build configuration.
- `docs/PROJECT-NOTES-HISTORY.md`: original accumulated project notes; older entries can describe superseded versions. Source files are authoritative for current behaviour.
- `docs/EXPORT.md`: scope and verification of this export.

The Git checkout excludes generated `dist/`. The app’s existing “Download Vercel-ready source” action is preserved: the build produces a code-only archive from source inputs, without runtime configuration or recursively embedded ZIP files. Rebuild the archive with approved environment configuration before serving it.

## Data and integration boundaries

Explicit **demo mode** uses fictional sample records from `src/data.js` and browser-local edits (`mass-cac-companion-v1`). Its role selector and fixed operating date remain unchanged. It never initializes Supabase or uploads sample rows. Records from other websites/origins are not transferred.

**Live mode** uses verified Supabase Auth identity and server-enforced scope. Programme data stays in memory; only the tab's Auth session uses sessionStorage. No role selector, sample fallback, imported browser snapshots or private-schema API calls are used. Baseline mode supports the existing read-only RPCs; the complete scoped workspace requires separate approval and deployment of proposed read API 016. Real Auth/provider behavior, staff scope provisioning and production activation remain release gates documented in the handoff.

## Validation

`npm run check` checks JavaScript syntax; it is not a type checker or linter. No frontend type-check or lint suite is configured. The separate automated database suites are described above. Migration verification additionally exercised the actual local server in Chromium; results and remaining deployment checks are recorded in [docs/MIGRATION.md](docs/MIGRATION.md).

Keep `dist/`, `node_modules/`, `.vercel/`, and environment files out of Git. The build intentionally generates a publicly downloadable source archive to preserve the existing prototype feature. Never put credentials or private data in `src/`, `scripts/`, `docs/`, or other archive inputs.
