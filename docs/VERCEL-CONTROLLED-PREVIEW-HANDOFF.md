# Controlled live Preview readiness — existing MASS project

28 October 2026 (India). Existing Vercel project mass-cac-dashboard, project ID prj_MvZqQP2cdpRce7NxWR1JzvBsIBdL, team mass-data-dashboard/team_6bfGAi9fNVAAJ9NQqg0VzHM4. Production branch main; working branch feature/supabase-frontend. User-verified Ignored Build Step cancels this branch. No Vercel token/connector, settings change, deployment or merge was used in this task. The prior independent readiness note reported zero configured environment variables and a canceled build; current Vercel configuration is not independently readable here.

## Verified backend API blocker

Read-only Management API /postgrest inspection confirms exposed schemas **public,graphql_public**; mass_api is absent. Before an approved live Preview can call the existing RPCs, separately approve adding **mass_api** in the existing Supabase project's Data API exposed-schema setting, retaining unrelated approved public/graphql_public. Keep mass_core, mass_foundation and auth unexposed. This is a production API-configuration change, not permission to add tables, replay migrations, create accounts or expose private schemas. No change was made here. Verify the actual setting and schema-cache behavior after that separate action.

## Exact Preview variables

Configure these only in the **Preview environment scoped to feature/supabase-frontend**, after separately authorizing configuration/deployment on the existing project:

| Variable | Value |
| --- | --- |
| MASS_APP_MODE | live |
| MASS_SUPABASE_URL | https://pbkwpfdpdtelmvbkzgvx.supabase.co |
| MASS_SUPABASE_PUBLISHABLE_KEY | Actual approved key from this project's API settings; configure privately outside Git. |
| MASS_READ_API | frontend-reads-v1 |
| MASS_DIRECTORY_API | directory-v1 |

.env.preview.example contains blank-key documentation only. build.mjs reads explicit environment variables, not dotenv files; validateConfig pins this project and rejects service-role, sb_secret and legacy JWT keys. Never put SUPABASE_ACCESS_TOKEN, DB credentials or any service key in frontend/Vercel variables. The Management token that now works is not a browser key.

`npm run check:preview` validates these values/flags and reports no key value. It has no network/deployment effects and proves neither key ownership nor Auth/RLS. Run it with the approved variables present, then npm ci / npm run build locally or in the authorized build environment. No actual frontend publishable key is configured in this environment; therefore this task does not claim a real authenticated Preview build. The existing default unconfigured build fails closed.

Keep repository root, Framework Other, Node24.x, npm ci including build-time esbuild, npm run build, dist output and existing project linkage. Do not create another project, disconnect GitHub, change production flags, promote an alias or use --prod.

## Controlled build-skip exception proposal — not applied

Before any manual deployment, an authorized administrator verifies target project, environment **Preview**, exact feature-branch commit and existing production main. Retain all unrelated ignored-build rules. The existing frontend-branch skip can be replaced with this reviewed opt-in condition, while retaining source-data-discovery cancellation:

```sh
if [ "$VERCEL_GIT_COMMIT_REF" = "feature/supabase-frontend" ]; then
  if [ "$VERCEL_ENV" = "preview" ] && [ "$MASS_ALLOW_PREVIEW_BUILD" = "1" ]; then
    exit 1
  fi
  exit 0
fi
if [ "$VERCEL_GIT_COMMIT_REF" = "feature/source-data-discovery" ]; then
  exit 0
fi
exit 1
```

Vercel exit0 skips, exit1 continues. MASS_ALLOW_PREVIEW_BUILD=1 must be scoped only to this branch's Preview environment for the approved window; the frontend builder does not bundle it. This is a proposed settings change requiring separate approval, not code that was deployed. Preserve any additional existing rules rather than blindly replacing the whole setting.

After approval, redeploy the exact feature commit through the existing project's explicitly Preview-targeted flow; inspect environment/project/source SHA before starting. If the UI cannot verify Preview targeting, stop instead of guessing. Do not use main or Promote to Production. Confirm the resulting URL/commit/status, then remove the branch-scoped opt-in flag so normal feature pushes are skipped again. A canceled deployment record is not a working Preview.

## Module status

| Module | Implemented/local verification | Remaining real-provider/source gate |
| --- | --- | --- |
| Auth login/logout/session | Official SDK; verified getUser identity, refresh/session isolation, logout failure cleanup; intercepted browser coverage. | Real approved publishable key, account policies and verified test identity; no accounts created here. Managed Auth is not proven by PAT access. |
| Centre-scoped loading | Server context, private RLS, centre selection, empty/unassigned/error states. | Add missing mass_api exposure after separate approval; verified user_scope_grants; current checked hosted tables are empty. |
| Donor filtering/drilldown | directory-v1 opt-in; authorized query targets; no financial assumptions. | Approved real canonical donor/centre associations and source import. |
| Teacher/officer/shift | Scoped invoker directory reads, original names protected, explicit unknown shifts. | Verified source identities/shifts; directory entries never grant Auth access. |
| Students/enrolments | Permanent IDs, historical episode add/first closure, scoped profiles. | Real registration/enrolment approvals and verified dates; no name-only historical identity matches. |
| Attendance | P/A/L/WO/MM entry/correction/history, revisions and denominator rules. | Real calendar/episodes; bulk/H/clear-to-unknown unsupported. |
| Assessments/progress | Configured max25, zero scores, actual year/quarter, correction/history. | Actual references, historical scales/periods and approved comparability/precision; unsupported progress/band claims stay disabled. |
| Activities/participation | Named dated single-shift event and participation corrections. | Actual named events; legacy monthly slots do not become invented events. |
| Morarji | Verified cohort membership and nullable applied/attended/passed/school reads/writes. | Real cohort periods/source identity/outcome conflicts. No inferred admission/scholarship/training fields. |
| Unsupported operations | Removal/undo/profile corrections/bulk writes, financial/export reports, visits/guidance/private notes remain visibly unavailable in live mode. | Separate approved contracts/schema/API/business decisions. Original demo remains isolated. |

## Live acceptance after separate approvals

Use existing approved test identities/scopes in a suitable approved target; do not create accounts/grants implicitly or upload demo rows. Verify own versus cross-centre denial, Leadership readonly/private masking, teacher/CO scopes, donor/shift filters, corrections/conflicts, mobile/navigation/charts, no browser data persistence, Auth refresh/logout, downloads and empty/error states. Do not use real child data in an unapproved/unprotected Preview or screenshots; complete D10 disclosure/privacy review first. Production-sourced Preview writes are production data writes: no synthetic mutation tests against MASS production, and any real entry needs its own authorization. A Preview environment label does not isolate the database.

No source data, accounts/scopes, frontend deployment or Vercel settings were changed here. Existing local tests passed; actual managed sessions/populated workflows/Preview URL remain unverified. See IMPORT-PIPELINE-HANDOFF.md and IMPORT-DECISIONS-AND-EXCEPTIONS.md for exact blockers before activation.
