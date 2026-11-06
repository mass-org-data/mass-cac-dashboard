# Migration 017 — donor/centre/staff directory handoff

28 October 2026 (India). Branch `feature/supabase-frontend`. Target identification only: Supabase `pbkwpfdpdtelmvbkzgvx`, Mass CAC Dashboard, Mumbai/ap-south-1. The user reports 001–016 successfully deployed; no hosted inspection/execution was performed here. This release authorizes local development/tests and GitHub publication only. No staff accounts, application scopes, real imports, merge or Vercel activation is included.

Authoritative migration: `supabase/migrations/202610280017_donor_staff_directory.sql`.

SHA-256: `a7c37a8a1ab2138169ca120ab3acad90ca6465cc5e2963f3a21dbe755e3d304a`.

Original 001–016 files/hashes are unchanged. MIGRATIONS.sha256 appends only 017. The remote proposal from `7557ba6c8c82e95abe4cce9af6cb6ac827091fe0` is preserved unchanged in supabase/proposals; this branch was fast-forwarded to retain it before committing finalization. The authoritative new migration finalizes that draft within the current authorization. The earlier centre_funding proposal is superseded for associations: **no centre_funding, amounts, funding dates, transactions or financial attribution**.

## Table and API inventory

| Object | Implementation |
| --- | --- |
| mass_core.donors | New UUID/label directory, original source_label and required source-row/field provenance; no name uniqueness or financial fields. |
| mass_core.centres | Existing table adds nullable donor_id FK plus restricted donor_source_row_id FK; both are NULL or both recorded. A centre has at most one verified donor association. |
| mass_core.staff_members | New UUID/display_name directory, original source_name and required source-row/field provenance. No Auth FK, phone, household fields, appointment dates or name-only merging. |
| mass_core.centre_staff_assignments | New explicit centre/staff/Teacher-or-Cluster-Officer/nullable Morning-or-Evening relation with row/field provenance. No validity dates invented. |
| mass_api.get_centre_directory(p_centre uuid=NULL,p_donor uuid=NULL,p_limit int=100,p_offset int=0) | Invoker read: centre_id/label and nullable donor_id/label, only through current centre RLS. Explicit unauthorized centre raises 42501; optional donor can only narrow results. NULL centre deliberately discovers only assigned centres, not an unrestricted report. |
| mass_api.get_centre_staff(p_centre uuid,p_shift text=NULL,p_limit int=100,p_offset int=0) | Invoker read: assignment ID, directory staff ID/name, role and documented nullable shift for one readable centre. Unknown shifts are not returned as matches for explicit Morning/Evening. |

Both RPCs require actual authenticated role/managed UID, deterministic pagination (1–100/page; offset <=100000), fixed search paths/static qualified SQL and current scope. No source provenance/original spellings, other staff directory, Auth identities, child fields or technical tables are returned. Public/anon/service execution is revoked; unexpected creator grants and effective anonymous/service-role table rights fail closed. All three new tables force RLS with owner and scoped SELECT policies; application mutations are not granted. Existing column rights also enforce RLS if queried with the database role, but **private schemas must never be Data API-exposed**.

New totals: **17 migrations, 26 tables, 174 columns, 34 foreign keys, 78 RLS policies, 22 mass_api functions; 19 existing SECURITY DEFINER functions unchanged.** Original 72 policy definitions and 20 API definitions are preserved. No new definer is added. Full [dictionary](DATABASE-DATA-DICTIONARY.md), [ERD](DATABASE-ERD.md), [security](DATABASE-SECURITY-IMPLEMENTED.md) and [catalog](DATABASE-SCHEMA-INVENTORY.json) are regenerated from a separate disposable database.

## Differences from the preserved draft

The four-object architecture is retained. Donor name/normalized-name uniqueness becomes reviewed label plus original spelling/source occurrence keys: name spelling alone must not merge donor identities. Directory row_version fields are omitted because rows are immutable and no correction RPC is approved. Unverified starts_on/ends_before fields are omitted instead of presenting source-free appointment/history semantics; any later dated responsibility model requires source evidence and review. Draft staff_id/staff_role names become staff_member_id/role_code for consistency with the existing scope vocabulary. Source-row/field provenance, duplicate constraints, read policies/APIs, narrowly scoped grants and safe centre association guards are added. The draft remains an unexecuted historical proposal; do not apply both versions.

## Explicit security/ownership adjustments

1. The migration uses the existing trusted principal's SET memberships for foundation/core owners. It grants mass_core_owner **REFERENCES(id) only** on foundation.source_rows for provenance FKs. It adds no source SELECT, Auth privilege delegation, application-owner membership or technical-table API exposure.
2. Existing centres' whole-table authenticated SELECT would expose the added provenance column. It is replaced with SELECT(id,label,row_version,donor_id). Original RLS policies remain unchanged; get_context and the old APIs continue functioning. New tables expose only minimum display/association columns, not source_name/source_label/provenance.
3. The original centre guard forbids all updates. Only its centre guard_write binding is replaced by a new **SECURITY INVOKER** guard permitting a first source-backed donor association by mass_core_owner, keeping all other fields immutable and incrementing the existing revision. Changing/removing a donor, identity or label is rejected; same-row no-op retries do not write/audit again. The original guard_record function, truncate protection, audit trigger, other bindings and 20 API functions are unchanged. No application centre UPDATE right is added. This is an explicit ownership guard adjustment, not a disabled trigger or RLS workaround.
4. New directory rows reject UPDATE/DELETE/TRUNCATE. Immutable source keys/unique NULL-aware assignment keys prevent duplicates. Reviewed corrections, historical directory versions and true multi-donor cases require separate decisions; no silent name merge, donor reassignment or account activation is implemented. Directory inserts retain source provenance; the existing audit mechanism logs centre association revisions only, without staff/donor values. A separate directory-change audit/retention workflow is not claimed implemented.

## Frontend changes

The preserved manager-approved demo app/style/assets/workflow callbacks remain unchanged. The authenticated workspace reuses existing navigation/cards/tables/filters and adds donor filtering across server-authorized centres, donor-to-centre drilldown, selected-centre teacher/officer display and source-reported shift display. Existing student/enrolment, attendance, assessment, activity and Morarji adapters remain intact. Donor selection narrows **query targets before** programme loading; choosing one centre uses its existing scoped programme views. Unknown associations/shifts and empty staff lists stay explicit; directory errors show errors, never demo fallback. Returned labels/names are HTML-escaped. There is no donor financial score, funding aggregation, export entitlement, directory write UI or Auth assignment control.

Build-time **MASS_DIRECTORY_API=off** is the default. Only after separate 017 installation/provider verification may an approved release set MASS_DIRECTORY_API=directory-v1 alongside live + frontend-reads-v1 and the existing publishable config. Missing/disabled 017 leaves original live core flows available with the flag off; enabling it prematurely fails visibly. No Vercel/environment setting was changed. Password/signup/managed-session limitations from [Phase 4 handoff](PHASE-4-INTEGRATION-HANDOFF.md) still apply.

## Source findings and blockers

The real Google workbook is inaccessible (network tunnel 403); **no real donor–centre–teacher–officer mapping is verified**. Five required sheets, Masaraguppi regions, same-name identities, real donor cardinality and exact shift values remain unresolved. No real source rows were imported/staged/committed. See [source reconciliation and exact private procedure](DIRECTORY-SOURCE-RECONCILIATION.md). An offline parser and synthetic tests are implemented; invented headers/mappings are not substituted for source evidence. Single donor_id is technically enforced, but its completeness for all real centres cannot be confirmed until source review.

## Verification

Run npm ci and install requirements-dev.txt in a private virtual environment, with Docker, Bash, Python, Playwright and Chromium available:

```sh
npm run check
npm test
npm run test:api
npm run test:directory
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
```

The historical baseline runners explicitly stop at 016 to retain their frozen expectations; the directory runner independently installs 001–016, validates baseline reads, then tests 017 with a non-superuser/no-BYPASSRLS/no-CREATEROLE principal using only existing owner SET memberships. It injects failure before COMMIT, verifies new tables/columns/provenance rights roll back, also rejects inherited service-role table rights with full rollback, retries the exact file, compares old policies/API definitions and runs synthetic directory/RLS/retry tests plus actual SDK/PostgREST operations. Catalog generation/check uses all 17 files independently. No real cloud credentials/records are consumed. Browser Auth/REST is fully intercepted, and local JWT/Auth fixtures do **not** prove managed Supabase Auth compatibility.

Results for review: original 207 behavioral checks pass; 59 baseline read-security assertions, 49 directory SQL assertions, 23 SDK/PostgREST checks (18 existing + 5 directory), 19 frontend unit tests, 27 preserved workflow checks, 39 Chromium checks and four offline reconciliation tests pass. Schema/role/Auth-boundary/failure/restore suites, build/syntax, all 17 checksums and dependency audit also pass (zero audit vulnerabilities). Counts overlap across runners; they are not summed as unique coverage. Actual workbook findings and hosted/provider verification remain unavailable.

## Controlled later production sequence — separate authorization required

1. Review/freeze this commit and all 17 checksums. Verify correct project/region/operator, actual private backup integrity/recovery evidence and an approved DDL window. No actual production backup was created by this phase. Keep credentials, dumps and source review artifacts outside the repository/archive inputs.
2. In an explicitly approved read-only window inspect actual ledger and 017-preflight.sql: expect exactly 16 recorded versions, 23 tables/72 policies/20 APIs, no 017 relations/functions/columns, correct original centre guard/default ACLs and ability to SET both existing owner roles. Reconcile drift; do not reset, replay, force history or grant new broad privileges.
3. Obtain explicit production execution approval. Use the established error-stop migration runner to apply **202610280017 only**, once, preserving its own BEGIN/COMMIT. Do not run proposal SQL, 001–016 or test bootstrap/fixtures on hosted MASS. No real data belongs in this schema deployment.
4. On error stop immediately; inspect sanitized error plus catalog/ledger through an approved read-only session. The whole failed file should roll back, including guard/column/privilege changes; prove rollback before an authorized retry. A disconnect near COMMIT is ambiguous: do not rerun or repair ledger blindly. Partial/ambiguous state requires reviewed manual recovery with the private backup plan; no destructive drop/reset procedure is authorized here.
5. After success run 017-postflight.sql and reconcile exact policy/function/column ACL/trigger metadata with the frozen catalog. Expect 26/174/34/78/22 and 19 definers. Old 016 postflight intentionally has different totals; do not treat it as 017 acceptance. Check effective roles, Data API exposure (mass_api only as curated MASS surface) and schema reload; never expose private schemas or use a service key in the browser.
6. Keep real source audit/import and staff activation separate. Obtain the source workbook, review IDs/regions/donor cardinality/shifts and exceptions privately, approve reconciliation/privacy/retention and a transactional import plan separately. Directory membership never grants Auth access; any real role/centre grants require independent verified approval.
7. Only with separate release approval enable the frontend directory flag in an approved Preview and validate actual managed Auth/scopes/RLS, programme flows/mobile/error/empty states. The existing user-verified Vercel skip rule covers this branch for publication; no merge or activation is included. Production frontend release remains separate.

**Recommendation:** GO for code review/publication and isolated testing. NO-GO for real-data import, directory activation or production execution under this task. Empty-schema execution can be considered in a separately authorized window after actual target/backup/permission checks; single-donor completeness and real mappings remain source-review gates.
