# Final integration continuation — 3 November 2026

Status: **safe development and local verification completed; integrated hosted release remains NO-GO.** The user confirmed the new calculation decisions and staff spreadsheet are still in preparation. Neither has been received. No production database or Auth configuration changes, staff accounts, real data writes, deployments, merges or paid infrastructure were created.

## Current state, inspected again

Starting/local/remote compatibility commit: 44a66250dc8c0f4c77dfce52f14937d49ac5e0ef on feature/supabase-frontend. main remains 9428656acdb6e924e368e08bd43ba9a139c8f0c9. The unrelated untracked Phase 3E recovery note was preserved.

Fresh authorized read-only hosted checks found PostgreSQL 17.11,19 recorded migrations,27 tables,183 columns,35 foreign keys and108 policies; all MASS tables force RLS. There are 22 authenticated-only mass_api RPCs. The API exposes mass_api and standard public/GraphQL schemas; no private application schemas are exposed. Owner SET/INHERIT capabilities are present in catalog metadata, not newly tested by production DDL execution. Current data: 1,458 students and 1,458 enrolments,47,323 attendance rows and207 assessment results. No programme rows were changed in this phase.

020–023 remain unapplied. Therefore the full local operational backend is not deployed. The001–019read compatibility path remains available, while unsupported quarter-inclusive assessments, operational details, aggregates and visits stay explicitly gated. Source provenance and historical held records are preserved. The accepted undated officer source rows are not converted to dated completed events; acceptance of the source does not establish an Auth identity or visit date.

The supplied Preview host and its release.json are still blocked by this environment's outbound proxy (CONNECT403 before Vercel). The Vercel CLI has no authenticated session. Thus the deployed source/version/configuration, compatibility-fix publication and actual staff data loading cannot be verified. The old URL is an inspection target, **not a final working Preview claim**. Git branch publication is not deployment because the previously verified Ignored Build Step skips this branch.

## Authentication completed locally

Sign-in-first is restored and supersedes the 29 October public-entry decision. The original dashboard still loads after verified Auth identity and current server scope checks. No anonymous dashboard or programme RPC is loaded before sign-in. Existing account credentials are verified with getUser; role/scope comes from the server, never a browser role selector or directory name. Sign-out clears local programme state and returns to sign-in.

Password recovery is implemented with a same-origin redirect and SDK PKCE exchange. Only a verified recovery exchange can open the password form. One-use codes/errors and unsupported implicit-token fragments are scrubbed. A refresh/interruption cannot turn a pending reset session into normal programme access. Password change re-verifies the same user, delegates strength policy to Supabase and requires fresh sign-in afterward. Unexpected provider errors are not echoed. No real recovery email was sent or real password changed during tests.

Hosted Auth gates remain: the current redirect allowlist is broader than the verified MASS application origins; no custom SMTP is configured; real staff delivery/recovery has not been tested. An authorized operator must verify exact project/Preview origins, restrict redirects accordingly and validate the mail service before recovery activation. No public signup UI or automatic role provisioning was added. Provider signup is currently enabled, so the invitation/onboarding policy needs operator review; an unassigned account receives no programme scope.

## Staff and shift permissions

The spreadsheet is pending; zero staff rows have been validated/provisioned. Existing runtime grants remain unchanged. Validation must reconcile actual Auth UUID/email, canonical directory identity, centre identifiers, effective dates, role, profile capability and verified officer linkage. Ambiguous names/centres, NULL shifts and missing dates cannot produce a grant. No Leadership account is created.

**Important verified limitation:** current user_scope_grants and base record RLS are centre-scoped, not per-shift staff grants. The visit-link design requires explicitly verified Both-shifts authority. If the new spreadsheet grants only Morning or Evening, do not convert it to a whole-centre grant or enforce it only in the UI. That case requires a reviewed additive shift-aware authorization change and regression coverage after the actual requirements are supplied. It is not silently included in020–023.

## Calculations and audit gaps

[CALCULATION-INTEGRATION-QUEUE.csv](CALCULATION-INTEGRATION-QUEUE.csv) preserves all 24 original visuals and existing contracts, with space for each supplied decision→SQL/RPC→population/numerator/denominator/exclusions/time/filters/test mapping. [AUDIT-REVIEW.csv](AUDIT-REVIEW.csv) covers all 43 prior findings without rewriting dated evidence or marking missing source/rules closed. The new final decision register cannot be completed before the file arrives. No new approval is requested for already confirmed attendance codes/formula, max 25, academic-year/quarter boundaries or 2+2 visit targets.

Independent population and baseline attendance/filter reconciliation were rerun against a fresh private administrative export using 3 November 2026 as the snapshot cap. Results cover the documented July–October source months; they are not proof of new November observations or hosted staff Auth. No private source rows were committed. Individual charts with missing source or pending definitions remain explicitly unavailable rather than fabricated.

## Exact next activation sequence

1. Receive the promised decisions and staff spreadsheet; privately validate and integrate the actual contents. Do not infer missing policy or assignments.
2. Arrange the operator-managed recovery solution in [RECOVERY-AND-ACTIVATION.md](RECOVERY-AND-ACTIVATION.md). The user is not asked to personally run a manual backup. There is no current verified recovery artifact; no risky schema execution occurs until that gate is met.
3. Enable authorized Vercel access and network reachability (or an authorized operator's equivalent evidence) for the existing team/project. Verify protected Preview scope, source commit and Preview-only variables. Do not deploy Production, change main, disconnect GitHub or create a project.
4. Tighten/test Auth redirects and email configuration through the existing provider; validate existing real account scope before staff activation. Do not manufacture accounts or grants to make tests pass.
5. Apply only reviewed020→021→022→023 with the verified runner, real atomic ledger recording and error-stop behavior. Preserve001–019 and their provider-generated historical IDs. Check schema/security/data counts after each commit and full postflight before frontend activation.
6. Run approved isolated managed-Auth/write-UAT for three roles: save→database→refresh→re-read→audit, duplicate/conflict handling and cross-centre/shift denial. No synthetic identities or children are added to production. Actual live staff read-only UAT is separate and does not prove writes.
7. Deploy only the reviewed protected Preview, verify actual authenticated baseline/full data and all chart/source contracts, then seek final Production approval. No existing local result substitutes for those gates.

See [VERIFICATION.json](VERIFICATION.json), [REVIEW.md](REVIEW.md) and [CURRENT-STATE.json](CURRENT-STATE.json). Final working Preview URL, managed Auth delivery, completed staff mapping and finalized calculation sign-off are **not yet available**.

A protected read-only compatibility Preview can proceed independently of schema migration once Vercel access, target/protection and approved existing user scope are verified. Recovery gates apply before risky database changes; staff onboarding and finalized calculation integration wait for their actual input files. See [historical status](HISTORICAL-STATUS.md) for fresh exception/import counts with explicit units.
