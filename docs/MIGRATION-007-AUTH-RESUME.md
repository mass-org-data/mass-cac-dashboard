# Migration 007 Auth permission correction and safe resume

28 October 2026 (India). Replaces the resume instructions for release `625c458fabb7bc7b8b6e98744f53489c21876bb0`. **001–006 are already applied and must never be replayed or edited.** No production SQL, Auth privilege change, restoration, import, frontend or Vercel deployment was performed by this correction.

## Observed error and what is established

The user reports six successful recorded migrations, six foundation tables with RLS, existing foundation roles/schema, no core/API schemas or core tables, and no student imports. Migration 007 failed as Supabase postgres with 42501, permission denied for schema auth. These hosted facts are user-supplied; no production query was executed here, in accordance with the restriction.

The error alone does not prove which GRANT raised it, or reveal actual grant options. In a fresh PostgreSQL 17 model with Auth owned by a separate managed role, a non-superuser with direct Auth USAGE/uid EXECUTE/column REFERENCES but **no grant options** reproduces the failure: the three old GRANT statements emit "no privileges were granted", then the core-owner CREATE TABLE cannot resolve auth.users because the owner received no Auth schema USAGE. This identifies a reproducible mechanism, not a claim to have read the production failing statement. Capture the actual statement/line and privilege diagnostics privately if exact hosted attribution is needed.

Direct rights and delegation are different. The old local probe supplied WITH GRANT OPTION; it therefore did not reproduce this provider boundary. This correction removes the need to delegate any managed Auth privileges.

## Correction: no broad grants or elevated function

Only **007 and 014** change among the 15 migration files. All applied 001–006 hashes and source bytes remain identical to 625c458. No sixteenth migration, foundation reset or ledger repair is introduced.

- **007:** remove the three managed Auth GRANT statements. Create the core tables under mass_core_owner as before. The deployment principal, which already has explicit core-owner membership, then installs the two named auth.users foreign keys using its own **direct** USAGE/REFERENCES rights. Table ownership remains mass_core_owner; no REFERENCES privilege is delegated.
- **007:** install one private `mass_core.request_user_id()` SQL **SECURITY INVOKER** function, with fixed `search_path=pg_catalog` and SQL-standard `BEGIN ATOMIC SELECT auth.uid(); END` body, bound by the authorized deployment principal. Transfer ownership to mass_core_owner, revoke PUBLIC execute, then grant only authenticated execute as required for RLS/helper resolution. Unexpected creator default function grants cause a fail-closed installation error.
- The wrapper does not parse JWTs, invent identities, switch privileges or impersonate another principal. Its bound dependency calls the **existing managed auth.uid()**; it avoids repeated Auth namespace lookup under an owner role that cannot be granted namespace access. Managed-function **EXECUTE remains enforced at runtime**. A guard rejects 007 if mass_core_owner lacks existing EXECUTE on auth.uid(). No provider/public privilege is broadened to satisfy the guard.
- **014:** remove the corresponding Auth grants to mass_foundation_owner. The deployment principal installs the pre-existing planned actor_user_id column/FK using its direct rights and inherited foundation ownership. Final audit-table ownership, column definition, FK name/actions and all other audit behavior are retained. This is the original planned audit integration, not a repair/reset of applied foundation objects.
- Runtime scope predicates, private-profile checks, global reference policies and audit attribution call the private invoker wrapper instead of looking up auth.uid() by name. They still use the same managed function and same validated request subject. No new SECURITY DEFINER is added; all 19 existing definer functions retain ownership and restricted execution. No RLS policy is dropped or disabled, no staff/application owner membership is added, and all private schemas remain unexposed.

The resulting model remains 23 tables, 155 columns, 27 FKs and 71 RLS policies. There is one additional private **invoker helper**, not an API endpoint or table; mass_api still has 11 RPCs. Policy/function expressions change only to use that helper for the same managed identity. Exact generated policy/ACL metadata is updated in the inventory/security document.

## Required privileges and secure blocker behavior

The actual deployment principal still needs database CREATE, CREATEROLE, ability to grant itself owner SET/INHERIT membership, and **direct** Auth schema USAGE, managed uid EXECUTE and auth.users(id) REFERENCES. It does **not** need grant options on these Auth objects.

The new core owner must already be permitted to EXECUTE the managed auth.uid() function, normally through that function's existing PUBLIC EXECUTE ACL. PUBLIC function execute does not imply Auth namespace/table access, nor a public grant on the private wrapper. The guard and runtime regression both enforce this distinction. **Do not add PUBLIC/Auth-schema/table grants if the provider does not already permit the function call.**

If direct REFERENCES or USAGE is missing, migration fails closed. If the managed uid execution ACL excludes the new owner, it fails with a provider-authorization message. Secure alternatives are an authorized provider/operator executing the narrow application DDL with its own direct rights, or separately reviewed narrow provider authorization on the required managed object. Do not remove the Auth FKs, inherit postgres/service_role wholesale, copy Auth identities into an unverified registry, add an elevated definer, disable RLS or broaden PUBLIC permissions. If the provider cannot support the direct rights, deployment is blocked pending an approved architecture alternative.

An administrator can inspect the prepared [resume-007-preflight.sql](../supabase/compatibility/resume-007-preflight.sql) later: it distinguishes direct rights from grant options, reports the uid ACL, remaining roles/schemas and existing versions. **It was not executed on production here.** No current live privilege or exact failing-statement confirmation is claimed.

## Verification

The pinned isolated PostgreSQL 17.11 tests use synthetic data only; they do not connect to Supabase.

- All 207 existing checks pass: 87 foundation, 102 core SQL/concurrency/attribution, 18 signed synthetic PostgREST HTTP.
- The new Auth-boundary probe applies unchanged 001–006 once, reproduces the published 007 failure, and proves foundation OIDs/owners/ACLs/RLS remain unchanged after failed 007 attempts. No bootstrap replay occurs during resume.
- It tests missing direct REFERENCES, missing managed-function EXECUTE and an injected late 007 failure. Each stops and rolls back core roles/schemas/grants; foundation persists. Retrying only 007–015 succeeds with a NOSUPERUSER/NOBYPASSRLS principal, separate managed Auth owner, and **zero Auth grant options**.
- It verifies no Auth schema or table/column access was granted to either owner role, the invoker helper's managed-function dependency, all 23/155/27/71 counts, then repeats the existing core SQL/concurrency suite on that restricted installation. Revoking the existing managed uid EXECUTE from the core-owner context causes 42501 at runtime; the wrapper cannot bypass it.
- The original role regression probe, all 171 definer/role permission checks, postflight invoker binding, exact catalog parity, generic transaction rollback/retry and synthetic archive restore pass. npm check/build pass; no frontend source/build logic changes.
- Every migration matches the revised SHA-256 manifest. Only 007/014 hashes change relative to 625c458. Applied001–006 hashes are explicitly locked in validation.

Local reproduction:

```sh
bash tests/deployment/run-auth-probe.sh
bash tests/foundation/run-local.sh
MASS_TEST_REST=1 bash tests/core/run-local.sh
bash tests/deployment/run-role-probe.sh
bash tests/deployment/run-local.sh
bash tests/schema/run-local.sh
sha256sum --check supabase/compatibility/MIGRATIONS.sha256
```

Managed Supabase role restrictions, actual uid ACL/body, gateway/Auth sessions and hosted ledger/restore behavior remain unverified. Local success does not certify hosted compatibility. No actual production backup was made by this task.

## Exact controlled resume — for later authorization only

1. Review and pin this correction commit and its manifest. Preserve the six recorded versions and every applied 001–006 byte. Do not use the previous 625c458 hashes for 007/014; never edit ledger history to hide a mismatch.
2. An authorized administrator verifies the same production project and postgres execution principal, the six successful versions 202610270001–202610270006, six intact foundation tables/owners/ACLs/RLS, no unexpected core/API schemas/roles/objects, no imported records and the direct privileges described above. Stop on any discrepancy. Confirm an accepted private backup/recovery point covering the now-existing foundation objects/roles/metadata.
3. Obtain separate authorization for resuming **only the remaining nine versions**. Keep staff grants, new API exposure, imports and frontend activation closed. This code-correction request does not authorize SQL execution.
4. Use the existing normal migration runner and ledger, with first-error stop. Inspect its pending/dry-run list before apply: it must show exactly the following sequence, with no 001–006 replay, reset, seed or history repair:

```text
202610270007_auth_scope.sql
202610270008_identity_history.sql
202610270009_academic_periods.sql
202610270010_attendance.sql
202610270011_assessments.sql
202610270012_named_activities.sql
202610270013_morarji.sql
202610270014_core_security_audit.sql
202610270015_core_api.sql
```

5. Run files through the reviewed runner once, transaction-wrapped as committed. Do not run removed Auth GRANTs manually; no managed Auth privilege change is part of this release. Do not execute fixtures, Auth stubs or standalone helper/constraint snippets on production.
6. On the first error or disconnect, stop all later files. Inspect actual transaction and ledger state before retrying; committed foundation and any successful core files remain. Do not blindly replay successful versions, force ledger entries, drop roles/schemas or restore/reset production. Obtain approval for the concrete recovery action.
7. Postflight: 15 total ledger versions ; 23 tables/155 columns/27 FKs/71 policies; exact constraint definitions; correct owners and deployment-only owner memberships; forced RLS; all 19 definer settings/ACLs; invoker-only managed uid binding and runtime privilege boundary; no new Auth owner/table/schema grants or private API exposure; only five attendance reference codes and empty non-reference tables. Scope/staff activation, frontend integration and real-data imports remain separately authorized stages.

**Handoff recommendation:** ready for correction review and controlled-resume planning. Actual production execution remains conditional on direct/provider permissions, backup evidence and separate approval. Preserve the existing uncommitted Phase 3E assessment locally as historical work; it is not updated or republished by this fix.
