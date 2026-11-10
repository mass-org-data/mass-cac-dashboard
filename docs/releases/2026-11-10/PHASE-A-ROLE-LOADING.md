# Phase A — role-scoped loading

Baseline: Production `main` at `26dd33b80071d95b8b20d2c3fd2cd1d55b5f6ef8` after PRs #8 and #9.

## Implementation inventory

| Requirements | Baseline finding | Phase A result |
| --- | --- | --- |
| F01, F04 | Auth and verified role switching existed, but startup loaded detailed records for the union of writable centres. The role selector changed the rendered role without a corresponding data transition. | The default verified role is planned first. Selecting another verified role now shows a blocking loading state, verifies the current Auth/scope context, and replaces the in-memory dataset only after that role's read succeeds. |
| B01, B02 | RLS and centre grants were enforced by Supabase, while the browser still requested detailed centre data beyond the selected role when a multi-role account had overlapping access. | A pure role-data plan limits detailed reads to centres assigned to the active role. Leadership uses aggregate APIs without profile/fact downloads. Visit summaries, trends, and fallback aggregates use the active role's centres. Unknown roles are rejected before reads. |

PR #8's attendance register, correction/deletion audit paths, and version/request tokens are unchanged. PR #9's operational approval, verified-role list, centre grants, officer identities, and server authorization remain authoritative.

## Files

- `src/live/role-data.js`: deterministic authorized-role order, default role, aggregate mode, and detailed-centre plan.
- `src/live/original-review.js`: role-scoped startup/refresh, active-centre visit and aggregate reads, and verified async role transition.
- `src/app.js`: loading state and disabled role selector while a transition is in progress; failed transitions restore the previous role.
- `tests/frontend/role-data.test.mjs`: multi-role default, role-specific centre plans, Leadership aggregate behavior, fallback behavior, and unknown-role denial.

## Validation

- `npm run lint`: passed.
- `npm run check`: passed.
- `npm test`: 21 frontend test files passed; 27 workflow/removal checks passed.
- `npm run test:staff-access`: 22 scoped multi-role backend assertions passed, including foreign-centre denial and revocation.
- `npm run build`: passed.
- `npm run test:attendance:browser`: blocked before execution because the Node test imports `playwright`, which is not declared or installed. This is retained as a later test-harness gap rather than changing the dependency boundary in Phase A.

No Supabase schema, data, grants, feature flags, Vercel Production settings, or Production deployment changed.
