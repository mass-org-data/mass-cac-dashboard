# Phase 3A — local technical foundation handover

27 October 2026 (Asia/Calcutta). Authority: user's “Phase 3A Authorization: Local Foundation Development” request. It authorizes these six technical relations, local SQL development and isolated synthetic tests. It supersedes earlier wait-for-implementation statements **only for this local scope**. It does not approve production privacy/retention rules, real accounts, source adjudication, business tables or hosted application. Existing Phase 2A–2E documents remain review/evidence history; no workbook audit was repeated.

## Delivered migrations

All six are in `supabase/migrations/` and are ordered, transaction-wrapped fresh-install migrations:

| File | Relation and responsibilities |
| --- | --- |
| 202610270001_source_files.sql | Private schema, non-login technical roles, default-deny permissions, immutable snapshots and shared mutation guard |
| 202610270002_source_sheets.sql | Immutable sheet occurrence, file FK, unique file/ordinal and known native ID |
| 202610270003_import_batches.sql | Versioned execution metadata, state transitions, monotonic checkpoint, explicit reconciliation counts, server revisions/times |
| 202610270004_source_rows.sql | Immutable physical row occurrence, sheet/batch FKs, row-number idempotency and restricted fingerprint |
| 202610270005_import_exceptions.sql | Allowlisted issue codes, NULL-aware duplicate prevention, restricted review transition and database-principal attribution |
| 202610270006_audit_events.sql | Minimized append-only audit, fixed-search-path definer trigger and transactional auditing of the five other relations |

Exactly six tables exist in **mass_foundation**, a private schema. No public views, application RPCs, Auth resources, business tables, storage buckets, external connections, extension installs, real grants or Supabase link/config were added. PostgreSQL 15+ is required for UNIQUE NULLS NOT DISTINCT; tested on PostgreSQL 17.11. Actual hosted version/role-management permissions remain unverified. These files have not been applied to any hosted database.

## Minimized field contract and deviations from the review draft

Phase 2B proposed richer provenance. This local version deliberately implements the necessary technical subset permitted by Phase 3A:

- source_files: UUID, optional opaque original file ID/version, SHA-256, opaque artifact UUID storage_ref, known export time and server receipt time. No original filename, signed URL, path or source content. Artifact UUID resolution/storage is a later separately approved service; no store was created.
- source_sheets: UUID, file FK, optional native ID, ordinal, technical classification and header_version. No sheet display name or arbitrary header_spec JSON. Versioned header mappings can be designed later without copying headers containing private information.
- import_batches: UUID, mapping/extractor versions, explicit technical state, timestamps, numeric checkpoint, extracted/accepted/quarantined/excluded occurrence counts and row_version. No arbitrary checkpoint/count JSON or error dump. Accepted means the run's reconciliation category, not permission to import business data. No canonical business tables exist to populate.
- source_rows: UUID, sheet/first-batch FKs, positive physical row_number, fingerprint and technical classification. No source person identifier, payload/ref, raw cells or name-based link. Fingerprints are private and not person keys; identical fingerprints may occur at different row positions. Reviewed canonical-source equivalence/self-links are deferred, not automatically inferred. The first batch is immutable; later batches can reference the same row through exceptions without rewriting origin.
- import_exceptions: UUID, batch/row FKs, optional field ordinal, fixed reason_code, review state/resolution code, database resolver/time and row_version. No free-text resolution_note, copied invalid value or personal detail. Different-run exceptions for the same frozen source occurrence are permitted; NULL field ordinals do not evade same-run uniqueness. No field/cell content is copied.
- audit_events: UUID, actual database login/active role, allowlisted entity type/UUID and INSERT/UPDATE operation, actual server time, optional batch FK and metadata containing **revision only**. No values, arbitrary field JSON, client-supplied user identity, query text or before/after payload. Audit entity UUID is intentionally not a polymorphic business FK and remains durable.

All identifiers and version tokens are for technical references only. Shape/length constraints are not a semantic PII detector: future trusted import code must not put names/contact information into identifier slots. No real source files, hashes, row references or accounts are in fixtures. Private metadata is not made public merely because names are omitted.

No auth.users FK is introduced in this PostgreSQL-only foundation. resolved_by and actor_database_principal identify the actual database session principal; they are **not a claim of end-user Auth attribution**. A future pooled service must have a reviewed, trusted user-attribution bridge before handling user actions. Client JWT GUCs are deliberately ignored. No actor or event time is invented for historical source records.

These narrow omissions are not approvals to discard historical evidence. No source artifacts were changed/deleted/imported. Restoring richer private metadata, canonical-equivalence history or real user linkage requires a reviewed follow-up migration and the relevant privacy/security authorization.

## Technical state and revision semantics

Initial batch state staged; allowed transitions staged -> validated -> approved -> running -> complete, with failed allowed from each nonterminal state. Self-state updates permit counters/checkpoints before terminal closure; complete/failed cannot reopen. A retry creates a new batch; snapshot/row uniqueness supports safe reuse. State approved is an execution-stage label, not evidence of MASS source/business approval. Server assigns start on running and completion on terminal transition. Counters cannot be negative or exceed extracted; complete requires exact accepted+quarantined+excluded=extracted. These are occurrence categories, not unique-person or overlapping issue totals. Reconciliation software must independently verify reported counts against its extraction ledger; the schema cannot derive accepted business records that do not exist here.

Review begins open; a reviewer may close resolved/rejected with an allowlisted resolution code. Closure is terminal in this minimal version. Future review reversals/reopening need an explicit audited design; no irreversible source correction is performed here. No free-text rationale is stored.

Mutable batch/exception row_version increments on successful update, and metadata cannot be forged through granted columns. Callers must use `WHERE id = ... AND row_version = expected` and treat zero updated rows as a conflict. The grants do not force a trusted SQL client to include that predicate; a future API must enforce it. Tests verify sequential and concurrent stale-predicate behavior, not a nonexistent public update RPC. Snapshot, sheet, row and audit records reject UPDATE/DELETE/TRUNCATE. No deletion/retention duration is selected. Database administrators can bypass or change controls; these are not guarantees against a malicious superuser.

## Security boundary

All technical roles are NOLOGIN, NOSUPERUSER and NOBYPASSRLS; no real principal receives membership. The owner role has no members. Fresh role-name collisions deliberately fail migration 1, rather than silently adopting a potentially privileged role. Before any hosted use, confirm the approved management role can create/set ownership for these roles. Do not grant them to application/browser roles to work around missing permission.

| Role | Granted capability |
| --- | --- |
| mass_foundation_owner | Non-login object owner; audit insert through private security-definer trigger; not an application role |
| mass_foundation_ingestor | Read five metadata relations; append snapshots/sheets/rows, create/advance batches, append open issues; no audit read/direct writes or issue resolution |
| mass_foundation_reviewer | Read five metadata relations; close open issues through limited columns; cannot ingest, advance batches or forge attribution |
| mass_foundation_auditor | Read six relations; no writes |
| PUBLIC / anon / authenticated / service_role | No schema/table/helper access from these migrations; BYPASSRLS alone does not confer schema/table ACL privileges |

RLS is enabled and forced on all six relations with explicit role policies; unassigned roles see no rows even in a test granting table ACLs. ACLs deny destructive/admin operations. Trigger functions have fixed pg_catalog search paths and revoked PUBLIC execute. The sole definer is the private, allowlisted audit trigger; audit appends participate in the original transaction and failure aborts the write. Direct audit INSERT/UPDATE/DELETE is not granted to ingestion/review/audit users.

Infrastructure roles have technical access to the whole foundation, not centre-scoped business permissions. Teachers, Cluster Officers and Leadership receive no technical memberships. No staff assignment, centre capability, donor access or production service account is invented. Future hosted API schema exposure, inherited memberships and default privileges must be checked independently; this phase does not alter any hosted exposure configuration.

## Run locally and reproduce

Prerequisites: Bash and a working local Docker engine. No npm dependencies were added. Run from the repository root:

```sh
bash tests/foundation/run-local.sh
npm run check
npm run build
```

The runner accepts **no database URL or existing database**. It creates a unique container/database, uses Docker exec and the container Unix socket only, disables container networking, publishes no ports, mounts no host files and uses temporary in-memory database storage. SQL is streamed through stdin; the runner never reads DATABASE_URL or Supabase credentials/project references. Local trust authentication is confined to this disposable, isolated test container; no passwords/credentials are written. It removes the container and attached anonymous volumes on exit. The image is pinned to postgres:17 digest sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe; optional MASS_TEST_POSTGRES_IMAGE is for an explicitly selected local compatibility image only.

The runner applies the six files in lexical order to an empty database. It does not simulate Supabase's migration ledger or rerun already-applied files; a second invocation creates another empty database. Test-only bootstrap roles and helper functions are outside the production migrations. Fixtures are explicit test inputs, not Supabase auto-seed files. Test logs/engine images are local tooling artifacts, not committed source datasets.

For test recovery, discard only the runner's container and rerun. No down migration/reset against a shared/hosted database is supplied. Future live changes require reviewed forward migrations and verified backup/recovery; DROP CASCADE is not a rollback plan for live data.

## Verification results

- All six migrations applied to isolated PostgreSQL **17.11**; exactly six foundation tables, all forced RLS.
- **87 automated assertions passed**, including real role allow/deny operations, all-table anon/authenticated/service-role ACL checks, forged client-role denial, RLS despite accidentally widened ACLs, immutable source/audit records, actor/revision protection, NULL-aware deduplication, FK errors, state/count/checkpoint validation and terminal-state protection.
- Audit contents limited to revision metadata; every successful fixture write audited, failed/stale writes leave no event, rollback removes both data/audit, and audit-append failure aborts the underlying write.
- Two independent psql sessions verify concurrent unique-snapshot retries yield one snapshot/audit entry, and same-expected-revision updates yield one committed revision/audit event.
- `npm run check` and `npm run build` passed. Existing tracked frontend/server/build/package/deployment files are byte-for-byte unchanged. Generated dist remains ignored; no browser integration or Supabase Auth/PostgREST/API/storage test is claimed.
- No original workbook was opened or re-audited. Fixtures contain only synthetic UUIDs, repeated synthetic hash characters, technical enum/version tokens and counts. Privacy/secret scans and preservation checks are reported with the final delivery.

The frontend source-download builder intentionally remains unchanged: it packages src/scripts/docs, not supabase/tests. Foundation tests/migrations are delivered through Git, not that frontend-only ZIP. The local test runner lives under tests, avoiding a new incomplete database utility inside the frontend download.

## Hosted handoff gates — no apply authorization

Production project pbkwpfdpdtelmvbkzgvx is reserved for a later separately authorized deployment. This phase did not connect to it, inspect it, link a CLI, run Supabase commands or execute SQL against it. Before any hosted apply:

1. Verify actual project ownership/region/PostgreSQL version, exposed schemas, existing role privileges/memberships and production boundary using authorized read-only access. Confirm migration-role capabilities and role-name availability; do not bypass restrictions or recreate the project.
2. Approve a nonproduction Supabase test target and validate actual PostgREST/Auth/service behavior, schema exposure, grant inheritance and trusted end-user attribution. PostgreSQL-only local results are insufficient to claim Supabase API security.
3. Finalize production data minimization, artifact lookup/storage ACLs, retention/deletion, audit review policy, actual technical principals and correction/reversal workflow. No child/household payload is permitted by this foundation authorization.
4. Review migration ledger/order and rollout so all auditing is installed before any ingestion membership/use. Obtain separate backup/recovery and hosted apply authorization. Then separately authorize any real source staging, reconciled canonical promotion, business modules, frontend integration or release.

No merge, push or deployment is part of this handover. Local Git delivery details and any pre-existing uncommitted Phase 2E documentation are reported separately.
