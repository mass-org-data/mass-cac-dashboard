# MASS CAC Dashboard — frontend and local database

This package preserves the current frontend implementation, design, logo, styling, chart references and interactions. The application is vanilla JavaScript with HTML and CSS, **not React**; there are no React components or React dependencies to omit. No framework migration has been performed.

The repository also contains **15 SQL migrations implementing 23 local database relations** (six foundation and 17 core), isolated synthetic tests, and current schema/security documentation. The frontend is still a standalone prototype; it has not been connected to Supabase. No hosted database deployment is authorized or performed by the local commands below.

## Database development and tests

Prerequisites: a working Docker daemon, Bash and Python 3 available as `python`. Images are digest-pinned; the first run may download public development images. No new npm dependency or Supabase credentials are required.

```sh
bash tests/foundation/run-local.sh
MASS_TEST_REST=1 bash tests/core/run-local.sh
bash tests/schema/run-local.sh
bash tests/deployment/run-local.sh
bash tests/deployment/run-role-probe.sh
```

The first suite applies the original six foundation migrations. The second applies all 15 and runs synthetic core SQL/concurrency tests plus a real PostgREST HTTP suite with ephemeral signed test JWTs. The third checks the complete dictionary, ERDs, policy/ACL inventory and migration checksums against an independently migrated local catalog. All runners create disposable databases, use temporary storage, accept no hosted database URL and remove their containers on exit. SQL-only core testing (`MASS_TEST_REST=0`) does not verify API behavior.

The existing behavioral suite has **207 checks**: 87 foundation, 102 core SQL/concurrency/attribution and 18 signed-token API checks. Managed Supabase Auth is represented by a test-only stub; these results do **not** verify real signup/login/session refresh or the hosted project. Full local Supabase startup was blocked by an image-registry `Forbidden` response. See [compatibility evidence](docs/PHASE-3C-COMPATIBILITY.md).

The deployment suite additionally verifies the read-only preflight/postflight reports against a fresh closed installation, 15 catalog/security invariants, effective ACLs, initial reference data and failed-file rollback/retry. It never accepts an existing database target. See the [Phase 3D validation and deployment checklist](docs/PHASE-3D-DEPLOYMENT-VALIDATION.md) for current evidence, remaining hosted gates and the exact migration sequence.

The [final production preflight](docs/PRODUCTION-MIGRATION-PREFLIGHT.md) freezes all 15 [SQL hashes](supabase/compatibility/MIGRATIONS.sha256), reviews [all 19 SECURITY DEFINER functions](docs/PRODUCTION-DEFINER-REVIEW.md), and prepares a private Free-project backup/recovery procedure. The deployment suite also verifies all 22 non-reference tables are empty and restores a synthetic custom-format archive in isolation. These checks do not establish managed Supabase compatibility or authorize hosted execution.

The separate role probe reproduces the original PostgreSQL 17 failure in temporary legacy copies, then applies all corrected files as an isolated non-superuser with delegated Auth privileges and default creator settings. Migrations 01 and 07 explicitly grant SET/INHERIT membership on their new owner roles only to the deployment principal. Rollback/retry and effective owner membership are tested without a createrole_self_grant override. See the [role-membership correction and deployment handoff](docs/POSTGRES17-ROLE-MEMBERSHIP-FIX.md); actual managed-provider permissions remain a separate gate.

- [Implemented dictionary: columns, types, PKs/FKs and constraints](docs/DATABASE-DATA-DICTIONARY.md)
- [Complete implemented ER diagrams](docs/DATABASE-ERD.md)
- [Exact implemented security/RLS and grants](docs/DATABASE-SECURITY-IMPLEMENTED.md)
- [Machine-readable schema and SQL checksums](docs/DATABASE-SCHEMA-INVENTORY.json)
- [Deferred relations and preserved 43-relation proposal](docs/DATABASE-DEFERRED-RELATIONS.md)
- [Core implementation handover](docs/PHASE-3B-CORE-HANDOVER.md)
- [Deployment gates and the approval-dependent apply sequence](docs/PHASE-3C-DEPLOYMENT-READINESS.md)

SQL under `supabase/migrations/` is authoritative and stays in filename order. Never run `tests/core/bootstrap.sql`, test fixtures or local role stubs on hosted Supabase. The frontend source-download ZIP is frontend-only; database migrations/tests are delivered through Git. Changes to SQL require reviewing schema documentation and running `bash tests/schema/run-local.sh --write` followed by the default check; this command still uses only a new local database.

## Deploy through the existing Vercel project

Use the existing GitHub repository `mass-org-data/mass-cac-dashboard` and existing Vercel project `mass-cac-dashboard` (ID `prj_MvZqQP2cdpRce7NxWR1JzvBsIBdL`). Do not create or import a replacement project.

In that project's Settings, inspect its Git connection and deployment triggers before any push. Connect this repository if needed, retain `main` as the intended production branch, and use a separate migration branch for preview validation. Do not push or merge to `main` before the preview is validated.

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | Repository root (`.`); files are not nested under `MASS-Frontend/` |
| Node.js | 24.x (local validation: 24.19.0) |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None required for this prototype |

The included `vercel.json` specifies no framework, the build command, output directory, and clean URLs. Navigation is in-memory view switching, not browser pathname routing; no SPA fallback rewrite is needed for the existing behavior. Refresh returns to the initial view.

Only after separately authorizing a preview deployment and inspecting existing settings, push a non-production frontend branch such as `migration/frontend` and validate its preview. During database-only publication phases that prohibit Vercel deployment, a verified skip rule must cover the branch and PR before pushing; branch naming alone does not suppress deployments. Check all three role views, filters, charts, forms, browser-local persistence, downloads, mobile navigation, and browser errors. Vercel preview availability and production settings have not been verified from this environment; see [migration findings](docs/MIGRATION.md).

Use Node.js 24.x for a consistent runtime. The supplied package supports Node.js 20 or newer, with no third-party runtime or build dependencies. `npm ci` installs no packages. No environment variables or API keys are required, so no `.env.example` is needed. `PORT` optionally changes the local development server port only.

## Run locally

```sh
npm ci
npm run check
npm run build
npm run dev
```

Open `http://localhost:3000`. Set `PORT` if a different port is required. The local server serves the built `dist/` directory. Serve over HTTP rather than double-clicking index.html: browser ES modules require HTTP.

## Files

- `src/index.html`: HTML entry point.
- `src/app.js`: complete page rendering, navigation, charts, role previews, forms and browser-local persistence.
- `src/data.js`: fictional sample data, programme helpers and bands.
- `src/dropout.js`: derived CAC dropout classification.
- `src/style.css`: full responsive styles and print styles.
- `src/mass-logo.jpg`: locally bundled MASS logo. Other bundled JPEGs are preview assets.
- `scripts/build.mjs`: copies the unchanged frontend into `dist/` and generates the source-download ZIP used by the prototype.
- `scripts/zip.mjs`: dependency-free ZIP writer for that download.
- `scripts/serve.mjs`: dependency-free local static server.
- `vercel.json`, `package.json`, `package-lock.json`: deployment/build configuration.
- `docs/PROJECT-NOTES-HISTORY.md`: original accumulated project notes; older entries can describe superseded versions. Source files are authoritative for current behaviour.
- `docs/EXPORT.md`: scope and verification of this export.

The outer ZIP also includes a ready-built `dist/` folder. You can serve it with any static HTTP host. The app’s existing “Download Vercel-ready source” action is preserved: the build produces its downloadable archive from the source files, without recursively embedding previous ZIP files.

## Data and integration boundaries

This is a frontend prototype. It uses fictional sample records generated in `src/data.js` and saves edits in this browser’s localStorage (`mass-cac-companion-v1`). It does not depend on ChatGPT hosting and contains no access tokens, server secrets or private MASS records. Records previously entered on a different website/origin are not carried into this archive or transferred to a new Vercel domain.

The role selector is a preview, not authentication or a permission boundary. Live data, database integration, secure role/centre access, cross-device persistence, audit history and server pagination require a backend. Pagination in this version is client-side. Versioned local database migrations and tests are included, but the frontend has no live Supabase connection or credentials.

The demo operating date remains fixed at 20 October 2026, as in the source; it has not been switched to today. Existing calculations and business-rule caveats are preserved. Deployment readiness here means the frontend can be built and hosted independently, not that it is ready to store real student data.

## Validation

`npm run check` checks JavaScript syntax; it is not a type checker or linter. No frontend type-check or lint suite is configured. The separate automated database suites are described above. Migration verification additionally exercised the actual local server in Chromium; results and remaining deployment checks are recorded in [docs/MIGRATION.md](docs/MIGRATION.md).

Keep `dist/`, `node_modules/`, `.vercel/`, and environment files out of Git. The build intentionally generates a publicly downloadable source archive to preserve the existing prototype feature. Never put credentials or private data in `src/`, `scripts/`, `docs/`, or other archive inputs.
