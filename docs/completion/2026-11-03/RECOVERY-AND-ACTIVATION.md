# Operator-managed recovery and controlled activation

The user does not want to run a manual backup personally. An assigned database/recovery operator should own this work; the existing project can be retained and no paid resource needs to be created automatically.

## Fresh provider evidence

The backup API lists 0 backups; PITR is disabled; WAL tooling is reported enabled. That is not evidence of an accessible, recoverable project snapshot. Provider-internal backups cannot be assumed usable. No current production backup or restore rehearsal was created in this continuation. The previous synthetic rehearsal is dated local evidence, not verification of today's hosted data.

Options:

- **Recommended:** an existing authorized operator runs a supported PostgreSQL 17 logical backup on private encrypted storage, verifies completeness and rehearses recovery in an approved isolated facility. The user supplies an operator/access route, not personal command execution.
- A provider-supported export/restore point is acceptable if Supabase supplies verifiable project identity, coverage, time, retention and restore evidence. None is currently evidenced.
- Paid backup/PITR changes require separate financial approval. No paid plan or project is created to bypass the gate.

## Private operator procedure

Use the full [production preflight backup procedure](../../PRODUCTION-MIGRATION-PREFLIGHT.md), including roles, memberships, ownership, grants/default ACLs, RLS/policies/functions/triggers, data, migration ledger, sequences, extensions and Auth recovery dependencies. That document remains unchanged. Credentials and backup contents stay outside Git, public artifacts, build inputs and chat.

1. Obtain the approved direct/session connection from the target dashboard; verify pbkwpfdpdtelmvbkzgvx, Mumbai, postgres and TLS. Use port 5432, not transaction-pooler 6543. Use a DDL-free capture window and identify recovery owner/custodian.
2. Private encrypted output directory mode 0700; umask 077. Keep `PGSERVICEFILE` and `PGPASSFILE` outside both repository and archive, mode 0600. Service `mass_backup` contains only connection/TLS settings (`sslmode=verify-full`, approved CA); password stays in PGPASSFILE. No password URI/argument/history, PGPASSWORD, shell tracing or credential screenshots.
3. Run with PostgreSQL 17 clients (or reviewed compatible newer version), checking every exit/warning:

```bash
pg_dump --no-password --dbname='service=mass_backup' --format=custom --file=database.dump
pg_dumpall --no-password --database='service=mass_backup' --roles-only --no-role-passwords --file=roles.sql
pg_restore --list database.dump > archive.list
pg_restore --schema-only --file=schema-review.sql database.dump
sha256sum database.dump roles.sql archive.list schema-review.sql > BACKUP.sha256
sha256sum -c BACKUP.sha256
```

4. Confirm every required schema/data set, ledger, privilege/default privilege, SET/INHERIT membership, owner, RLS/policy/trigger and provider/Auth dependency is covered. Metadata and role files are sensitive too. If managed-object access fails, stop and obtain a supported export/coverage resolution; do not weaken grants or hide warnings. pg_dump does not cover Storage bytes, signing secrets or external OAuth configuration.
5. Rehearse in an approved restricted isolated recovery facility; do not restore into production. Preserve security/ownership checks—do not blanket-ignore owner/ACL errors or blindly replay managed provider roles. Production data in recovery storage remains private and must have approved access/retention. Compare counts, object definitions, history and authorization behavior; record recovery duration/limitations. Integrity/listing alone does not prove restoration.
6. Record only private artifact location/custodian, integrity, coverage, recovery results and approval evidence in the deployment record. Never publish dumps or credentials.

## 020–023 only, after recovery and execution gates

Verify all 23 migration hashes from `supabase/compatibility/MIGRATIONS.sha256`; none was changed. Read-only020023-preflight must match the current 19-entry baseline/27 tables and no new objects. Old 001–017 history uses provider aliases; do not use bulk db push, include-all, repair history or replay earlier files.

Exact order:

1. 202610290020_original_workflows.sql
2. 202610290021_cluster_officer_visits.sql
3. 202610290022_activity_delivery.sql
4. 202610290023_programme_aggregates.sql

Use only the reviewed trusted runner. Each actual DDL transaction and its real history entry must commit atomically; never stamp an unapplied migration or fabricate a successful ledger entry. Stop at the first error. Read the actual transaction/history/object state; roll back the failed open transaction, retain successful earlier commits and prepare a reviewed resume/forward correction. No reset, object deletion, blind replay or automatic production restore.

After each file verify its actual ledger/source identity and data invariance. Final read-only postflight expects 32 tables / 230 columns / 45 validated foreign keys / 115 policies; forced RLS, closed anonymous/service RPC ACLs, private schema exposure unchanged, old data unchanged and new operational relations empty. Catalog owner privileges are not proof that actual hosted DDL will succeed. Managed Auth and isolated operational write-UAT remain separate mandatory checks.

## Auth/Preview operator gates

- Existing Vercel team/project IDs must be verified through an authorized connection; Production stays main. Deploy only protected Preview, without --prod, after backend readiness. Existing Git build suppression remains intact.
- Verify exact application origins, then replace broad provider wildcard Auth redirect rules with exact approved MASS origins/routes. Do not guess a new host or change settings before target ownership is checked.
- Validate SMTP/provider delivery to actual approved staff addresses; custom SMTP is currently absent and no recovery email has been tested. Keep SMTP credentials private. Review signup/invitation policy; no default scope grant or self-service programme role is permitted.
- Actual staff identities and centre/shift scopes must come from the forthcoming spreadsheet. Current centre grants do not enforce narrower Morning/Evening scope. Do not grant both shifts or create Leadership accounts to avoid that limitation.

Exact provider configuration is retained in the private operator packet rather than the public repository or source download.
