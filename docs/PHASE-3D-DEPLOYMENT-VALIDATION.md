# Phase 3D — deployment validation and release checklist

27 October 2026 (India). **Recommendation: NO-GO for hosted production apply; GO for a separately approved isolated managed-Supabase validation.** All local checks pass. No production Supabase connection, migration, data import, frontend edit, Vercel action, Git push or PR merge was performed in this phase.

Validation baseline: `6a2cf56bf3998357b422c86b11a64d3129bdfbd1`, branch `feature/source-data-discovery`. The user supplied [PR #1](https://github.com/mass-org-data/mass-cac-dashboard/pull/1). Its live review/merge state is not evidence established by this local validation. The previous implementation commits `31c6100`, `1f9356c` and `7fc8f6f` remain ancestors. Existing Phase 2A–3C documents and all migration bytes are preserved; historical publication blockers in Phase 3C documents are not current publication status.

## Migration verification results

All 986 lines across the 15 SQL migration files were reviewed. A fresh independent catalog reproduces the implemented [dictionary](DATABASE-DATA-DICTIONARY.md), [ER diagrams](DATABASE-ERD.md), [security policies](DATABASE-SECURITY-IMPLEMENTED.md) and [checksummed inventory](DATABASE-SCHEMA-INVENTORY.json) without drift:

| Surface | Result |
| --- | --- |
| Migration order/dependencies | Six foundation files precede nine core files; each has BEGIN/COMMIT. Roles/schemas/helpers precede references. File 14 adds audit integration and security; 15 installs typed RPCs. No managed Auth objects are created or replaced. |
| Relations | 23 base tables: six `mass_foundation`, 17 `mass_core`; `mass_api` contains 11 functions and no relations. Managed `auth.users` is an external dependency. |
| Definition parity | 155 columns, 27 foreign-key constraints and all catalogued PK/UNIQUE/CHECK definitions, indexes, triggers, function settings, ACLs and 71 policies match the existing inventory. |
| RLS | Enabled and forced on every table. Explicit owner helper policies are intentional; owner credentials/memberships must never reach application clients. FORCE RLS does not constrain superusers or BYPASSRLS roles. |
| Referential/history integrity | Restrictive deletion; composite episode/context FKs; date/quarter and episode-boundary triggers; immutable IDs/assignment context; closure cannot invalidate recorded facts. No automatic identity merge or historical date/scale inference. |
| Authentication/authorization | `auth.uid()` drives server-side centre scope. Leadership cannot write; teachers/COs need verified centre scope. Profile access requires an extra capability; Leadership names remain masked. Real scopes are not seeded. |
| Writes/concurrency | No direct authenticated table mutation ACLs. Typed definer RPCs use fixed `pg_catalog` search paths, qualified references, scope checks, row locks and expected versions. Stale revisions yield PT409/HTTP409. Unique constraints prevent duplicates. |
| Audit | Atomic append-only, minimized revision metadata and actor attribution. Audit failure aborts the business write. Revision metadata cannot recover previous business values. |
| Reference data | Only five confirmed attendance definitions are seeded; no students, real staff grants, source files or synthetic fixture rows are part of the migrations. |

Student IDs remain generated immutable uppercase UUID representations; no new numbering rule. Attendance remains `100 * P / NULLIF(P + A + L, 0)`, excluding WO/MM/confirmed holidays; missing remains unknown. Current assessments remain 0–25 without historical rescaling, one result per child/definition. Activity and Morarji modules retain approved nullable/explicit source semantics.

## Repeated isolated testing

Run from repository root with Docker, Bash and Python (`python`):

```sh
bash tests/foundation/run-local.sh
MASS_TEST_REST=1 bash tests/core/run-local.sh
bash tests/schema/run-local.sh
bash tests/deployment/run-local.sh
```

- **207 existing behavioral checks passed again:** 87 foundation; 102 core SQL/concurrency/attribution; 18 real PostgREST HTTP checks with synthetic signed tokens.
- **Schema parity passed:** complete catalog/document comparison and all 15 migration SHA-256 checksums.
- **Additional deployment checks passed:** read-only preflight/postflight execution; 15 catalog/security invariants; expected effective ACLs, empty-install counts and five reference definitions. The new suite injects an error into a temporary copy of migration 08, confirms its transaction rolls back while migration 07 remains, then applies the original 08 and completes the sequence. Committed migration files are never altered.

Fresh disposable PostgreSQL 17.11 containers used tmpfs, no host mounts/published ports, no external target URL and network isolation; the API test network is Docker-internal. PostgREST is 13.0.7. Container cleanup is automatic. Test Auth stubs, test principals and fixtures run only in these containers. The failure test verifies PostgreSQL transaction behavior, **not** hosted CLI ledger recovery. A hosted staging rehearsal must also prove that runner behavior.

## Hosted compatibility: evidence and limits

No connected Supabase tool, hosted development binding or approved isolated hosted target is available. No production credential was requested or used. The CLI binary retained from Phase 3B does not establish authentication or a development target. The earlier complete local Supabase stack failed to start because its database-image pull returned Forbidden; no successful full-stack/managed-Auth evidence has since been established. Production `pbkwpfdpdtelmvbkzgvx`, Mass CAC Dashboard, Mumbai/ap-south-1 is **user-identified, not live-inspected here**.

| Requirement | Local result | Managed Supabase evidence still required |
| --- | --- | --- |
| PostgreSQL version | PG 17.11 works; DDL requires PostgreSQL 15+ (`UNIQUE NULLS NOT DISTINCT`). UUID generation needs no new extension. | Actual version and allowed capabilities; staging must match the intended target. |
| Migration principal | Fresh privileged local principal can apply all files. | Actual CREATE ROLE/SCHEMA, SET ROLE, role-membership/ownership and ACL/policy/trigger authority. Supabase `postgres` must not be assumed a PostgreSQL superuser. |
| Managed Auth dependencies | Stub `auth.users(id)` and `auth.uid()` satisfy SQL dependencies; no managed definitions modified. | Auth schema USAGE, uid EXECUTE and ability to delegate column `REFERENCES(id)` to both owner roles. Check `has_column_privilege(current_user, 'auth.users', 'id', 'REFERENCES WITH GRANT OPTION')`; a table-level grant check alone is insufficient. Confirm actual user identifiers and account lifecycle. |
| Role creation | Six technical roles are NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEROLE, NOCREATEDB, NOBYPASSRLS. | Provider role restrictions; creator memberships/ADMIN/SET/INHERIT options; effective inherited permissions. Collisions stop installation rather than silently adopting roles. |
| API boundary | Real local PostgREST rejects private schema profiles, invalid signatures, forged owner roles and cross-centre requests. | Actual exposed/extra-search-path configuration and gateway behavior. Keep `mass_foundation`, `mass_core` and `auth` out of exposed schemas. `authenticated` schema USAGE for RLS/RPC dependencies is not API exposure. Do not remove unrelated existing service configuration. |
| Effective permissions | Current isolated ACLs deny public/anon/service-role access to infrastructure and direct business writes. | Inspect inherited/table/column/function/default privileges, provider defaults and authenticator memberships. BYPASSRLS does not grant ACLs, but any inherited grant may. No broad grants are justified by this report. |
| Real Auth/gateway | Synthetic JWT and actor propagation tests pass. | Actual login, issuer/JWKS verification/key rotation, refresh, expiry and sign-out/revocation semantics; real `auth.uid()` attribution. An already issued access token may remain valid until expiry: verify provider behavior against approved access requirements. Never run bootstrap Auth stubs on managed Supabase. |
| Hosted migration runner | Raw per-file SQL sequence works with error-stop and transactions. | Exact CLI version, 12-digit migration version discovery/order, ledger state, error-stop and partial-apply reconciliation on isolated managed Supabase. No unsupported version repair or stamp-as-applied. |
| Recovery | Local failed-file rollback and audit atomicity verified. | Actual backup tier/PITR availability, restore rehearsal and recovery owner/window; global roles/memberships may need separate recovery metadata. |

Schema feasibility/permissions must be established in real isolated Supabase before production approval. Actual sessions, endpoint exposure and real-user policies additionally gate activation. This report does not substitute local mock authentication for either approval.

## Updated deployment checklist and approval gates

All unchecked items require evidence before the stated stage; no approval is inferred.

- [x] Freeze implementation baseline and 15 hashes; local privacy review; preserve frontend and existing documents.
- [x] Review 23 tables, constraints, triggers, RLS and exact schema-document parity.
- [x] Repeat isolated 207 behavioral checks and additional read-only/failure-handling checks.
- [ ] **Before production schema apply:** explicit approval of exact release commit, target, 15 files, management actor and closed-install window. Review PR #1 without merging/deploying automatically.
- [ ] **Before production schema apply:** independently verify project ref/name/region/ownership, endpoint, PostgreSQL version, existing schemas/roles and full migration ledger. Resolve collisions and unexpected versions before any write.
- [ ] **Before production schema apply:** prove actual migration-role/managed-Auth delegation and effective ACL/RLS architecture on an approved isolated managed Supabase target. No broadening privileges without review.
- [ ] **Before production schema apply:** verify actual backup/PITR/export coverage and rehearse isolated recovery; approve recovery point, downtime window, operator and non-secret roles/ownership/grant recovery metadata.
- [ ] **Before production schema apply:** approve empty/closed boundary: no real grants/data/new API exposure or frontend traffic; no concurrent schema administrator. Preserve existing Vercel and other services.
- [ ] **Before actual accounts, records or endpoints:** privacy purpose/minimum fields, retention/erasure/deprovisioning, private exports, restricted exception artifacts, audit retention/access and database/API error-log redaction. Constraints may include rejected tuples in logs; minimized audit payload alone does not prevent that.
- [ ] **Before actual accounts/API use:** verify real staff identities and centre/cluster scope, grant administrators and explicit private-profile capability; approve mixed-role handling, historical visibility and real Auth lifecycle. No role label is an authorization assignment.
- [ ] **Before affected imports/operations:** adjudicate identity/year/date/source authority, calendar evidence/H/report coverage, exit-date versus exclusive-end semantics, overlap/transfer/correction workflows and assessment precision/Q-F aliases. Friendly-ID aliases and deferred modules require their own contracts when needed.

Unresolved historical/operational choices do not by themselves require redesigning this empty schema. They block affected real-data imports, permissions or frontend operations. Privacy/retention and staff assignments may follow an **explicitly approved empty closed installation**, but not real use. Technical security, target, backup, compatibility and execution authorization are schema-apply blockers.

## Read-only deployment validation queries

Prepared files (not executed on any hosted target):

1. [preflight.sql](../supabase/compatibility/preflight.sql): database/version/principal, managed dependency presence, role/schema collisions and initial RLS metadata. Supplement its table-level Auth grant check with the column-level check above. Provider identity/region, backup controls and exposed schemas require separate administrative inspection.
2. [postflight.sql](../supabase/compatibility/postflight.sql): 15 catalog invariants with expected/actual/passed, object owners, effective permission violations, role memberships, selected empty-install counts and confirmed status definitions. Every invariant must pass; ACL violation rows must be empty. Review memberships against the approved administrator plan. All business/source tables must be empty except attendance reference codes; selected counts alone do not prove every table empty.
3. [catalog.sql](../tests/schema/catalog.sql): exact metadata export for reconciliation against the frozen inventory, including complete FK/CHECK/PK/UNIQUE definitions, policies, triggers, functions, indexes and ACLs. It reads no student/Auth rows. Counts alone are not acceptance evidence. The renderer normalizes server-version differences but intentionally flags unreviewed definition/ACL drift; do not regenerate the baseline merely to hide hosted differences.

Inspect the migration ledger through the normal approved runner (`supabase migration list --linked`). Where it exists, this read-only query gives all versions without exposing stored SQL text:

```sql
BEGIN READ ONLY;
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
COMMIT;
```

If the ledger/schema does not exist before a fresh install, record that fact and verify the runner's approved initialization behavior in staging. Do not fabricate ledger rows or ignore unknown existing versions. API settings and real Auth/recovery tests are not established by SQL catalog checks. Restricted output may contain administrator role identifiers: keep actual target reports/backups out of public Git.

## Exact SQL migration deployment sequence — not executed

After separate authorization and every schema gate above: freeze reviewed SHA/hashes → inspect target/ledger read-only → rehearse on approved isolated managed Supabase → approve/test recovery → reconfirm empty/closed window → apply these files **once in the following order**, through the verified migration runner with stop-on-error and normal ledger tracking:

```text
01  supabase/migrations/202610270001_source_files.sql
02  supabase/migrations/202610270002_source_sheets.sql
03  supabase/migrations/202610270003_import_batches.sql
04  supabase/migrations/202610270004_source_rows.sql
05  supabase/migrations/202610270005_import_exceptions.sql
06  supabase/migrations/202610270006_audit_events.sql
07  supabase/migrations/202610270007_auth_scope.sql
08  supabase/migrations/202610270008_identity_history.sql
09  supabase/migrations/202610270009_academic_periods.sql
10  supabase/migrations/202610270010_attendance.sql
11  supabase/migrations/202610270011_assessments.sql
12  supabase/migrations/202610270012_named_activities.sql
13  supabase/migrations/202610270013_morarji.sql
14  supabase/migrations/202610270014_core_security_audit.sql
15  supabase/migrations/202610270015_core_api.sql
```

Then run postflight/catalog/ledger reconciliation read-only; confirm empty business/source tables and no private API exposure. All gates must remain closed until separate activation authorization. Migrations 07–13 build before final RLS integration in 14, so there must be no client use or exposure mid-sequence; stop on failure and reconcile before reopening any new surface.

Use the [Phase 3C CLI template](PHASE-3C-DEPLOYMENT-READINESS.md#supabase-cli-template-for-the-separately-authorized-execution-window) only after verifying its runner behavior in staging. Never deploy bootstrap.sql, synthetic fixtures, tests, import scripts or renderer output. Do not connect/link to production just to discover permissions.

### Failure and recovery procedure

1. Stop at the first failed file. Preserve sanitized version/error/time and actual schema/ledger state. Earlier files can remain committed; a failed file's transaction should roll back. Never continue on an aborted or uncertain connection.
2. If a connection drops near COMMIT, determine actual transaction **and ledger** state before retrying. Do not assume failure equals rollback. Never blindly rerun committed CREATE ROLE/TABLE files or mark an unknown file applied.
3. Keep the new database surface closed. Have the approved operator select a reviewed forward correction or verified restore. Prove it on the isolated target first. Published migrations are immutable; any necessary correction requires a new reviewed migration/release and regenerated parity evidence.
4. No DROP CASCADE, db reset, role deletion, destructive undo or automatic history repair is authorized. Provider restore may not restore global-role changes; reconcile approved role/ownership metadata separately. Revision-only audits do not restore old field values.
5. Reconcile all definitions, effective permissions, ledger and closed-install data state after recovery. Obtain separate authorization before any access/data/API/frontend activation.

## Handover

This phase adds this report, read-only postflight SQL, its isolated verification runner and README pointers only. The 15 migrations, existing dictionary/ERDs/security inventory, frontend and business logic are unchanged. No code publication is part of validation. Next safe milestone: obtain an approved **isolated managed Supabase** target and migration operator, prove the outstanding provider/Auth/runner/recovery gates with synthetic data, then request approval for a frozen empty/closed hosted install. Production remains NO-GO until those gates and separate execution authorization are satisfied.
