# Supported recovery options and controlled activation

## Fresh verified state — 4 November 2026

Target pbkwpfdpdtelmvbkzgvx, Mumbai/ap-south-1; PostgreSQL 17.11. Read-only Management queries run as supabase_read_only_user, not as the migration execution principal. The intended deployment principal remains postgres; catalog inspection proves its SET/INHERIT access to mass_core_owner, not that every managed DDL operation will succeed.

Hosted state:19 recorded migrations (001–019),27 MASS tables,108 policies; forced RLS enabled on all existing MASS tables; no unvalidated constraints.1,458 students/enrolments,47,323 attendance records,207 assessment results. Actual activity events/participation, cohorts/memberships and Morarji outcomes are all absent.020–023 and024 have not been applied. Historical provider aliases for001–017 remain in the real ledger; do not rename or “repair” them.

The official Management backup GET lists 0 backups; PITR is false; WAL tooling is true. WAL enabled is not a recoverable export or promised restore entitlement. Official OpenAPI was inspected read-only at https://api.supabase.com/api/v1-json. It exposes backup listing, restore/PITR operations, scheduling and an internal restore-point route. The restore-point GET returns 400, “This endpoint is unavailable at the moment”; it is marked x-internal. Schedule GET returns 402 and the schema identifies Enterprise-only scheduling. This does not establish the full billing plan, and changing schedule is not taking a backup. No restore, undo, restore-point creation, schedule update, upgrade or purchase was attempted. Public documentation pages were network-blocked; exact current pricing/eligibility is not claimed verified.

**Actual production backup created: NO. Actual hosted-data restore rehearsal: NO.** No accessible recovery point, native backup credential, approved encrypted recovery location or named operator currently exists in this environment. The Management token is not treated as a PostgreSQL password, and JSON table reads are not substituted for a consistent recoverable backup.

## Options for the user to authorize — no personal backup execution required

| Option | Required arrangement | Current status / cost boundary |
|---|---|---|
| Existing-plan logical backup by an authorized database professional | Appoint an administrator/operator; provide native connection through a private credential channel and approved encrypted storage/recovery facility. Operator performs and verifies the procedure below. | Recommended route if a qualified existing operator is available. No new Supabase/Vercel resource or automatic paid service is required by this procedure; operator/facility availability is not assumed. |
| Provider-assisted recovery arrangement | Authorize an administrator to open the prepared support request. Supabase must confirm a supported accessible backup/export and isolated restore verification, coverage, retention and operator responsibility. | No provider commitment or no-cost support entitlement is assumed. Internal restore-point endpoints are not a workaround. |
| Paid supported backup/PITR capability | Obtain exact provider eligibility, price, retention and restore/isolation requirements, then seek explicit financial approval. Create/verify a real recovery point and test the supported recovery path after approval. | Not purchased or enabled. An upgrade alone is not evidence that a backup exists or is recoverable. |

Relevant provider references: https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/reference/cli/supabase-db-dump. Provider confirmation is required where managed Auth/roles, exports or restore limitations differ from ordinary PostgreSQL. Existing source-recovery documentation remains preserved.

## Exact operator procedure

1. Operator obtains the existing verified target connection from Dashboard Connect using an approved private credential channel. Use PostgreSQL 17 clients, certificate-verified TLS and a direct/session connection (5432), not transaction-pooler6543. Do not reset the database password, change provider roles, pause Vercel or disconnect GitHub as a shortcut. Any unavoidable password rotation needs its own coordinated decision.
2. Approve encrypted storage outside public Git/builds/chat and an isolated recovery facility with controlled access/retention for real data. No paid recovery project is created without financial approval. Set umask 077; directory 0700; credential files 0600. Service mass_backup contains connection/TLS settings in PGSERVICEFILE; password only in PGPASSFILE. No password URL/argument, PGPASSWORD, tracing or credentials in evidence.
3. Coordinate a DDL/role/grant-stable capture window. Run every command with error-stop and inspect warnings; these commands are for the appointed operator, not a request for the user to run a backup:

```bash
set -euo pipefail
umask 077
pg_dump --no-password --dbname='service=mass_backup' --format=custom --file=database.dump
pg_dumpall --no-password --database='service=mass_backup' --roles-only --no-role-passwords --file=roles.sql
pg_restore --list database.dump > archive.list
pg_restore --schema-only --file=schema-review.sql database.dump
sha256sum database.dump roles.sql archive.list schema-review.sql > BACKUP.sha256
sha256sum -c BACKUP.sha256
```

4. Capture/reconcile schema, data, actual migration ledger, identities/sequences, roles/memberships (including SET/INHERIT), ownership, grants/default ACLs, RLS/policies, triggers/functions, extensions and managed Auth dependencies. CLI-default schema exclusions, missing managed objects and permission warnings must be resolved explicitly. Archive listing/checksums alone are not completeness or recovery proof. Logical dumps do not contain Storage file bytes, external email/OAuth configuration or signing-secret configuration; record separately where applicable. No backup contents or private recovery metadata goes into Git.
5. Restore in the approved isolated facility only. Do not blindly replay managed provider roles, ignore owner/ACL failures, disable RLS or restore into production. Compare relation/row/sequence counts, source-to-target identities, ledger, functions, trigger behavior, permissions and scoped authorization. Record actual recovery duration, limits, coverage and evidence. Real backup data must not enter public/synthetic test fixtures.
6. Record the recovery owner, verified target/time/release, private artifact custody, hashes, coverage, actual restore verification, remaining limits and the controlled execution window. Do not invent retention periods or expose credential paths/content publicly.

## Controlled020–023 deployment — prepared, NOT executed

GO requires verified recovery evidence plus the existing execution/security gates. User conditionally authorizes reviewed activation after recovery; do not repeatedly request that same scope. Proposal 024 remains a separate review/approval gate.

1. Freeze the approved commit and verify all 23 canonical hashes in supabase/compatibility/MIGRATIONS.sha256. Confirm target/project/region, actual migration principal and existing001–019ledger aliases. Re-run020023-preflight read-only. Unexpected objects, versions, constraints, grants, source changes or health changes stop execution; never replay001–019.
2. Through an approved operator/trusted runner, take a migration lock and execute exactly these reviewed files in order, with error-stop and each real ledger insert atomically committed with that file's DDL:
   -202610290020_original_workflows.sql
   -202610290021_cluster_officer_visits.sql
   -202610290022_activity_delivery.sql
   -202610290023_programme_aggregates.sql
3. Do not use blind db push/include-all/history-repair, stamp an unapplied migration or append a ledger entry after a separately committed DDL failure. The chosen native/provider runner must actually prove its transactional ledger handling; selection/access is an operator dependency, not a claimed completed hosted test.
4. After each file, verify real ledger identity, expected objects/owners/ACLs and preservation of existing data. Any error stops subsequent files. Roll back an open failed transaction, inspect actual state and preserve earlier successful commits. Resume only from the next proven unapplied file after a reviewed correction. No resets, object removal, blind replays or automatic production restore.
5. Run020023-postflight:32 tables / 230 columns / 45 validated foreign keys/115policies; forced RLS and private schema exposure unchanged; new operational relations empty and existing records preserved. Test actual configured Auth/API behavior with approved staff, independently of synthetic tests. No fictitious staff grants/accounts or synthetic production records.
6. Review024 separately. Its local security/math tests pass; existing file SHA stays frozen. Promote to a migration and generate a new manifest only after separate approval, with the same recovery/transactional checks. Never silently include it in020–023activation.
7. Deploy only the exact reviewed feature commit to protected Preview through authorized existing Vercel access. Verify project target, environment values/session behavior and real reads. Do not merge main, use --prod, bypass protection or claim a new Preview passed because the previously accepted baseline works.

Current recommendation: **NO-GO for hosted activation; GO for code review and isolated testing.** Recovery arrangement is the primary unavoidable infrastructure gate. Staff mapping/source completeness and unsupported deletion/sensitive-note semantics are separate operational activation matters, not excuses to replay or redesign the database.
