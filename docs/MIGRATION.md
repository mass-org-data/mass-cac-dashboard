# Phase 1 frontend migration

## Source and scope

Imported from the supplied `MASS-Frontend-Vercel-Source.zip`. Before import, the local checkout had no commits or files and the GitHub remote advertised no refs, including `main`.

This is a complete vanilla JavaScript ES-module application, not a React application. There are no third-party dependencies, backend calls, ChatGPT APIs, or external asset URLs in the application JavaScript and CSS. HTML loads `app.js`, which imports `data.js` and `dropout.js`; styles and four JPEG assets are bundled locally. Charts are rendered using HTML/CSS and inline SVG.

Views include overview, attendance, daily attendance, student profiles, learning, activities, Morarji scholarship preparation, officer visits, donor summary, and the retained optional Career Guidance preview. Navigation switches application state without changing browser paths. Pagination is client-side.

Data comes from the supplied deterministic fictional records and browser localStorage under `mass-cac-companion-v1`. The demo date remains 20 October 2026. Existing calculations, records, role previews, and business-rule caveats are unchanged. The role selector is not authentication. Storage is origin-specific; records entered on ChatGPT Sites will not automatically appear on a new Vercel origin. Use only fictional records during preview validation.

## Files and changes

- Imported all nine files under `src/` byte-for-byte: `app.js`, `data.js`, `dropout.js`, `index.html`, `style.css`, `mass-logo.jpg`, `preview.jpg`, `entry-preview.jpg`, and `morarji-preview.jpg`.
- Imported the package manifest and lockfile, three build/server/ZIP scripts, `vercel.json`, `.gitignore`, and both original documentation files.
- Excluded the supplied generated `dist/` and its nested ZIP from Git. The build regenerates these files, including the source-download ZIP used by the frontend.
- Updated the README to describe the existing Vercel project, preview-first deployment, and verified limitations. Added this migration record.
- Corrected only the local server's filesystem containment check: normalize the output directory and allow that exact directory as well as its descendants. The supplied helper rejected `/` because of a trailing-slash mismatch. The corrected check also rejects sibling directories. No frontend source or styling changed.
- No `.env.example` was added because the application needs no environment variables or credentials. `PORT` is an optional local server override.

No Supabase resources, schemas, authentication mechanisms, or new business rules were introduced. Existing historical notes are retained as documentation, not as implementation instructions.

## Validation

- `npm ci --cache /tmp/mass-npm-cache --no-audit --no-fund`: passed; no third-party packages required.
- `npm run check`: passed for all three application JavaScript files.
- `npm run build`: passed; generates `dist/` and the source-download ZIP.
- All nine imported frontend files match the source export byte-for-byte; built frontend files match the imported source.
- Archive integrity and local asset inventory were checked. A pattern scan found no private keys, common access-token formats, credential assignments, or sensitive environment/key filenames in the imported text files. This is a targeted scan, not an absolute guarantee that arbitrary text cannot contain sensitive information.
- Chromium checks passed against the actual local Node HTTP server: desktop rendering and charts; navigation through all available views for Leadership, Cluster Officer, and Teacher; centre filtering/reset; donor summary; follow-up form save and reload persistence; attendance toggle persistence; source ZIP link and archive fetch/integrity; optional Career Guidance preview; and mobile navigation at 390px width. No browser JavaScript/console errors or failed asset responses occurred in those exercised flows. Desktop and mobile screenshots were inspected.
- No type-checker, linter, or automated test suite is configured in the supplied package. These checks were not reported as passed. Browser checks were migration smoke checks using the environment's existing Python Playwright and Chromium, not newly installed application dependencies. They do not exhaustively validate every form or business rule.

Initial browser HTTP checks exposed the supplied server's root-path bug; they passed after the helper correction. Additional actual-server checks passed for the root and all nine static files, missing-file 404 responses, and traversal/sibling-path 403 responses. Native Chromium downloads of both the source ZIP (CRC and source-byte integrity verified) and CSV summary passed. Vercel must still be checked independently.

## Deployment status and next steps

No GitHub push or Vercel deployment was performed. No production configuration was modified. A local migration commit is prepared separately; `main` remains the intended remote production branch.

Vercel management tools and Vercel credential bindings were unavailable. Existing project settings, Git connection, deployment triggers, and preview deployment remain unverified. Use only project `mass-cac-dashboard`, ID `prj_MvZqQP2cdpRce7NxWR1JzvBsIBdL`; do not create a replacement. Exact build/runtime settings are in the README.

1. Inspect that project's existing Git connection, production branch, preview triggers, root, Node version, build overrides, environment scopes, and domain configuration. Preserve unrelated settings and credentials.
2. After confirming a migration branch will create only a preview, push `migration/frontend` to the existing repository. Do not push to `main` until deployment behavior is confirmed and the preview is validated.
3. Validate the Vercel preview, including native CSV/source downloads, assets and module MIME types, filters, role navigation, edit persistence, and mobile layouts. Record the actual preview URL and results.
4. Compare against the published frontend wherever accessible. This environment's request to the ChatGPT Sites URL was denied by the network proxy (403); visual/functional parity with the published site is therefore unverified. The export notes explicitly state that the supplied source may be ahead of the published site. No attempt was made to reconstruct that site.
5. After preview acceptance, promote or merge to `main` through the existing project's normal release process. Production release is not part of the completed local verification.

## Future Supabase phase

Keep this single application repository and its current frontend structure. Once backend requirements are agreed, add `supabase/migrations/` for versioned SQL, a focused data-access boundary (for example `src/lib/supabase/`), and appropriate tests. Define authentication, authorization/RLS, data migration, and server-only operations in that phase. Privileged service credentials must never reach this static browser app or its downloadable source archive. No database structure is inferred from the demo records here.
