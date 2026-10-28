# Final production migration preflight

Updated 28 October 2026 (India). **NO-GO for production apply until the corrected release is reviewed and separately authorized.** See the [PostgreSQL 17 role-membership correction](POSTGRES17-ROLE-MEMBERSHIP-FIX.md) for the user-reported failed attempt and retry prerequisites. Local validation passes; actual managed Supabase permissions, isolated hosted compatibility and a production recovery point/restore rehearsal remain unverified. This phase prepares and commits safe local documentation/checks only. It does not connect to the hosted database or take its backup.

Target supplied by MASS: `pbkwpfdpdtelmvbkzgvx` — Mass CAC Dashboard — Mumbai (`ap-south-1`). Review: [PR #1](https://github.com/mass-org-data/mass-cac-dashboard/pull/1), feature branch `feature/source-data-discovery`. Do not merge or deploy Vercel as part of this procedure.

## Frozen release inputs

The release retains 15 files. Production 001–006 are reported applied and are locked byte-for-byte to `625c458fabb7bc7b8b6e98744f53489c21876bb0`. Only 007/014 now change to remove managed Auth privilege delegation; see [the current resume handoff](MIGRATION-007-AUTH-RESUME.md). Do not replay foundation, pre-create roles, reset or repair history. [MIGRATIONS.sha256](../supabase/compatibility/MIGRATIONS.sha256) records all 15 hashes, matched to the regenerated [inventory](DATABASE-SCHEMA-INVENTORY.json). From the repository root:

```sh
sha256sum --check supabase/compatibility/MIGRATIONS.sha256
```

The Auth correction commit packages the two remaining-version amendments, regenerated evidence, invoker helper and direct-only Auth regression tests. Record its full SHA with `git rev-parse HEAD` in the restricted release record; approve that exact commit separately before deployment. Verify exactly 15 files in `supabase/migrations`, no additional pending ledger versions and a clean release checkout. A hash manifest freezes content, not hosted execution authorization. If SQL or pending versions differ, stop and review a new release; do not edit the manifest to conceal a mismatch.

## Concise approval checklist

| Gate | Status / required evidence |
| --- | --- |
| Frozen SQL and model parity | PASS locally: 15 files, 23 tables, 155 columns, 27 FKs, 71 policies; six foundation and nine core files. Auth lookup wiring changes only; all table/key definitions and RLS authorization semantics retained. |
| Local behavioral/security checks | All 207 behavioral checks pass again on corrected SQL. Read-only reports, 171 function/role checks, restricted role-bootstrap rollback/retry and synthetic archive restore also pass. |
| Definer review | All 19 reviewed; fixed search paths, qualified references, restricted local EXECUTE ACLs. [Per-function review](PRODUCTION-DEFINER-REVIEW.md). Hosted effective ACLs/memberships still unverified. |
| Target/owner/region/endpoint | User-reported live PG 17.11/Auth presence and intended target. Administrator must verify the correct endpoint/principal and absence of intervening changes before the retry. |
| Managed role/Auth compatibility | NOT PASSED hosted. 007–015 passes locally with direct Auth rights and no Auth grant options, existing owner memberships and a separate managed Auth owner. No new definer or Auth-schema/table grants to owner roles. Prove equivalent actual principal capabilities in isolated managed Supabase. |
| Existing objects/ledger/security conflicts | User reports six committed foundation versions/tables and no core/API schemas or core tables. Confirm ledger 001–006 and intact foundation before resuming 007; stop on leftovers or unknown versions. |
| Free-project backup and restore | NOT TAKEN/NOT PROVEN hosted. Follow the private manual procedure below; no automatic backup/PITR assumption. |
| Closed-install boundary and recovery window | Requires explicit approval of administrator, exact release, target, backup evidence, window and recovery procedure. No real users/grants/data/API activation. |
| Execute production migrations | NOT AUTHORIZED. Separate authorization is required after gates pass. |

## Manual backup for the Supabase Free project — prepare now, execute only in an approved window

Do not rely on a Free project's Dashboard automatic-backup download or PITR. Use a manual logical database backup plus non-secret role/ownership/membership metadata. Confirm current plan capabilities in the actual Dashboard. Supabase guidance: [database backups](https://supabase.com/docs/guides/platform/backups) and [CLI database dumps](https://supabase.com/docs/reference/cli/supabase-db-dump). CLI defaults can exclude managed schemas; they are **not** evidence of complete Auth/Storage coverage. This runbook uses an explicit native PostgreSQL custom-format dump with no schema exclusions, subject to verified provider permissions.

### 1. Prepare restricted storage and access

- A named administrator uses a private workstation and an approved encrypted filesystem outside every Git checkout, shared Drive folder, cloud-build workspace and CI artifact path. Never save a backup in this public repository, even temporarily. Set `umask 077`; directories mode `0700`, files mode `0600`. Keep an approved encrypted off-device copy and restrict access/audit. Retention and destruction require owner approval; no retention duration is invented here.
- Use a PostgreSQL client matching the server major version (or a validated newer dump client); record client/server versions. Use the verified direct connection or session-mode pooler with correct user/host/port. Do not use transaction pooling for backup. Preserve certificate-validated TLS (`sslmode=verify-full` and the approved CA); do not silently weaken TLS to fix connection errors.
- Store host/database/user/TLS settings in a private mode `0600` libpq service file (`PGSERVICEFILE`), service name `mass_backup`. Store the database password in a separate private mode `0600` `PGPASSFILE` using libpq's escaping rules, supplied by the approved password manager. Do not include passwords in service entries, URLs, shell arguments/history, Git, chat, screenshots, logs or `PGPASSWORD`. These files stay outside the repository and outside the backup archive.
- Set `PGSERVICEFILE`/`PGPASSFILE` privately in the operator shell; use `--dbname='service=mass_backup'` so process arguments contain no connection string. Disable shell tracing and terminal/session recording of credentials. Do not print env or the private files. Ensure no conflicting libpq variables redirect the target; verify the resolved target privately before proceeding.
- Approve a period without concurrent schema/role/grant changes. Database contents are captured by pg_dump's consistent snapshot; roles/metadata captured separately are not one atomic cluster snapshot. Coordinate any existing service activity as needed for recovery requirements. Do not pause Vercel or disconnect GitHub.

### 2. Capture the backup — manual operator commands, NOT run here

Run only on that approved workstation, with credentials configured privately and the approved private encrypted path substituted. These are backup/metadata commands, not permission to execute hosted migrations.

```sh
set -euo pipefail
set +x
umask 077
MASS_BACKUP_ROOT='/absolute/private/encrypted/backup-root'
MASS_BACKUP_DIR="$(mktemp -d "$MASS_BACKUP_ROOT/mass-pre-migration.XXXXXX")"
chmod 700 "$MASS_BACKUP_DIR"
pg_dump --version > "$MASS_BACKUP_DIR/client-version.txt"
pg_dump --no-password --dbname='service=mass_backup' --format=custom \
  --file="$MASS_BACKUP_DIR/database.dump" 2> "$MASS_BACKUP_DIR/database.stderr"
# Stop immediately on a nonzero exit. Review warnings privately before continuing.
pg_dumpall --no-password --database='service=mass_backup' --roles-only --no-role-passwords \
  --file="$MASS_BACKUP_DIR/roles.sql" 2> "$MASS_BACKUP_DIR/roles.stderr"
# Stop immediately on a nonzero exit. Never substitute a password-bearing roles dump.
pg_restore --list "$MASS_BACKUP_DIR/database.dump" > "$MASS_BACKUP_DIR/archive.list"
pg_restore --schema-only --file="$MASS_BACKUP_DIR/schema.sql" "$MASS_BACKUP_DIR/database.dump"
psql --no-password --dbname='service=mass_backup' -X -v ON_ERROR_STOP=1 \
  --file=supabase/compatibility/production-preflight.sql \
  > "$MASS_BACKUP_DIR/preflight.txt" 2> "$MASS_BACKUP_DIR/preflight.stderr"
(cd "$MASS_BACKUP_DIR" && sha256sum database.dump roles.sql schema.sql archive.list \
  client-version.txt preflight.txt database.stderr roles.stderr preflight.stderr > SHA256SUMS)
chmod 600 "$MASS_BACKUP_DIR"/*
```

Execute with error checking; never continue after any failed step. The psql file path assumes the frozen repository is available as a read-only input; outputs remain private. `roles.sql` includes privileged/provider role definitions and memberships, even without passwords: treat it as restricted recovery metadata. Dumps/role settings can contain existing embedded secrets; `--no-role-passwords` is not general redaction. Review privately, never expose them, and keep source connection/password files outside the archive. Record backup timestamp (UTC and India time), source release SHA/hashes, target/version, backup operator, snapshot coverage, all exit statuses, warnings and preflight/ledger evidence privately. Do not copy output into Git or public PR comments.

### 3. Define and check completeness before calling it a recovery point

- Require successful exits and review every warning. Validate `SHA256SUMS` after copying to the approved off-device location. File existence, nonzero size and `pg_restore --list` alone do not prove completeness or restorability.
- Privately inventory all source schemas, tables/partitions, extensions, functions, policies, triggers, owners, ACL/default ACLs and existing ledger versions. Compare with the archive TOC and schema SQL; identify intentional non-dumpable/provider-managed objects and document their restoration method. Include unrelated existing application schemas and their data if this is a whole-database recovery plan. Do not silently exclude permission-denied objects to obtain a green exit.
- An empty MASS schema does not prove the existing project database is empty. Check source table coverage and snapshot-consistent counts or approved reconciliation totals; record when counts were taken. Under ongoing writes, later counts may legitimately differ from the dump snapshot: use coordinated quiescence or a reviewed exported-snapshot procedure before claiming exact equality.
- Confirm `auth`/`storage` relational coverage and restore feasibility explicitly. If the actual provider principal cannot dump required tables, functions or global metadata, stop and obtain a supported provider export/recovery method or approved scoped coverage. A partial archive is not a whole-project backup. No production permission widening is authorized to make the dump work.
- Database dumps do **not** back up Storage object bytes, Edge Function deployments, API/Auth secrets/signing keys, provider project configuration, OAuth settings, network rules, external services or other external state. Record configuration/recovery references in approved secret/config stores and inventory any stored objects separately. If any exist, obtain separately approved private backup/recovery coverage before accepting a whole-project recovery claim. Credentials/signing keys do not belong in the non-secret metadata package.
- `--no-role-passwords` deliberately omits login secrets. Existing provider roles/passwords are recovered through approved credential/provider controls, not copied from this dump. Inventory memberships, ADMIN/SET/INHERIT options, object ownership and default privileges separately; `pg_dump` alone does not preserve cluster globals. Verify tablespace/extension/provider prerequisites if any. Source connection settings and password files are never archive inputs.

### 4. Rehearse recovery in isolation

An authorized administrator provisions or selects a disposable **isolated** target with compatible PostgreSQL/extensions and managed Supabase Auth/Storage where needed. No production connection or application traffic is used for restore experiments. Production backups may contain sensitive Auth/application data even before MASS imports: restrict restoration, outbound networking, access and disposal, and obtain the corresponding privacy approval. Synthetic-only rehearsals are safe initial evidence but do not prove recovery of the actual archive.

1. Validate checksum and archive readability. Inspect role SQL and schema/TOC before executing anything. Reconcile required custom roles and owners with the isolated target. **Never blindly replay globals:** provider roles already exist and cannot be recreated or promoted to superuser. Skip/translate provider-owned definitions only through an explicit reviewed restore plan. Do not run `roles.sql` on production.
2. Restore the full archive into the disposable target using the approved role map and `pg_restore --exit-on-error`. Avoid `--clean` or destructive options on any existing target; isolate first. Supabase-managed objects may need the provider-supported logical restoration workflow rather than a generic full replay. Permission/ownership/extension errors are rehearsal failures to resolve, not warnings to ignore. No blanket `--no-owner/--no-acl` shortcut can certify production ownership/security restoration.
3. Verify all agreed schema/data coverage, source/restore reconciliation totals, Auth/Storage prerequisites, ledger, memberships, owners, ACL/default ACLs, function settings, constraints, triggers and policies. Run representative real Auth/RLS access tests only with approved isolated identities. Database consistency is insufficient if permissions or provider services do not recover.
4. Record restore duration, recovery point and any manual actions; have the recovery owner accept the recovery-time/data-loss limits. Securely remove disposable data/credentials according to the approved policy. Keep actual backup/rehearsal evidence private; commit only sanitized status summaries.

**Local evidence:** the isolated synthetic deployment suite successfully takes a native custom archive, restores it to a fresh database in the same disposable cluster and obtains identical postflight output. Existing cluster roles are reused, so provider/global-role replay and a real production archive restore are **not** verified by that test.

## Migration 007 Auth follow-up

The user reports 001–006 succeeded and 007 failed with schema auth 42501. Direct Auth rights do not imply delegation; an attempted GRANT can warn without granting anything, leaving the owner unable to resolve Auth objects. Local reproduction and the corrected direct-only path are documented in [MIGRATION-007-AUTH-RESUME.md](MIGRATION-007-AUTH-RESUME.md). The exact hosted failing statement and grant options have not been inspected here. Foundation remains untouched by this correction.

## Managed role and SECURITY DEFINER acceptance

- All six fresh roles are NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOBYPASSRLS. Files 01/07 create them; files subsequently use SET LOCAL ROLE for ownership. PostgreSQL 16+ creator/ADMIN/SET/INHERIT semantics and Supabase role restrictions must be tested with the actual intended migration principal. `rolcreaterole=true` alone is not proof that every owner/grant operation will succeed. Do not assume hosted `postgres` is a superuser.
- **Production failure and correction:** the user reports SQLSTATE 42501, must be able to SET ROLE mass_foundation_owner, using hosted postgres. PostgreSQL 17 creator ADMIN authority does not imply SET/INHERIT. Corrected files 01/07 grant their new owner role to CURRENT_USER WITH SET TRUE, INHERIT TRUE before schema/ACL work. The restricted local model now applies all 15 corrected files with default creator settings; no session override or superuser/BYPASSRLS is needed. These grants are only for the trusted deployment principal, not public/API/staff roles. Grant/admin authority and managed Auth delegation still require provider verification.
- Verify database CREATE/schema ownership, ability to SET ROLE each owner, grant delegation and policy/trigger/default-ACL authority. Unknown existing MASS roles/schemas are collisions, not objects to adopt automatically.
- Corrected files 07/14 require only the deployment principal's direct managed Auth schema USAGE, uid EXECUTE and auth.users(id) REFERENCES, without grant options. The principal installs Auth FKs while application tables retain their private owners. A private SECURITY INVOKER SQL-standard wrapper binds managed auth.uid(); core owner must already have EXECUTE on that function, normally via its existing PUBLIC function ACL. Missing rights fail closed for provider authorization; do not broaden grants. Managed Auth definitions are unchanged.
- Review [all 19 definers](PRODUCTION-DEFINER-REVIEW.md) and effective inherited execution privileges. No local PUBLIC/anon/service_role EXECUTE exists. Authenticated can execute approved RPCs/scope predicates; owner-only guards/audit/helpers remain restricted. Schema exposure and authenticator memberships must match the approved boundary.
- All 23 tables enable/force RLS. Owner helper policies are deliberate privileges; owner membership or superuser/BYPASSRLS access remains powerful. Real staff grants and profile capability are server-controlled and still unassigned. Local signed test JWTs prove neither managed issuer/JWKS/session lifecycle nor provider grant feasibility.

Repeat the local model with `bash tests/deployment/run-role-probe.sh`. It creates only a fresh network-isolated disposable cluster with test-only Auth objects, tests temporary legacy failures and corrected-bootstrap rollback/retry, then the full corrected sequence without creator-setting overrides. It accepts no hosted target. The exact provider principal, managed Auth definitions/grants and existing memberships remain untested.

## Read-only checks and exact apply order

Prepared SQL reads no student/Auth record values and makes no grants or repairs:

- [production-preflight.sql](../supabase/compatibility/production-preflight.sql): psql report for principal/version, managed objects and delegable privileges, existing schemas/relations/functions/owners/ACLs, role memberships/default grants, API hints and existing migration versions. Missing ledger is reported; unexpected versions or unapproved collisions stop a fresh install. Metadata cannot prove role creation/ownership operations for absent roles; staging execution remains required.
- [postflight.sql](../supabase/compatibility/postflight.sql): expected **23 tables, 155 columns, 27 FKs, 71 policies**, forced RLS, role/function invariants, invalid/disabled objects, effective permission violations, memberships, all 22 non-reference-table count and the five confirmed attendance codes. Require every check passed, no unexplained effective privilege violations and every non-reference table empty.
- [catalog.sql](../tests/schema/catalog.sql) plus the frozen [inventory](DATABASE-SCHEMA-INVENTORY.json): compare exact column/key/check/FK/index/trigger/policy/function/ACL definitions. Counts alone cannot certify correctness. Hosted-normalization differences require explicit reconciliation, not silently regenerated baselines.

None has run on production. SQL session API hints do not establish the Dashboard/gateway exposed-schema settings; inspect those independently. Keep `mass_foundation`, `mass_core` and `auth` out of Data API exposure. The intended curated `mass_api` surface remains unactivated until separately approved.

For the reported partial installation, the [007–015 resume handoff](MIGRATION-007-AUTH-RESUME.md) takes precedence: retain the six applied versions, verify direct permissions and a private backup, obtain separate authorization, then apply only the nine pending versions with error-stop. Never replay 001–006. Postflight must reconcile 15 total recorded versions and the full model. The [Phase 3D runbook](PHASE-3D-DEPLOYMENT-VALIDATION.md#exact-sql-migration-deployment-sequence--not-executed) lists every exact filename and the [Phase 3C CLI template](PHASE-3C-DEPLOYMENT-READINESS.md#supabase-cli-template-for-the-separately-authorized-execution-window) remains approval-dependent. Verify 12-digit version parsing and ledger/error-stop behavior in staging. Never apply Auth stubs, tests, fixtures or seeds to production.

## Stop conditions and manual recovery

Stop before/while applying on any target/hash/ledger mismatch, failed backup/restore, unapproved object collision, missing role/Auth capability, unexpected API exposure, source-row presence, SQL error, permission widening, RLS/ACL/catalog drift or unexpected client traffic. Files 07–13 precede final core security in 14, so never allow client use mid-sequence. Only the remaining 007–015 versions may run on the reported production state.

On the first failure, stop the runner; do not run later files. Preserve sanitized error/version/time and inspect actual schema and ledger privately. Earlier transactions may be committed. Failed-file rollback was tested locally, but a disconnect near COMMIT creates uncertain state: verify both database and runner ledger before any retry. Do not stamp versions applied, force history repair or rerun committed CREATE statements blindly.

The approved recovery operator chooses a reviewed forward correction (new migration, retested in isolation) or the rehearsed recovery process. Do not edit frozen migrations, DROP CASCADE, reset the database, delete roles or blindly replay a dump into production. Any production recovery write needs explicit approval of the concrete action and target. Reconcile schema, ledger, globals and permissions afterward. Revision-only audit metadata cannot restore old field values. Keep the new surface closed until every verification passes.

## Keep release stages separate

1. **Empty schema:** 15 migrations, five attendance reference definitions, no staff memberships/centre grants, personal/source rows, new API exposure or frontend traffic. Requires the technical/backup/target gates and separate apply approval above.
2. **Staff activation:** separately approve actual Auth identities, verified centre/cluster scopes, administrator authority, private-profile access, privacy/retention/audit/deprovisioning and real Auth/RLS tests.
3. **Frontend integration:** separate adapters/contracts, Preview validation and release approval. Current frontend/Vercel remain untouched.
4. **Historical migration:** separate identity/source/date/year/calendar/exit/assessment adjudication, restricted exceptions, deferred-module readiness, reconciliation and import authorization. No name-only merging or invented data.

The present recommendation remains **NO-GO for production** until evidence and explicit authorization close the schema gates. Next safe work is approved isolated managed-Supabase compatibility and recovery validation; no production experiment substitutes for it.
