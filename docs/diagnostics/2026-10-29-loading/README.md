# Programme-loading investigation — 29 October 2026

Status: **local compatibility correction prepared; hosted incident remains UNRESOLVED pending actual Preview verification.** This report does not claim the deployed failing RPC or deployment commit was observed.

## Evidence and limits

User-reported Preview: https://mass-cac-dashboard-git-feature-supab-10335b-mass-data-dashboard.vercel.app/

The environment's outbound proxy rejects CONNECT to this exact host (including `/release.json`) and to the project REST endpoint. An additional read-access attempt was also blocked. This is a proxy403 before either service, not an observed Vercel/PostgREST response. No Vercel session/connector is available. Consequently the deployed source commit, bundle/runtime variables, exact failed RPC, PostgREST error and real staff session cannot yet be verified. No upstream403/404 is invented from that transport failure.

Authorized read-only Supabase Management API inspection succeeds. The intended target is PostgreSQL 17.11, with19 recorded migrations and22 mass_api RPCs. `get_context`, `get_references`, the nine read APIs and directory RPCs exist. `get_original_capabilities`, supplemental delivery/activity/basis/aggregate reads and visit RPCs do not exist. API configuration exposes `public,graphql_public,mass_api`; private schemas remain excluded. All 22 RPCs grant authenticated execution and deny anonymous execution. Original data counts remain unchanged in the private evidence. These are catalog/configuration observations, not successful end-user RPC/session tests.

The reported text comes from `BackendError`: HTTP404 **or** PGRST106 schema configuration errors map to the same message. The message alone does not identify the RPC or prove a missing migration. The reviewed feature code previously called `get_original_capabilities` alongside required context/reference/directory reads and aborted the entire UI on a missing optional capability function. It also unconditionally requested supplemental functions not present on001–019. This is a verified source-to-hosted-inventory incompatibility. It is a plausible cause of this incident, not a captured deployed request.

## Minimal frontend correction

- Discover backend capabilities separately from required scoped reads. Only **HTTP404 + PGRST202 + exact RPC get_original_capabilities** enables the reviewed001–019 compatibility path. Permission, session, network, schema and unexpected-response failures stop loading. No catch-all fallback or retrying writes is added.
- Existing authenticated/RLS-scoped student, enrolment, attendance, calendar, named activity, participation, Morarji and directory reads can load the original interface without requiring020–023. No private-schema queries, new grants, shared credential or privileged browser/server proxy is introduced.
- Do not call absent delivery/activity-detail/enrolment-basis/visit/aggregate RPCs in this mode. Calendar remains scheduling, not delivery; absent activity category/status stays unknown; enrolment date basis is undocumented rather than guessed.
- Use minimized counts from data already returned by scoped reads for masked users' enrolment/grade/recorded-attendance summaries. No profile fields are inferred. Gender/learning aggregates requiring the reviewed API remain explicitly unavailable. Centre/donor/officer selection is applied without contaminating the independently cached per-centre summaries.
- The old `read_assessments` filters on exact dates and omits NULL-date quarterly results. It cannot support complete quarter-inclusive charts. Such scores/tables are withheld with an explicit API-activation state rather than presenting a partial dataset as complete. No dates, zeroes, definitions or comparability are invented. These features remain required and their full implementation remains intact for the complete backend.
- Keep operational controls and full backend adapters. Unavailable writes/history are blocked before any RPC; existing server scope/version checks remain unchanged. Baseline loading is not authorization to activate partially supported mutation semantics.
- Errors now carry only whitelisted RPC identity, HTTP status and error code. The load-error screen shows those diagnostics without arguments, JWTs, keys, hints or provider details that might contain personal values.
- Builds emit `/release.json`: commit, dirty-worktree indicator, environment, project/URL and API flags only. It contains no keys or programme records. Unknown Git metadata remains null, never a guessed deployment version. Older deployments will not have this file.

All 23 canonical migration files and their manifest remain unchanged. No hosted SQL objects/data/configuration were modified.

## Confirmed function mapping

|Phase|Functions|Hosted availability / compatibility|
|---|---|---|
|Required startup|16:get_context/get_references;17:get_centre_directory|Present; failure remains a hard stop|
|Scoped base rows|16:read_students/read_attendance/read_calendar/read_activities/read_participation/read_morarji;17:get_centre_staff|Present; bounded pagination and RLS preserved|
|Optional capability probe|20:get_original_capabilities, later replaced by22/23|Absent; exact missing-function response selects compatible base reads|
|Assessment reads|16:read_assessments;20:quarter-inclusive replacement|16exists but omits period-only results; incomplete score charts withheld|
|Delivery and richer activities|22:read_delivery/read_activity_details|Absent; no fabricated delivery/category/status|
|Private-profile-safe aggregates/date basis|23:programme_aggregate/read_enrolment_basis|Absent; source basis/gender/complete learning metrics are not inferred|
|Visits and revisions|21:get_visit_assignments/visit_summary/read_visits/history;23:read_record_revisions|Absent; controls remain behind activation gates|

## Safe Preview execution and actual verification gate

1. First obtain the exact failed request from the user's existing browser: DevTools → Network → sign in → failed `/rest/v1/rpc/...` → record only RPC name, HTTP status and response `code`. Never share Auth headers/tokens, passwords, keys, HAR containing private data or returned programme rows. If this is a schema/session/permission error, diagnose that cause; do not label it a capability error.
2. Enable an authorized Vercel connection, or have the authorized operator inspect the existing project. Verify team mass-data-dashboard / team_6bfGAi9fNVAAJ9NQqg0VzHM4 and project mass-cac-dashboard / prj_MvZqQP2cdpRce7NxWR1JzvBsIBdL. Preserve Git integration and Production main. No new project is needed.
3. Inspect the current Preview deployment commit and build configuration. Compare its code to the reviewed feature commit and verify Preview-only variables: MASS_APP_MODE=live; MASS_SUPABASE_URL=https://pbkwpfdpdtelmvbkzgvx.supabase.co; a matching publishable key; MASS_READ_API=frontend-reads-v1; MASS_DIRECTORY_API=directory-v1. Do not use service/secret keys or a Management API PAT. `.env.preview.example` is documentation; the build does not auto-load dotenv files.
4. Produce only a **protected Preview** of the reviewed feature branch using the existing project. The branch's previously verified Ignored Build Step skips Git pushes, so publication is not deployment. An authorized operator must verify the actual manual Preview build runs, target Preview, protection and source commit. Never use `--prod`, change Production settings, merge or silently bypass the existing skip rule.
5. Inspect `/release.json` after deployment and require the intended commit, `dirty:false`, correct target/flags and Preview identity. If the provider does not supply Git metadata, resolve that evidence gap before claiming an exact deployed version. Compare actual requested Supabase hostname and Content-Profile=mass_api in Network; do not publish the key.
6. Sign in with the user's legitimate existing authorized account. Verify getUser/context identity agreement and current readable centres. Confirm student/enrolment/attendance reads 200 and API rows→UI rosters/counts→centre/grade/shift/month filters; verify attendance P/(P+A+L), WO/MM/confirmed-holiday exclusion and unknown-day handling. Verify masked users cannot see private names/gender; protected operations stay blocked where required RPCs are absent. Reopen/refresh, sign out and verify private state clears. Do not create staff or synthetic production records to test.
7. Record the actual RPC/status/code, deployment commit/URL and successful authorized data load. Until then this incident is not resolved. Full quarter-inclusive assessments, delivery, visits and their activation remain separate backend dependencies under existing recovery/security/UAT gates. Do not apply020–023 merely to silence the loader.

See VERIFICATION.json for local evidence. No production deployment, hosted migration, permission change, account provisioning or real record mutation occurred.

## Reproduce locally

```bash
npm test
MASS_BASELINE_BROWSER=1 npm run test:browser
npm run test:browser
npm run check
npm run build
sha256sum -c supabase/compatibility/MIGRATIONS.sha256
```

The baseline browser run applies only 001–019 to a fresh isolated database; the full run applies the reviewed local sequence. Both use isolated synthetic Auth stubs. Neither connects to production or tests managed Supabase Auth. The new baseline summary reconciler accepts a private administrative export and requires explicit verified calendar coverage; it prints only aggregate check results and never performs network calls. Its 12,144 real-source comparisons are not a substitute for a real staff session in hosted Preview.

The final full-backend suite passed 36 browser scenarios; the 001–019 suite passed 7, including actual isolated HTTP 404/PGRST202 and independent data reads. Frontend unit tests passed 36 checks; existing demo workflows passed 27 checks. The current full SQL suite passed 146 behavioral assertions. All 23 migration hashes, syntax/build checks and new real-source comparisons passed. See VERIFICATION.json for scope and limitations. The source-download ZIP includes code only, not this investigation or private evidence.
