# Legacy interface removal

**Prepared:** 22 November 2026  
**Branch:** `fix/permission-architecture`  
**Scope:** frontend/build/routing only  
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

Protected Preview deployment and signed-in role acceptance are pending the approved branch push. Record the exact deployment commit and results here after acceptance.
