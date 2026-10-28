# PostgreSQL 17 migration role correction and deployment handoff

28 October 2026 (India). Correction against `d3304f53edc2034decdc6ad5082e4f5827296c0d`, branch `feature/source-data-discovery`, [PR #1](https://github.com/mass-org-data/mass-cac-dashboard/pull/1). **No production connection or migration was executed by Codex for this correction.** No frontend, business rules, Vercel settings, hosted resources or staff accounts were changed.

**Resume update:** the user subsequently reports 001–006 applied and 007 failed on Auth permissions. The fresh-install/001 restart instructions below are historical. Use [MIGRATION-007-AUTH-RESUME.md](MIGRATION-007-AUTH-RESUME.md) and preserve 001–006.

## Root cause and reported production state

The user reports the first hosted apply, running as Supabase `postgres`, stopped with SQLSTATE 42501: must be able to SET ROLE mass_foundation_owner. Post-failure checks found zero recorded migration versions, zero MASS tables and no MASS schemas or roles. These are user-confirmed observations; they were not queried again here.

PostgreSQL 17 distinguishes the creator's ADMIN authority from SET and INHERIT membership options. A non-superuser with CREATEROLE can create a role while lacking permission to SET ROLE that new role. `CREATE SCHEMA ... AUTHORIZATION owner` already requires that ability. In these migrations the creator also performs REVOKE/GRANT on the new owner's schemas before SET LOCAL ROLE; SET alone is insufficient for those owner-authorized statements without inherited owner privileges.

The earlier local workaround enabled creator self-grants in the test session. The original migrations themselves did not establish the required memberships, so that test setup did not guarantee a hosted default session would succeed. The corrected migrations explicitly establish their own requirements without relying on that session override.

## Exact SQL changes

Only two migration files change. After the fresh CREATE ROLE statements and **before** CREATE SCHEMA/ACL work, migration 01 adds:

```sql
GRANT mass_foundation_owner TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
```

Migration 07 adds:

```sql
GRANT mass_core_owner TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
```

CURRENT_USER is the trusted migration execution principal (`postgres` on the reported hosted runner); the regression model uses a different name to verify no hardcoded identity. Each file starts in that principal's session and later changes role only after the grant. The grants are transaction-wrapped with role/schema creation. No standalone hosted GRANT or pre-creation of roles is needed or authorized by this handoff.

Only the two owner roles receive these explicit memberships. The correction adds no membership for anon, authenticated, service_role, teachers, cluster officers, leadership or other application users. All six technical-role attributes remain NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOBYPASSRLS. NOINHERIT on the role itself does not prohibit an explicit INHERIT option on the membership granted to the deployment principal. ADMIN delegation is not added by these GRANT statements; PostgreSQL may retain its separate automatic creator-ADMIN membership. Effective SET/INHERIT and distinct authorized members are verified, not a misleading assumption of one physical pg_auth_members row per role/member.

The deployment principal is deliberately trusted with owner privileges, including policies that allow owner helper reads. It must remain an administrative credential, never an application/database login for clients. No superuser/BYPASSRLS flag, public permission, private-schema exposure, application mutation ACL, RLS policy, definer body, trigger or business constraint is widened or removed.

## Review of subsequent files

- Files 02–06 reuse the foundation membership created in 01.
- File 07 independently establishes core owner membership before its own schema/ACL/default-privilege operations; files 08–15 can then SET ROLE core owner. File14's RESET ROLE returns to the deployment principal, which can subsequently switch between both owners.
- Managed Auth schema USAGE, auth.uid EXECUTE and column REFERENCES(id) grants in 07/14 are unchanged. The runner still needs actual grant/delegation authority on those managed objects; role membership cannot manufacture that authority.
- Functions retain their existing owners, fixed `search_path=pg_catalog`, restricted EXECUTE/default ACLs and typed scope checks. All 23 tables retain forced RLS and existing table/column grants.
- The new membership syntax requires PostgreSQL 16+; verification is specifically on PostgreSQL 17.11, matching the user-reported target version. Older historical documents describing DDL 15+ refer to the pre-correction release.

The remaining 13 migrations are byte-for-byte unchanged. No sixteenth corrective migration is added because the user reports none of the original versions committed to this target. **Do not rewrite or replay existing migration versions on a different target where they are already recorded/applied.** Such a target requires a separately reviewed forward-migration plan, not history repair.

## Automated verification

Fresh isolated PostgreSQL 17.11, digest-pinned image; synthetic-only Auth stand-in and fixtures. No hosted database URL is accepted by the runners.

| Check | Result |
| --- | --- |
| Legacy regression | Temporary copies remove only the two new grants. Original foundation and core bootstrap failures reproduce with 42501 under a NOSUPERUSER/NOBYPASSRLS CREATEROLE principal and default creator settings. Foundation failure leaves no MASS roles/schema; core failure preserves committed foundation. |
| Corrected restricted-principal sequence | All 15 files apply, once in filename order, with delegated database CREATE and Auth USAGE/EXECUTE/REFERENCES privileges. No creator-setting override, superuser or BYPASSRLS is used for migration execution. Both owner switches, effective SET/INHERIT, owner isolation and object ownership are checked. |
| Bootstrap rollback/retry | Injected failure after corrected 07 rolls back core roles, memberships, grants and schemas; committed foundation remains. Retrying the original corrected 07 then 08–15 succeeds. |
| Existing foundation suite | 87 checks pass, including the updated deployment-only owner-membership assertion. |
| Existing core SQL/concurrency/attribution | 102 checks pass, including the updated deployment-only owner-membership assertion. |
| Signed synthetic PostgREST HTTP | 18 checks pass; scope, profile masking, invalid/forged claims and stale-write behavior retained. This is not managed Auth issuance/session proof. |
| Catalog parity | 23 tables, 155 columns, 27 FKs, 71 policies, enabled+forced RLS; dictionary/ERDs/policy definitions preserved, inventory hashes regenerated. |
| Deployment/security reports | 15 catalog invariants, all 22 non-reference-table empty counts and 171 function/role effective permission combinations pass. |
| General transaction/recovery | File 08 injected-error rollback/retry and synthetic custom archive restore/postflight comparison pass. Hosted CLI ledger recovery/global-role restore remain unverified. |
| Frontend | Existing npm check/build pass; frontend bytes and build logic unchanged. No deployment. |

Reproduce locally:

```sh
bash tests/foundation/run-local.sh
MASS_TEST_REST=1 bash tests/core/run-local.sh
bash tests/deployment/run-role-probe.sh
bash tests/deployment/run-local.sh
bash tests/schema/run-local.sh
sha256sum --check supabase/compatibility/MIGRATIONS.sha256
npm run check
npm run build
```

The catalog renderer changes only its ownership-membership explanation and the two SQL hashes in the inventory. Exact function/constraint/policy definitions, table dictionary and ERDs do not change. The independently maintained [MIGRATIONS.sha256](../supabase/compatibility/MIGRATIONS.sha256) must match every one of the 15 files before a deployment. Do not use the previous d3304f5 manifest for this corrected release.

## Remaining hosted compatibility and recovery gates

The local probe resembles a privileged hosted non-superuser but does not recreate provider-managed role restrictions, Auth object ownership, gateway configuration, secret issuance or CLI ledger behavior. In particular:

1. Hosted postgres must be allowed to CREATE ROLE and grant itself explicit SET/INHERIT membership on roles it just created. Provider-specific restrictions may still reject this. No live provider test was performed here.
2. Auth schema USAGE/EXECUTE/column REFERENCES delegation in 07/14 and ownership/SET ROLE operations must be permitted through the actual runner. The local probe receives these delegable rights as setup; that is not evidence that production has them.
3. Keep technical schemas unexposed, staff scope rows absent and new API/frontend activation closed throughout the sequence. Inspect effective inherited grants/default ACLs and final owner membership against the approved migration principal.
4. No actual production backup was created or restored by this correction. Require the separately accepted private backup and managed recovery plan from [the production preflight](PRODUCTION-MIGRATION-PREFLIGHT.md). Synthetic restores do not verify provider/global-role recovery or external Storage bytes/configuration.
5. Confirm the actual migration runner accepts the existing 12-digit versions, stops on errors, maintains normal history and runs as the intended principal throughout. No ledger repair or manual role bootstrap is preapproved.

## Recommended controlled execution sequence — not executed

1. Review the correction commit in existing PR #1; do not merge automatically. Freeze its full SHA and all 15 manifest hashes. Approve the corrected SQL rather than the superseded release.
2. An authorized administrator confirms immediately before applying that the target remains `pbkwpfdpdtelmvbkzgvx` and still has zero recorded MASS versions/objects/roles as reported. If that state changed, stop and reconcile. Verify actual permission/backup evidence and the intended postgres runner. Do not run destructive cleanup.
3. Obtain separate authorization for an empty/closed installation, exact release/target/operator/window and recovery plan. This correction task is not that authorization.
4. Apply only the 15 files under `supabase/migrations/`, in the exact order in MIGRATIONS.sha256: 01 source_files, 02 source_sheets, 03 import_batches, 04 source_rows, 05 import_exceptions, 06 audit_events, 07 auth_scope, 08 identity_history, 09 academic_periods, 10 attendance, 11 assessments, 12 named_activities, 13 morarji, 14 core_security_audit, 15 core_api. Use the reviewed migration runner with normal ledger tracking and first-error stop; each SQL file has its own transaction.
5. Do not pre-run the new GRANT statements independently; they operate on roles created inside their respective transactions. Do not run tests, Auth stubs or synthetic fixtures on production. No manual migrations were executed by this work.
6. Postflight: verify exact 15 ledger versions/hashes, 23 tables/155 columns/27 FKs/71 policies, owners, owner membership SET/INHERIT for the deployment principal only, all 19 definers' settings/effective ACLs, forced RLS, indexes/triggers, all 22 non-reference tables empty and the five confirmed reference codes only. Reconcile exact catalog definitions against the corrected inventory and keep private schemas unexposed.
7. On error/disconnect: stop. Earlier files may remain committed; inspect actual database and ledger state before retrying. Do not blindly rerun successful files, mark failed versions applied, reset, drop roles or restore production. Choose a concrete reviewed forward correction/recovery action under separate authorization. Keep new access closed until verification passes.

**Recommendation:** local correction is ready for review. Production remains conditional on the outstanding managed permission/backup/runner evidence and separate execution approval. Staff activation, frontend/API integration and historical-data import remain separate later approvals. The previously uncommitted Phase 3E assessment is preserved locally without editing or publishing it as current corrected-release evidence.
