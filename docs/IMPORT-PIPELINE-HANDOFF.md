# Private source import pipeline and frontend readiness

28 October 2026 (India). Branch feature/supabase-frontend; continuation of bd51b3daac3004635f19502cb6ee3b6989fe1ca5. Read DIRECTORY-LIVE-IMPORT-READINESS-20261028.md and MIGRATION-017-DEPLOYMENT-HANDOFF.md before implementation. Same branch fast-forwarded; all 17 SQL migrations/checksums and manager-approved frontend remain unchanged. No schema redesign or hosted DDL is included.

## Independently verified live state

Authenticated Management API GET verified pbkwpfdpdtelmvbkzgvx, Mass CAC Dashboard, ap-south-1, ACTIVE_HEALTHY. Explicit read_only SQL executed as **supabase_read_only_user**, with transaction_read_only=on, PostgreSQL17.11. Observed 26 tables, 78 policies, 22 mass_api functions; source_files/source_sheets/source_rows/donors/centres/staff_members/centre_staff_assignments/children all zero. No personal rows were fetched and no hosted writes were performed.

The ledger has 17 timestamp-versioned entries whose **names** match original migration stems 001–017. Hosted versions are runner-generated timestamps, not local filename versions. Counts/names do not prove exact stored SQL hashes. Do not run supabase db push, replay migrations or repair history to make versions match. The local source files/manifest are immutable.

Read-only permission checks prove **postgres cannot SET mass_foundation_ingestor**, although it can SET mass_core_owner. The importer requires both existing technical roles; it will fail before writes if those rights are absent. Resolving the trusted import operator's permissions requires separate administrative approval. Do not grant privileges to supabase_read_only_user or use the management PAT as a browser/database import credential.

The initial /config/postgrest URL returned404 and pgrst.db_schemas was NULL; the correct read-only /postgrest endpoint then succeeded. Actual exposed db_schema is **public,graphql_public** (max_rows1000; extra path public, extensions): **mass_api is missing**, so live RPC access is blocked. Adding the curated mass_api surface while retaining existing public/graphql_public is a separately approved production API configuration action; never expose mass_core/mass_foundation/auth. No setting was changed. No actual publishable frontend key or Vercel token is available here. Actual staff login/scope/session behavior is untested; local mocks do not establish managed Auth. No accounts/scopes were provisioned.

## Files and executable workflow

- scripts/imports/common.py: private file permissions, canonical digests, technical UUIDs and keyed row fingerprints.
- scripts/imports/stage.py: exact worksheets/physical row provenance, reviewed header layout and minimized private observations.
- scripts/imports/adapters.py: six historical workbook-family adapters and explicit exception conditions.
- scripts/imports/review.py: canonical mappings, per-row identity/disposition and source/privacy approvals; no name-only merging.
- scripts/imports/render.py: private transactional directory SQL with exact-value retries and fail-closed collisions.
- scripts/imports/pipeline.py: CLI; **no network or database connection code**.
- tests/imports: synthetic unit and disposable PostgreSQL17 execution tests.
- supabase/compatibility/import-preflight.sql and import-postflight.sql: prepared read-only operator/ledger/count/reconciliation checks, not migrations.

Install npm dependencies and requirements-dev.txt in an isolated Python virtual environment. Use a private mode-0700 workspace outside the repository. Input/export/layout/approval files must be mode0600. No raw source, canonical mappings, SQL containing names, keys, dumps or reports may be committed or copied into src/scripts/docs/archive inputs. All output writers reject repository paths and existing files; outputs are private mode0600. Commands below use placeholders, not real source paths:

```sh
python scripts/imports/pipeline.py init-key --out /PRIVATE/work/fingerprint.key
python scripts/imports/pipeline.py stage \
  --workbook /PRIVATE/work/directory.xlsx --layout /PRIVATE/work/directory-layout.json \
  --key /PRIVATE/work/fingerprint.key --out /PRIVATE/work/directory-plan.private.json
python scripts/imports/pipeline.py review-template \
  --plan /PRIVATE/work/directory-plan.private.json --out /PRIVATE/work/canonical-review.private.json
python scripts/imports/pipeline.py preview \
  --plan /PRIVATE/work/directory-plan.private.json --mapping /PRIVATE/work/canonical-review.private.json \
  --out /PRIVATE/work/preview.private.json
python scripts/imports/pipeline.py approval-template \
  --plan /PRIVATE/work/directory-plan.private.json --mapping /PRIVATE/work/canonical-review.private.json \
  --out /PRIVATE/work/approval.private.json
# The template is unapproved. Complete the actual source/identity/privacy review first:
python scripts/imports/pipeline.py render \
  --plan /PRIVATE/work/directory-plan.private.json --mapping /PRIVATE/work/canonical-review.private.json \
  --approval /PRIVATE/work/approval.private.json --workbook /PRIVATE/work/directory.xlsx \
  --out /PRIVATE/work/approved-directory.private.sql
```

No command connects to Supabase, registers real hosted rows, grants permissions or executes the rendered SQL. Rendering is not authorization to execute. Freeze/reuse a reviewed plan rather than overwriting it. Back up the fingerprint key privately: changing it changes row HMACs and stops a retry instead of rewriting provenance.

## Required exact private inputs

1. Authorized XLSX export of All CAC's Information with all five exact worksheets: Mpokket, Fanuc, McAfee, Janashkati Foundation, Dasar UK. Google export still fails with proxy403; no real XLSX was obtained here. Do not make this child-data workbook public to bypass access.
2. Corrected, source-authorized exports for the six historical families: SVP_ChildListUpdate.xlsx; Mass_MPokket_Attendance2026-27.xlsx; Center_Assessment_Score_Entry (1).xlsx; Monthly activity.xlsx; Morarji Training.xlsx; Cluster_Officer_Visit_Sheet (1).xlsx. Different corrected filenames are acceptable after freezing their actual hashes; the old uploaded copies are not assumed corrected. No original Drive IDs/versions/dates are invented.
3. A verified layout JSON per workbook, format mass-source-layout-v1, kind directory/child/attendance/assessment/activity/morarji/visit, explicit mapping_version, and sheets keyed by **exact original names including spaces**. Each configured sheet specifies header_row, physical column letters, verified_headers, and technical header_version. Only documented minimal fields are allowed; household/contact/safeguarding columns are rejected. All physical sheets/rows get opaque provenance even when not operational inputs.
4. Directory column fields: donor, centre, optional region/student_name, teacher, officer, shift. Donor operational SQL requires a real donor evidence column/slot. A verified_donor_label can assist review if no donor column exists, but cannot by itself authorize a donor insert from a worksheet title; provide reviewed physical evidence/corrected layout first.
5. Historical layouts use the explicit fields in adapters.FIELDS. Attendance adds attendance_columns mapping actual physical columns to **exact verified date-header values**, with optional date_header_row; duplicate/ambiguous dates remain exceptions. No inferred year/date/quarter from filenames or grid positions.
6. Privately reviewed canonical-review JSON and approval JSON. Canonical entity UUIDs are explicitly reviewed, never generated by fuzzy/name matching. Supply donors, centres, staff_members and centre_staff_assignments with exact fields from review.FIELDS. Every candidate row needs accepted/quarantined/excluded disposition; accepted rows need row_identities (centre_id, donor_id, teacher_id, officer_id), with NULL for absent staff. Every accepted issue needs an opaque decision_ref and exact resolved_issues list. Same-name records, Masaraguppi, regional/legal donor classifications and shift relationships require real adjudication, not blanket script approval.
7. Approval records exact canonical plan_digest and mapping_digest, scope=directory-only, approved=true, opaque reviewer_ref/decision_ref, and explicit identity_reviewed/source_provenance_reviewed/single_donor_reviewed/regions_reviewed/shifts_reviewed/directory_privacy_approved=true. Obtain these through the actual authorized review; scripts do not create human approval. The file binds review evidence to artifacts, not authority to execute production SQL.

## Source storage and reconciliation

source_sheets intentionally has no original-name column. Exact worksheet names remain in the private plan tied to file SHA, sheet UUID/ordinal and row UUID/physical number. The SQL stores only allowed minimized fields; no schema change or personal name in technical metadata. Retain the private plan and immutable original workbook as the recovery-relevant name/provenance catalog. HMAC-SHA256 fingerprints use a private per-workspace key; file checksums/technical IDs are stable for the same frozen snapshot. They are not student/staff identity keys.

Rendering registers source_files, source_sheets, import_batches, source_rows and minimized import_exceptions before donors/centres/staff/assignments. It checks actual stored values on every conflict, uses existing ingestor/core owner roles, keeps first_batch_id immutable, performs staged→validated→approved→running→complete transitions and reconciles physical row counts atomically. Quarantined rows get restricted unverified_record exceptions; no raw invalid values or personal names are copied to audit/exception logs. Header/blank/scaffold source rows are retained with excluded scope counts. A row accepted for directory associations does not mean its child data was imported or its child identity verified.

This writer covers the initial approved directory snapshot and exact retries. A later corrected snapshot that changes an existing canonical entity's immutable source binding needs a separately reviewed correction/multi-source mapping workflow; it is not silently treated as a new person or allowed to overwrite provenance.

Exact concurrent retries serialize on the batch and leave rows/revisions/audit unchanged. A completed batch with missing objects is a recovery exception, not silently repaired. Different names/IDs/source slots/donor relationships fail; no ON CONFLICT overwrite. Source spellings remain in directory source_name/source_label and the private review artifact. Single donor_id exceptions and same-name people are reviewed explicitly; Janashkati regional labels are never automatically separate legal donors. Both-shift splitting, unknown dates, implicit appointments and global name deduplication are not inferred.

The independent note reports 2,635 populated student rows (494/484/494/1042/121) and 91 normalized village labels; these are **reference observations from another inspection**, not canonical identities or this pipeline's executed preview. Actual source preview counts are unavailable until exports/layouts arrive. Current approved real entity count is **zero**; no real import plan was approved/executed. Synthetic verification preview: 1 file, 5 sheets, 10 physical rows (4 accepted/1 quarantined/5 excluded), 4 donors, 4 centres, 8 staff and 8 assignments, zero children/Auth users/access grants. Do not present synthetic counts as MASS data.

## Historical decisions and module readiness

See [decision/exception register](IMPORT-DECISIONS-AND-EXCEPTIONS.md). Historical adapters emit private review observations with raw minimal values and source references; they do not create operational facts automatically. The directory SQL renderer rejects historical plans. This is an explicit remaining boundary: approved operational import writers for historical records require verified identity/date/reference mappings and approvals; monthly legacy activity/visit/sensitive fields lacking approved tables cannot be forced into existing modules.

Frontend implementation is preserved, not rebuilt. Auth/session, scoped core reads/writes, donor/centre/staff/shift reads, students, attendance, assessments, activities and Morarji pass local regression. Managed Auth, real accounts/scopes, populated live views and actual Preview remain unverified. Empty/unassigned live mode stays empty; no demo fallback. Existing removal/undo/profile edits/bulk writes, financial reports, legacy activity slots, visits/guidance and unapproved progress comparisons stay unavailable. See [module-by-module preview handoff](VERCEL-CONTROLLED-PREVIEW-HANDOFF.md).

## Verification results

- 14 Python import tests: source fingerprints, exact names/ordinals, canonical collisions, review freshness, identity/shift/region gates, six historical adapters, private CLI/permissions and SQL escaping.
- 15 SQL import reconciliation/access assertions; injected late failure/atomic rollback, concurrent first imports, exact retry without audit/revision duplication, and conflicting approved-mapping rejection. This runs as a non-superuser with only existing technical-role SET rights in a disposable PG17 container.
- Existing 207 foundation/core/HTTP checks, 59 read-security assertions, 49 directory SQL assertions, 23 directory/core SDK checks, four earlier reconciliation tests, 20 frontend unit tests and 27 preserved manager workflow checks pass. Counts overlap across runners and are not summed.
- 39 intercepted Chromium checks, schema/catalog/17 hashes, restricted-role/Auth-boundary checks and synthetic backup restore pass. Syntax/build and npm audit pass; audit reports zero vulnerabilities. No real managed Auth session or populated production frontend workflow is claimed verified.

## Operator sequence after separate approvals

1. Complete private source/layout/canonical review and D10/D12/D14 conditions; freeze hashes, review digests and actual backup/recovery evidence. Confirm only approved directory fields are in scope.
2. Separately approve a trusted import execution principal with the minimum existing technical SET rights; **do not modify role/scope privileges under this implementation task**. Never grant to the current read-only Management user or create staff accounts merely for testing.
3. Run prepared read-only preflight and inspect the 17 named ledger entries; do not run any migration or history repair. Verify schema/catalog/role/backup drift and pending exceptions. No Supabase URL/credentials are accepted by local test runners.
4. Separately authorize the exact private SQL data import. A qualified operator may then use psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse --file=<private approved SQL>, with connection credentials supplied privately outside shell history/repository. Do not use the Supabase dashboard's saved/shared query history for PII SQL. Assess provider SQL/error logging and retention first. No execution occurred here.
5. On error, stop; the transaction should roll back all source/core/batch/audit writes. Verify state privately; a connection loss near COMMIT is ambiguous and requires read-only reconciliation before any retry. Never overwrite/disable guards or reset history. Compare aggregate postflight counts to the frozen approved preview and inspect unresolved exceptions privately.
6. Complete staff account/scope/privacy approvals and controlled Preview separately. Keep production Vercel and main unchanged; no accounts/grants/imports/deployment were performed here.
