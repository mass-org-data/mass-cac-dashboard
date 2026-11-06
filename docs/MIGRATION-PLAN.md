# Proposed migration and validation plan

Status: review only; no real data migrated and no database resources created. Follow SOURCE-INVENTORY, DATA-QUALITY-REPORT, the dictionary and D01-D15 decisions. Use the six provided working copies; never write back to original Sheets.

## Source-to-destination mapping

All destinations are proposed. Accepted canonical rows require approved identity/period/semantic decisions; unresolved records remain in protected staging. Preserve exact source snapshots, raw values and mapping versions outside Git.

| Source reference and fields | Proposed destination | Transformation / admission gate |
| --- | --- | --- |
| ATT centre tab/context; A name, B grade, C gender, D village, E class category | children/private_child_profiles only after D01; placement_observations; reviewed centres/aliases | Name/grade/village/shift are evidence, not keys; keep residence distinct from centre. No inferred enrolment date |
| ATT row 3 date heading + individual mark cell | attendance_records.code/date and origin row/cells | Unpivot only distinct resolved day headings, excluding totals. Preserve WO/MM/L. Quarantine CO formula values, duplicated/out-of-period dates and unresolved shift |
| ATT master and hidden helper | source_rows/placement observations or reviewed attendance facts | Alternative-source precedence D02/D04; do not double load 494+494+429. No helper mark gets a guessed date |
| ATT pivot/total/weekday formulas | source_sheets/header_spec; reconciliation evidence | Recompute accepted metrics later; no separate fact rows from report totals |
| CHILD-01 B name, D Sex, F DOB | private_child_profiles after identity/date approval | No phone/DOB/name automatic identity match; preserve unsupported/ambiguous values in private staging |
| CHILD-01 A local serial; A:BC original responses | source_rows.source_record_identifier; private_baseline_surveys + versioned private_baseline_answers | Preserve all original question positions/duplicate-label block ordinals. No invented child source ID. Sensitive retention gate D10; do not infer household IDs |
| CHILD-02 A:G | placement_observations and roster_reviews | Approved identity/action mapping; no inferred exit/review date. Retain reasons privately; no blanket Remove -> dated exit |
| VISIT log row 2 officer and A:D | staff, reviewed aliases/assignments, centre_visits | Exclude labelled examples; all 200 candidate dates currently missing. No Completed status, dates or authentic-visit claim without review |
| VISIT E and monthly summary tabs | source metadata and reconciliation only | Do not import monthly counts as visits; formula/hardcoded discrepancies reviewed from accepted detail |
| MOR C/D/E/F/G, project context | children resolution; confirmed cohort membership; morarji_outcomes applied/exam_attended/passed/passed_school_name | Date and ID missing on 550 rows; cohort unknown; no guessed year. Review contradictory flags. Passed=No alone does not create a fail/absence classification |
| ACT B2 month; A:C person/class; D:G Yes/No/blank | monthly_activity_returns + monthly_activity_responses | Month key is the source period's first day, not event occurrence. Explicit Yes -> true, No -> false, blank -> NULL; do not invent dates/category/status or count blank as No |
| ASM A/B year/quarter, tab project/shift, B3 configured max | academic_years, assessment_periods, approved assessment_definitions | Sparse years and Q-to-F/scale policy require D05/D06. Observed max score is not the paper maximum |
| ASM C/D/E/H person/class/gender/village | person resolution + placement observations | No name-only joins; header and example excluded; do not create a result from quarter scaffolding |
| ASM F/G score/date | assessment_results after accepted definition/identity/date | Retain numeric scores exactly, null distinct from zero; no rescaling. Interpret text/century only under reviewed date rules. Missing score is not Absent |
| Explicit example rows and assessment scaffold | source_rows classifications and exclusion ledger | 25 explicit examples excluded; 1,896 unnamed assessment scaffold rows not real results. Do not infer people/identities from example IDs |
| No matching source: follow-up/guidance/new sessions/events/funding/batch comments/additional Morarji fields | Optional extensions in dictionary only after D12 | No historical backfill from demo data, source row order or inferred business rules |

## Secure extraction and provenance

1. Retain hashes and immutable authorized copies in restricted storage; record actual original IDs/versions when supplied. A file hash is a snapshot identity, not proof of original Drive lineage. Preserve the exact uploaded `(1)` names.
2. Record source_files, source_sheets and source_rows with sheet ordinal/native XLSX ID, header spec, row locator, original identifier if present, content fingerprint and restricted payload reference. Native XLSX IDs must not be mislabeled as Google sheet IDs. Store formulas and caches separately and record that no recalculation was performed.
3. Account for every relevant row as candidate, explicit example, partial/scaffold, summary/report, structural/empty or rejected. Record all hidden tabs and variable headers. Keep row-level records and payloads outside the repository/source download.
4. Preserve column/range locators for each output fact. One attendance row expands to many dated facts; the denominator for reconciliation must include cell-level expansion. Record provenance for contextual month/maximum/quarter/year values as well as the record row. Filling a blank year from a header/block requires a recorded owner-approved rule and contextual evidence.

## Identity resolution and duplicates

Use an authoritative identifier when supplied and verified. Otherwise generate a restricted candidate-review queue using multiple pieces of evidence; do not declare same-name people identical or generate pretend source IDs. Internal UUIDs identify adjudicated database entities only. Preserve both source occurrences and reviewer rationale when merging a verified duplicate. Reject automatic child/staff/auth linking by name. Local serials, row numbers, normalized names, phone numbers and hashes are not universal person identifiers.

Duplicate detection must be grain-aware: within-sheet repeated row/key candidates, master-versus-centre copies, repeated result periods/attempts, repeated activity returns, date-labelled duplicate columns and legitimate multiple visits all differ. Do not deduplicate scores across quarters, children across cohorts, or different projects merely because row counts match. A changed snapshot needs change detection/review rather than a fresh blind insert or overwrite.

## Idempotency and retry model

- Extract a fixed snapshot with deterministic, versioned code. Source occurrence identity is snapshot + tab + row/range; preserve identical rows separately by locator. No hash-only deduplication.
- Reuse source_rows for retries of the same frozen snapshot. Use table-specific origin_row_id + origin_fact_key for extraction idempotence; use separately approved canonical business keys to detect another source reporting the same fact. Migration retries must not conflate these two identities.
- Each attempt has an import_batch ID, mapping/extractor versions, counters, checkpoints and attributable audit. Re-running a completed import must report unchanged/reconciled records, not duplicate them. Distinct source rows that represent a reviewed canonical duplicate keep explicit source-equivalence evidence.
- Validate full batches before promotion. Upsert only on an approved key; optimistic row_version and explicit correction rules prevent an old source rerun from overwriting a newer human correction. Do not use last-write-wins as a silent migration policy.
- Use transactions for coherent parent/fact batches and batch form writes. Retry only retryable failures after a diagnosis/state change. Maintain checkpoints after commit, not before. Never suppress constraints to make a load pass.

## Exception register

The restricted audit register currently exists at `/tmp/mass-phase2b-private/exception-register.json`; DATA-QUALITY-REPORT contains public aggregate reason counts. It uses source sheet code, row locator, field locator and reason only, without copied record values. It is not durable storage; transfer to approved secure storage before operational use. No import was attempted.

Future import_exceptions fields include batch/source row/field/reason/review state, assigned reviewer, actual resolution time and minimal restricted notes. Example reasons: unknown identity, missing source ID, missing/ambiguous year/date, scale conflict, unapproved code, absent shift, duplicate-source ambiguity, contradictory outcome and template authenticity. Never place names/phone numbers/DOB/raw values in general logs. One row can have multiple flags; reason totals must not be described as unique failed records.

## Reconciliation and testing gates

- Snapshot/tab candidate counts reconcile to accepted + quarantined + excluded; do not count reports or alternative rosters twice. Record unnamed input separately from named candidates.
- Reconcile attendance by approved date/code/centre/shift and source-cell count, including future blank cells versus missing past marks; monthly activities by slot/Yes/No/NULL and source month; assessments by year/quarter/scale/numeric/missing coverage; programme outcomes by literal flags, not guessed awards.
- FK tests: each accepted child, centre, project, definition/cohort/event reference resolves; linked centre/date/shift values agree; required provenance resolves. Compare both accepted detail and recomputed summaries; retain approved differences rather than editing source totals.
- Synthetic tests must cover namesakes, transfers, multiple years/quarters, different scales, null versus zero/false, repeated cohort participation, date ambiguity, duplicate headers, example rows, changed source snapshots, partial failures, repeat runs, optimistic conflicts and cross-scope denial. Never use real workbook rows as fixtures.
- No current workbook is unconditionally import-ready. Identity/period/calendar/security gates apply before promoting its facts. Staging itself requires an approved secure project/storage boundary and is not authorized now.

## Implementation order after review

Review decisions and dictionary -> assess existing Supabase project/security -> approved SQL migrations in supabase/migrations -> synthetic schema/constraint/RLS tests -> immutable secure staging -> reference and identity adjudication -> observations/history -> accepted attendance/assessment/monthly activity/outcome/visit facts -> reconciled derived reporting -> reviewed frontend async adapter -> Preview validation -> separately approved real migration/release.

Plan backups and a tested reversal strategy before production writes. Use import-batch attribution and audit; rollback must not erase later approved user corrections. Nothing in this document authorizes a database creation, actual import or deployment.
