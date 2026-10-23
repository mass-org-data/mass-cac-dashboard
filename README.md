# MASS CAC frontend — complete standalone source

This package preserves the current frontend implementation, design, logo, styling, chart references and interactions. The application is vanilla JavaScript with HTML and CSS, **not React**; there are no React components or React dependencies to omit. No framework migration has been performed.

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

After inspecting existing settings, push a non-production branch such as `migration/frontend` and validate its preview. Check all three role views, filters, charts, forms, browser-local persistence, downloads, mobile navigation, and browser errors. Vercel preview availability and production settings have not been verified from this environment; see [migration findings](docs/MIGRATION.md).

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

The role selector is a preview, not authentication or a permission boundary. Live data, database integration, secure role/centre access, cross-device persistence, audit history and server pagination require a backend. Pagination in this version is client-side. No Supabase backend or credentials are included.

The demo operating date remains fixed at 20 October 2026, as in the source; it has not been switched to today. Existing calculations and business-rule caveats are preserved. Deployment readiness here means the frontend can be built and hosted independently, not that it is ready to store real student data.

## Validation

`npm run check` checks JavaScript syntax; it is not a type checker or linter. No type-check, lint, or automated test suite is configured in the supplied project. Migration verification additionally exercised the actual local server in Chromium; results and remaining deployment checks are recorded in [docs/MIGRATION.md](docs/MIGRATION.md).

Keep `dist/`, `node_modules/`, `.vercel/`, and environment files out of Git. The build intentionally generates a publicly downloadable source archive to preserve the existing prototype feature. Never put credentials or private data in `src/`, `scripts/`, `docs/`, or other archive inputs.
