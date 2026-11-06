# Controlled student and historical import

28 October 2026, India. Scope: `feature/supabase-frontend`; target
`pbkwpfdpdtelmvbkzgvx`, Mass CAC Dashboard, `ap-south-1`.
This authorization permits the two additive technical migrations and reviewed
imports. It does not authorize frontend deployment, staff activation, main-branch
changes, activities or cluster-officer visits.

## Technical changes

Only new migrations are applied to the hosted database; **001–017 remain unchanged
and must not be replayed**.

| Migration | Purpose | SHA-256 |
| --- | --- | --- |
| `202610280018_controlled_student_import.sql` | Dedicated NOLOGIN/NOBYPASSRLS insert-only administrative import role, private immutable receipts, immutable display-ID allocation and unchanged runtime registration authorization | `2fecd462efb3bc96139fb16376abfb9bda5c655ca7e4ac20474c065625fae681` |
| `202610280019_import_history_integrity.sql` | Source-backed quarter-only results with NULL dates; fact/closure serialization without staff impersonation | `e4ac8b7f422c1295cfd8c969f57145e30c7d8262bc74ba6a580eda5def36516f` |

`mass_data_importer` receives SELECT/INSERT only on the approved student/history
relations and SELECT-only directory/provenance references. It cannot insert staff,
scope grants, accounts, activities or sessions, or UPDATE/DELETE/TRUNCATE canonical
records. Existing runtime policies and staff-centre grants are preserved. RLS stays
enabled and forced. No new definer function is introduced: the allocator is invoker;
the existing guarded registration and integrity functions retain their owners/ACLs.

The actual deployment administrator temporarily enables SET-only importer membership
inside each atomic data transaction, then revokes SET before commit. PostgreSQL's
creator ADMIN membership can remain without INHERIT/SET. No application principal
receives membership. A failed transaction rolls back its membership changes too.
The existing foundation ingestor handles minimized source metadata under its
previously verified administrative membership; that membership is not changed.

The original integrity trigger's `SELECT ... FOR SHARE` invoked enrolment UPDATE
policies, requiring a staff JWT even for an authorized admin import. Migration 019
uses a plain owner read and a transaction advisory lock shared with closure. It
preserves interval validation, immutable identities, scores 0–25, duplicate keys,
revision checks and audit atomicity. Runtime scope functions are unchanged.

## Student IDs and date provenance

Existing UUIDs and display values are retained. Reviewed staging UUIDs and display
IDs are inserted exactly. Future registration allocates
`ST_<first two Latin letters of centre>_<grade>_<sequence>`; spaces/punctuation are
removed before choosing the letters, as required by the approved staging IDs.
Sequence buckets are shared across every centre with the same uppercase prefix and
grade. A transaction lock and the maximum persisted suffix serialize allocations;
suffixes have at least two digits and are not truncated after 99. The UNIQUE
constraint is authoritative. Exact import retries verify receipts and stored values
instead of generating another ID or merging by name.

The approved cohort's interval is `[2026-04-01, 2027-04-01)`. These dates are
**assumed**, not observed enrolment/exit dates. Each imported enrolment receipt has
`assumed_enrolment_dates=true`; no source exit/dropout outcome is inferred. The
prepared enrolment is Active for that interval. Unknown source shifts remain NULL
in private staging; because operational enrolments require a verified shift, those
rows remain held. Names and minimal source-backed gender are the only profile
fields imported; household/contact data from the separate baseline workbook is not
imported. Missing Class-10 result stays NULL.

## Reviewed source reconciliation

The supplied staging workbook has 2,635 directory occurrences. Each ready row must
match its exact original worksheet/physical row, frozen directory SHA-256, stored
row HMAC, source name/centre/grade/shift and one live donor-centre identity.
Whitespaces/case are normalized for matching; no fuzzy identity or missing values
are invented.

| Students | Count |
| --- | ---: |
| Validated ready students/profiles/enrolments | 1,458 each |
| Held: `MISSING_SHIFT` | 1,161 |
| Held: `REVIEW_CENTRE_OR_GRADE` | 12 |
| Held: `DUPLICATE_IDENTITY_REVIEW` | 4 |
| Total held | 1,177 |

The state categories are mutually exclusive; the underlying source has 1,163 absent
shifts, two of which belong to another held category. No unsupported preschool
grade or unresolved duplicate is forced into the grade 1–10 schema.

| Historical source | Candidate rows | Accepted facts | Held facts/rows |
| --- | ---: | ---: | ---: |
| Attendance input sheets | 494 | 47,323 marks | 889 recorded cells |
| Assessments | 1,798 | 207 results | 1,591 rows |
| Morarji | 548 | 0 outcomes | 548 rows |

Attendance also contains 132,133 blank date cells retained as unknown, never absent.
Four helper/derived sheets are excluded from operational facts to avoid copying
master/pivot observations twice. Dates come from actual source headers. Unsupported
codes, WO on non-Sundays, dates outside the assumed interval, and unmatched scoped
identities are held. Private observations retain exact sheet/row/column references.

Accepted assessment results preserve their numeric value without rescaling: 206
have observed dates and one has an explicit academic year/quarter with a NULL date.
Blank years are not filled down. An observed date may establish its academic year
using the already approved April–March rule; a contradictory quarter is held.
Quarter-only results require full containment of the documented quarter in the
enrolment interval. Closure cannot invalidate that interval. The old 100-mark
template header is preserved in the checksummed source, not applied as a rescaling
instruction. Morarji names without verified centre/grade linkage are insufficient
for reliable matching and remain restricted observations. No outcomes are inferred.

## Private release, backup and recovery

All real workbooks, staging plans, HMAC keys, SQL data batches, source observations,
logical snapshots and execution journals reside outside Git under an owner-only
private directory. Files are mode 0600; the directory is 0700. No private artifact
is part of the frontend archive or public repository.

A pre-change private logical snapshot contains all 26 existing MASS tables (22,871
rows), plus separately checksummed schema/constraint/function/trigger/policy/ACL,
role-membership and migration-history metadata. **This is not a full `pg_dump`,
managed Auth/Storage backup or a tested complete disaster-recovery image.** It
contains no role passwords. Isolated reconstruction tested the source/directory
references needed by this import. Complete recovery of all managed resources has
not been certified. Preserve private artifacts securely before this ephemeral
workspace expires; retention remains an administrator responsibility.

Migrations are separate atomic transactions with their ledger entry recorded in
the same transaction. Student/profiles/enrolments/receipts/held exceptions are one
atomic transaction. Historical provenance is a separate registration transaction;
its batches are explicitly classified as quarantined source observations, not a
claim that every row's facts are resolved. Operational facts are imported in
ordered, atomic batches of at most 1,000 facts with immutable source receipts.
The source-registration batch remains a historical record of staging; operational
success is measured by reconciled receipts, not by rewriting that batch's status.

On any failure stop. Do not replay old migrations, reset the database, disable
triggers/RLS, repair history speculatively or overwrite existing identities. A
request timeout around COMMIT is ambiguous: reconcile the exact ledger/receipts
read-only first. An exact successful batch can be retried without changes; a
conflicting receipt or canonical value stops the transaction. After a committed
import, removal/restoration is a separate reviewed recovery operation, never an
automatic destructive rollback.

## Reproduce locally

```sh
npm run test:students
npm run test:imports
npm test
npm run check
npm run build
bash tests/schema/run-local.sh --check
sha256sum --check supabase/compatibility/MIGRATIONS.sha256
```

These test runners create isolated PostgreSQL 17 containers and accept no hosted
database URL. The historical core suite runs unchanged before the new migrations;
all its behavioral assertions also run on the latest schema, adapting only the
three explicit table-count/ID-format/error-code expectations. Synthetic tests cover
source drift, held shifts, scoped matching, unknown marks, quarter-only dates,
duplicate observations, permissions, rollback, concurrency and runtime closure.

`scripts/imports/pipeline.py student-stage --help` and `history-stage --help` prepare
private artifacts without connecting to any database. They require exact private
source files, frozen source plan, live source/centre metadata and the retained
private HMAC key. The private release manifest freezes every execution batch.
`supabase/compatibility/018019-import-postflight.sql` returns aggregates/security
checks only. Do not use `supabase db push`: the pre-existing 17 hosted ledger
versions use a previous runner's timestamps and must not be replayed or repaired.

## Actual production execution

Executed and independently queried on the identified production target on
28 October 2026. Both migration versions and their SHA-256 markers are recorded
atomically in the existing migration ledger; the preceding 17 entries are retained.
Only migrations 018–019 were executed, followed by the frozen private data SQL.

| Verified live object | Count |
| --- | ---: |
| Students / minimal private profiles / enrolments | 1,458 each |
| Attendance records | 47,323 |
| Assessment results | 207 |
| Assessment results with an unknown exact date and documented quarter | 1 |
| Morarji outcomes | 0 |
| Source provenance rows | 8,670 (5,830 existing + 2,840 historical source rows) |
| Immutable source-to-target receipts | 51,904 |
| Restricted exceptions | 9,525 (5,320 existing + 4,205 new) |
| Staff access grants | 0 |

All 51,904 source-row/slot/target/HMAC/workbook-checksum receipt tuples match the
frozen private plans. Every attendance date/code/child/centre/shift/enrolment was
compared with the source-backed plan. All student UUIDs, display IDs, profile values,
enrolment values and all assessment values/quarters were reconciled. Each target
has an attributable INSERT audit event under actual principal `postgres` and role
`mass_data_importer`, with minimized revision metadata. All 1,458 enrolment receipts
mark the approved dates as assumed.

The 8 donors, 92 centres, 136 staff and 220 staff-centre assignments were compared
record-for-record with the pre-change private snapshot and remain unchanged. The
one pre-existing Auth account remains; no accounts or user grants were created.
All 78 existing policy definitions are unchanged. All existing functions other than
the two explicitly revised functions retain their definitions. RLS remains enabled
and forced on all 27 tables (183 columns, 35 foreign keys, 108 policies). No runtime
role can assume the importer; the actual administrator has no remaining SET or
INHERIT import membership. An actual hosted read-only transaction using
`authenticated` with no subject returned zero students, profiles, enrolments,
attendance and assessments. No invented JWT identity or scope grant was used.

The workspace restarted after historical batch 032. Before resuming, the entire
live set of 36,374 receipts was compared with the exact completed private batches;
only batches 033–048 were then executed. Final full-source reconciliation passed.
No batch was blindly rerun, and no old migration or completed import was replayed
as part of recovery.

Regression evidence: all original foundation/core/signed-API checks passed; the
current-schema core behavioral suite also passed, as did 13 new Python staging
tests, 21 existing importer tests, five directory reconciliation tests, the
synthetic SQL import suite, baseline read/directory checks, new role/quarter-only
assessment/concurrency tests, frontend tests, check/build, and generated-schema
verification. The exact real-data SQL passed isolated execution and an unchanged
retry; an injected late failure in the complete student transaction rolled back
all canonical rows, receipts, exceptions, batch updates and audit events.

Remaining blockers are the 1,177 held student identities/assignments, 889 held
attendance observations, 1,591 assessment rows and 548 unscoped Morarji rows.
Resolve these privately with source-backed identity/shift/period evidence; do not
invent dates, propagate blank years, infer identities or rescale scores. Activities
and officer visits remain deliberately skipped. No automatic held-data import is
scheduled. Managed Auth login/session flows and verified staff activation remain
separate from these permission and RLS checks. No frontend, Vercel, main-branch or
real staff activation changes were made.
