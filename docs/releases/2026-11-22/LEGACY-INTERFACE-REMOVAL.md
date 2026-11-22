# Legacy interface removal

**Prepared:** 22 November 2026  
**Branch:** `fix/permission-architecture`  
**Scope:** frontend/build/routing only  
**Deployed commit:** `4c9ef08`
**Production:** unchanged

## Change

The Vite/React application is now the sole build output and sole interface at `/`. The retired `src/index.html` and `src/entry.js` entry point, legacy-only browser and visual workflow suites, `/vanilla` redirect, and legacy performance script were removed. The build cleans `dist/`, produces no `dist/vanilla`, and marks releases with `legacyRemoved: true`.

Shared browser-safe modules under `src/live/` remain because the React application imports them. Isolated API compatibility fixtures remain where current security suites use them; they do not create a deployable legacy route.

## Security and behavior

- No database migration, Auth setting, feature gate or programme record is changed.
- Supabase credentials remain public publishable configuration only; no service-role material is added to the browser or build.
- Server authorization, immediate revocation and Leadership administration boundaries are unchanged.
- A request to `/vanilla` or `/vanilla/` must return 404 on the protected Preview.

## Rollback

Rollback is a Git revert of this frontend-only commit followed by a Preview rebuild. It does not require a database rollback. Historical source remains recoverable from Git; hosted legacy authorization rows remain untouched.

## Validation

- `npm run lint -- --no-cache`
- `npm run check`
- `npm test`
- `npm run web:typecheck`
- `npm run test:web`
- `npm run build`, including absence of `dist/vanilla`

## Protected Preview acceptance

Vercel reported the exact removal commit Ready and aliased `dev-mass-cac-dashboard.vercel.app` to it. `/release.json` identifies the full commit, `ui: react`, `legacyRemoved: true`, Preview environment and the Preview Supabase project; it contains no `legacyPath`. Both `/vanilla` and `/vanilla/` return 404.

Fresh Preview Auth sessions for Leadership, Cluster Officer and Teacher each reached Overview with the expected role, received role-correct User administration visibility, opened About, had no retired-interface link and signed out. There were no page errors or failed application responses before sign-out. The managed desktop browser-control tool was unavailable, so the documented cloud-desktop fallback used headless system Chromium against the actual protected domain. Permission-restricted temporary session, asset and browser files were removed after the run.

A final read-only Production query found zero Phase 8 ledger versions and no `application_users` or `administration_events` tables. No Production code, database, Auth or Vercel setting changed.
