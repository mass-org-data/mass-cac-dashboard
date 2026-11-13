# New interface (web/)

Vite, React, TypeScript, Tailwind CSS (v4), shadcn/ui-style primitives and TanStack Table (v8). It is built **only when `MASS_NEXT_UI=1`** and is served at `/next/` beside the current application, which stays the default. Production builds do not contain it.

```bash
npm run web:dev        # Vite dev server (needs MASS_SUPABASE_URL / MASS_SUPABASE_PUBLISHABLE_KEY for the preview project)
npm run web:build      # full build with the flag on, output in dist/next/
npm run web:typecheck  # tsc, strict
npm run test:web       # Vitest + Testing Library + axe-core
```

## What is shared with the current application (not copied)
`src/live/config.js` (approved-project check), `client.js`, `auth-page.js` (verified sign-in), `reads.js`, `directory.js`, `role-data.js`, `population.js` (CSV escaping). The server stays the authority for roles and scope; the session controller re-verifies identity and scope every 30 seconds and when the tab becomes visible, and ends the session on a mismatch.

## Shared components (every page uses these)
- `DataTable`: search box, click-to-sort headers (ascending first), default ascending sort on the first column, sticky header, ten rows per page with pagination beyond ten, CSV export of the filtered and sorted rows, no column reordering or toggles, loading/empty/error states.
- `Scorecard`: compact label, large value, optional unit and hint, loading/error/unavailable states. Unknown stays an em dash, never zero.
- `AsyncState`: the one loading, empty and error treatment.

## Rules
- No inline scripts or handlers (CSP `script-src 'self'`); no external fonts or CDNs.
- Controls are at least 44 px high. Run `npm run test:web` for axe checks; contrast is checked in a real browser (see the Phase 4 note in `docs/perf/`).
- Never use a service key; the browser holds only the publishable key.
