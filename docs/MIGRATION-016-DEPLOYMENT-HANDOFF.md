# Migration 016 — finalized read API release

28 October 2026 (India). Branch: `feature/supabase-frontend`. Target identification only: `pbkwpfdpdtelmvbkzgvx`, Mass CAC Dashboard, Mumbai/ap-south-1. **No production SQL, data/account provisioning, merge or Vercel deployment is authorized or performed by this release.** GitHub publication is authorized; the user verified this branch is covered by the Vercel Ignored Build Step. Automatic cancellation cannot be independently inspected from this environment.

## Frozen SQL and security review

Authoritative file: `supabase/migrations/202610280016_frontend_reads.sql`.

SHA-256: `1587c60cf3dd643159e4179850126ea6880e44fac6a7e534d711fe03145602ea`.

The file is byte-identical to the reviewed proposal. Its original proposal-only header is retained to preserve the reviewed hash; this document records promotion, not production execution approval. The preserved proposal SQL/checksum are historical references, never a second migration to apply. All original 001–015 files remain unchanged relative to release `15cbc3f2a417c13201aa60ee053d7b92a0bd8444`. The main manifest retains the original 15 entries in order and appends only 016.

- get_references exposes exactly five non-personal collections: academic_years(id, starts_on, ends_before), assessment_periods(id, academic_year_id, quarter), assessment_definitions(id, period_id, max_score), programme_cohorts(id, label, academic_year_id), attendance_codes(code, meaning). No child/profile, score, membership, outcome, source/audit or staff-directory data is read. Reference labels/meanings must remain governed non-personal reference text during separately approved provisioning; no SQL check can certify the semantics of arbitrary administrator-entered text.
- Reference access requires actual role authenticated, managed request UID, and at least one centre visible under existing active-assignment RLS. References are deliberately programme-wide non-personal metadata; operational records remain centre-bound. Anonymous, missing-UID, unassigned, expired, revoked and future-only access is rejected.
- Nine RPCs and the private validator are SECURITY INVOKER. No new definer, Auth grants, owner membership, broad table grants, RLS bypass or API exposure is added. Original 71 policy definitions are compared before/after and remain identical; the sole extra policy discovers only the caller's own active scopes, with SELECT restricted to six columns. Verifier identities/revisions/whole-table reads and mutations remain denied.
- Operational reads require one centre and can_read(centre), enforce bounded requests and preserve table/profile RLS. Leadership is read-only with masked profiles; Teacher/CO private-profile capability remains explicit. Real business roles/centre grants are server-controlled. No browser role claim creates rights.
- New totals: **16 migrations; 23 tables; 155 columns; 27 foreign keys; 72 policies; 20 mass_api functions, including nine new invoker reads; 19 existing definers unchanged.** No new relation or operational record is created.

See [read contracts](PHASE-4-READ-API-CONTRACTS.md), [34-workflow mapping](PHASE-4-FRONTEND-API-MAPPING.csv), [current security inventory](DATABASE-SECURITY-IMPLEMENTED.md) and [frontend handoff](PHASE-4-INTEGRATION-HANDOFF.md). Removal/undo, unsupported edits/exports and donor/funding tables remain outside 016.

## Local verification

All commands target fresh disposable synthetic databases or intercepted browser requests; none accepts a production target for test execution:

```sh
npm run check
npm test
npm run test:api
npm run test:browser
npm run build
npm audit --audit-level=high
bash tests/foundation/run-local.sh
MASS_TEST_REST=1 bash tests/core/run-local.sh
bash tests/schema/run-local.sh
bash tests/deployment/run-local.sh
bash tests/deployment/run-role-probe.sh
bash tests/deployment/run-auth-probe.sh
sha256sum --check supabase/compatibility/MIGRATIONS.sha256
sha256sum --check supabase/proposals/FRONTEND-READS.sha256
cmp supabase/proposals/202610280016_frontend_reads.sql supabase/migrations/202610280016_frontend_reads.sql
```

Results: original **207** behavioral checks, **16** frontend unit checks, **27** manager workflow checks, **32** Chromium checks, **59** read-security SQL assertions and **18** real SDK/PostgREST checks. Schema/catalog generation and independent verification cover every column/key/policy/ACL/function and all 16 hashes. Deployment tests cover restricted PG17 roles, managed-Auth nondelegation, failure/rollback/retry, 171 existing definer/role combinations, empty-schema checks and isolated backup restoration. Syntax/build pass; dependency audit reports zero vulnerabilities.

The 016 test injects division-by-zero immediately before COMMIT, verifies absence of new functions/policy/column grants, and checks all 71 original policy definitions are unchanged. Retrying the exact file then succeeds. Original concurrency, identity/history, audit and RLS checks also run against the full 16-migration schema. Test-only Auth/JWT issuance is not managed GoTrue/provider verification. No hosted compatibility success is claimed.

## Controlled production sequence — requires separate execution authorization

1. Freeze the reviewed commit and validate all 16 hashes. Do not edit applied files. Privately confirm target, trusted execution principal, backup/recovery point and administrator availability. Do not store credentials/dumps in the checkout, GitHub, downloadable frontend archive or public logs. An actual production backup has not been created by this phase; use the existing private backup procedure and verify integrity/recoverability before execution.
2. In an explicitly approved read-only inspection window, run `supabase/compatibility/016-preflight.sql` and inspect the actual runner's migration ledger. Expect 23 tables, 71 policies, 11 API functions; no 016 function/policy or scope-column rights. Confirm current principal can SET/INHERIT mass_core_owner, existing schemas have expected owners and no unexpected default EXECUTE grants/inherited role access exists. Confirm exactly the original 15 successful versions, with **202610280016 as the sole pending version**. Any drift is a stop condition; do not reset/replay/repair history.
3. Obtain explicit hosted execution authorization for this exact release and target. Use the established migration runner and its ledger/error-stop behavior to apply **only `202610280016_frontend_reads.sql`**, once. Do not select all SQL files for replay, manually insert ledger rows, wrap the file in an extra transaction, apply the historical proposal separately or silently continue after an error. The file has its own BEGIN/COMMIT and local owner switch. A reload-schema NOTIFY commits only on successful transaction completion.
4. If any step errors or connection outcome is uncertain, stop the runner. Preserve a sanitized operator error record and inspect committed catalog/ledger state through separately authorized read-only checks. A pre-COMMIT failure should roll back the whole file and leave the original 15 intact; prove that state before an explicitly approved retry. A disconnect near COMMIT is ambiguous: do not assume rollback and rerun. Existing 016 objects with absent ledger, or a ledger row with missing objects, require manual reviewed reconciliation, not force/replay/history repair. No destructive rollback/drop script is supplied; use the private recovery plan only with separate authorization if a verified transaction cannot be recovered safely.
5. After a successful recorded install, run `supabase/compatibility/016-postflight.sql` and the updated `supabase/compatibility/postflight.sql` read-only. All count checks must pass; reconcile original 71 policy definitions and expected new function/column ACLs with `DATABASE-SCHEMA-INVENTORY.json`. Check effective permissions, owner/default ACLs and no public/anon/service-role widening; a count alone is not proof. Stop before enabling frontend if anything differs.
6. Review provider Data API configuration and schema-cache behavior: mass_api only as the curated MASS surface; do not expose mass_core, mass_foundation or auth, and do not change unrelated approved schemas. Managed Auth sessions/JWT enforcement, real provider role inheritance and actual scope/mask behavior remain unverified here and need separately authorized validation in a suitable isolated managed target. No synthetic or historical rows/staff grants are authorized on production by these instructions.
7. Keep empty-schema installation separate from reference-data provisioning, staff activation, historical imports and frontend integration. Each requires its own approvals, verified assignments/privacy controls and validation. Keep the Vercel production application unchanged; no merge or deployment is part of migration 016 finalization.

## Recommendation

**GO for finalized code publication and review. NO-GO for executing hosted SQL under this authorization.** The conditional read-only design requirements pass local verification, but an approved production window, actual backup/recovery evidence, target/ledger/permission inspection and separate execution authorization remain mandatory. Local PostgreSQL17/PostgREST results do not prove managed Supabase Auth/provider behavior. Hosted preflight/postflight files have been prepared and exercised locally, not run against MASS production.
