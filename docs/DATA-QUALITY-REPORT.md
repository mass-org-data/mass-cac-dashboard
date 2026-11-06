# Data quality report — evidence, not inferred corrections

Audit basis and count definitions: `SOURCE-INVENTORY.md`. All counts below describe source row/cell occurrences before identity resolution, not unique children or accepted database rows. Formula caches were inspected but not recalculated. Original files were not changed.

## Critical findings

| Finding | Verified count / reference | Required treatment |
| --- | --- | --- |
| Stable person IDs absent | MOR: 550/550 named rows; ACT: 2,557/2,557; ATT/ASM layouts have no child-ID column | Resolve identities through authorized evidence; no name-only joins or synthetic source IDs |
| Baseline serial incomplete | CHILD-01: 72/98 named profiles blank; nonblank local serials have no within-sheet duplicates | Serial is not a global key; preserve literal source value |
| Profile DOB variability | CHILD-01: 27 blank, 39 ISO-shaped values, 32 other text values | Locale/century/date review; missing stays unknown |
| Registration partial | CHILD-01: one additional input row without a name | Quarantine; do not create a child |
| Roster action vocabulary | CHILD-02: 395 retain, 84 remove, 82 other labels; 4 excess normalized name+village keys | Review vocabulary and person matching; no inferred exit dates |
| Alternative attendance views | 494 named occurrences in 15 centre tabs, 494 master, 429 hidden helper | Choose authoritative inputs; no additive population or double import |
| Hidden attendance dates absent | ATT-02: 429 candidates, 31 undated mark columns | Block dating/promotion; source month required |
| Calendar mismatch | ATT-06 extends to 1 July 2027; ATT-18 has one repeated day header | Quarantine conflicting/out-of-period cells; confirm period and precedence |
| Numeric values in mark positions | ATT-04: 14 COUNTIF formulas in date-labelled CO | Not P/A; do not coerce into codes |
| Missing shift | ATT-09: one named row | Confirm assignment; no default Morning/Evening |
| Attendance duplicate candidate keys | ATT-12: one excess name+grade+village+shift key; master/helper each also have one within-sheet excess under the audit key | Matching review only; not proven duplicate people |
| Visit dates absent | 200/200 non-example input rows across seven logs | Cannot create dated/completed historical visits |
| Visit authenticity uncertain | All 200 non-example rows use template-like remarks; 35 excess within-log identical input tuples | Review authenticity; do not blindly delete or count as real |
| Morarji date/cohort absent | 550/550 named rows without Date; no authoritative cohort-year field | No cohort-year backfill from filename/example date |
| Morarji internal conflicts | MOR-02: 30 Attended=Yes without Applied=Yes; 5 Passed=Yes without Attended=Yes | Review source semantics and contradictions; no automatic repair |
| Morarji repeated rows | MOR-04: two excess exact seven-field named rows | Quarantine duplicates for review; no auto-merge |
| Activity unknowns | 5,113/10,228 slot cells blank; source month is October 2026 | Preserve unknown; no zero/No filling; no invented events |
| Activity repeated rows | One excess exact named row each in ACT-01/03/05 | Review within source; project labels/count similarity do not establish cross-project duplicates |
| Assessment year absent | 1,794/1,798 named rows | Block year-dependent canonical import until approved inference or correction |
| Assessment score missing | 105/1,798 named rows | Null is not zero or Absent |
| Assessment date missing/text | 948 blank; 373 non-ISO text; 477 ISO-shaped | Preserve raw date with parsing status and approved date rules |
| Assessment scale uncertain | Morning maximum 100 in metadata, but all 802 numeric morning scores <=25; all 1,693 numeric scores across shifts <=25 | Confirm paper/maximum; do not rescale or silently change maximum |
| Assessment repeated candidate keys | ASM-02: two excess name+class+village+year+quarter keys | No inferred repeat attempt or automatic overwrite |
| Assessment scaffold rows | 1,896 rows with period/template input but no student across ASM-05..08 | Exclude from result counts; retain structural evidence |
| Explicit examples | 25 across VISIT/MOR/ACT/ASM | Classify as examples; exclude from real data import |
| Validation does not establish requiredness | All 114 rules allow blanks | Agree canonical required fields; do not treat workbook permission-to-blank as production policy |

Counts of key overlap are deliberately not identity matches: 492 distinct normalized name+grade+village keys overlap the attendance master and centre union. The shared normalized name+class key count between ACT-01 and ACT-03 is zero despite both having 494 named rows. Matching counts or row counts cannot justify copying records across donor/project groups.

## Private record-level exception register

A restricted local audit register was created outside the repository at `/tmp/mass-phase2b-private/exception-register.json` (directory mode 0700, file mode 0600). It contains workbook/tab codes, source row locators, field locators and reason codes, without names, phone numbers, dates of birth, raw cell values or personal IDs. Locators remain potentially identifying and must not be published or committed. It is an audit register, not evidence that an import was attempted or failed. Use secure retained storage before relying on it beyond this task; `/tmp` is not durable storage or an encryption guarantee.

Reason counts overlap: one source row can have several issues. No automatic correction or accepted-person resolution has occurred.

| Audit reason | Flags |
| --- | ---: |
| `assessment_date_text_review` | 373 |
| `assessment_maximum_requires_confirmation` | 852 |
| `assessment_missing_academic_year` | 1794 |
| `assessment_missing_assessment_date` | 948 |
| `assessment_scaffold_without_person` | 1896 |
| `attendance_date_headers_unresolved` | 429 |
| `attendance_shift_missing` | 1 |
| `attended_without_application` | 30 |
| `duplicate_candidate_requires_review` | 49 |
| `explicit_template` | 7 |
| `explicit_template_or_label` | 18 |
| `missing_morarji_source_date` | 550 |
| `missing_source_student_id` | 3107 |
| `numeric_attendance_day_value` | 14 |
| `passed_without_attendance` | 5 |
| `person_identity_unresolved` | 6981 |
| `profile_dob_missing` | 27 |
| `profile_partial_without_name` | 1 |
| `profile_serial_missing` | 72 |
| `template_like_visit_requires_authenticity_review` | 200 |
| `visit_date_missing` | 200 |

## Structural and business boundaries

Missing attendance cells include future dates in a full-year grid and cannot all be called missed sessions. No source-backed held-session calendar or approved WO/MM/L interpretation was supplied. Source No flags in monthly activities/Morarji are observed values; absence of a flag remains unknown. A source Passed=No is not enough to distinguish failed, absent, pending or not applied without the other fields and agreed semantics.

Mandatory operational identifiers and dates are proposed in the data dictionary, not retroactively invented for historical records. Unresolved data can remain in protected staging. Population counts, dropout/engagement rates, scholarship awards, inferred programme impact and completed visits must not be published from unresolved records.

## Reconciliation tests before any import

Require per-snapshot/tab counts for candidate/partial/example/report/empty categories; per-cell counts for attendance/day columns and activity slots; score coverage and nulls; reviewed duplicate decisions; source-to-person mapping coverage; FK integrity; and source-versus-recomputed summary differences. Compare accepted + quarantined + excluded row occurrences to extraction counts without adding alternative views. Define record grain before expanding one source row into many daily facts. Check duplicate-date columns and changed source snapshots explicitly.

## Per-worksheet quality details

These are descriptive checks, not approved mandatory-field rules. Candidate duplicates are excess rows under the audit key, not proven duplicate people or transactions. Future blank attendance cells are included in grid blank counts and must not be treated as missed sessions. Report-only tabs do not receive invented input-record counts.

| Sheet ref | Per-sheet missingness, duplicate and period evidence |
| --- | --- |
| ATT-01 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=7674 |
| ATT-02 | date columns=0; range=None..None; duplicate day headers=0; missing shift=None; excess candidate keys=1; non-code numeric day values=0; blank grid cells=854 |
| ATT-03 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| ATT-04 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=14; blank grid cells=8721 |
| ATT-05 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=7539 |
| ATT-06 | date columns=366; range=2026-07-01..2027-07-01; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=8858 |
| ATT-07 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=8469 |
| ATT-08 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=7812 |
| ATT-09 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=1; excess candidate keys=0; non-code numeric day values=0; blank grid cells=9467 |
| ATT-10 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=7680 |
| ATT-11 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=8018 |
| ATT-12 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=1; non-code numeric day values=0; blank grid cells=10787 |
| ATT-13 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=11156 |
| ATT-14 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=10725 |
| ATT-15 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=7425 |
| ATT-16 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=9818 |
| ATT-17 | date columns=365; range=2026-07-01..2027-06-30; duplicate day headers=0; missing shift=0; excess candidate keys=0; non-code numeric day values=0; blank grid cells=7984 |
| ATT-18 | date columns=366; range=2026-07-01..2027-06-30; duplicate day headers=1; missing shift=0; excess candidate keys=1; non-code numeric day values=0; blank grid cells=168022 |
| ATT-19 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| CHILD-01 | missing serial=72; missing village=0; missing gender=0; missing dob=27; missing class=0; excess name+village keys=0 |
| CHILD-02 | missing village=0; missing gender=0; missing grade=0; missing retain_remove=0; excess name+village keys=4 |
| VISIT-01 | missing date=28; missing centre=0; missing shift=0; missing remarks=0; excess identical input tuples=6; template-like remarks=28 |
| VISIT-02 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| VISIT-03 | missing date=32; missing centre=0; missing shift=0; missing remarks=0; excess identical input tuples=7; template-like remarks=32 |
| VISIT-04 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| VISIT-05 | missing date=32; missing centre=0; missing shift=0; missing remarks=0; excess identical input tuples=6; template-like remarks=32 |
| VISIT-06 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| VISIT-07 | missing date=28; missing centre=0; missing shift=0; missing remarks=0; excess identical input tuples=5; template-like remarks=28 |
| VISIT-08 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| VISIT-09 | missing date=28; missing centre=0; missing shift=0; missing remarks=0; excess identical input tuples=0; template-like remarks=28 |
| VISIT-10 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| VISIT-11 | missing date=32; missing centre=0; missing shift=0; missing remarks=0; excess identical input tuples=4; template-like remarks=32 |
| VISIT-12 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| VISIT-13 | missing date=20; missing centre=0; missing shift=0; missing remarks=0; excess identical input tuples=7; template-like remarks=20 |
| VISIT-14 | Derived report/non-transaction; do not import as independent facts; formula caches need detail reconciliation |
| MOR-01 | missing ID=135; missing Date=135; blank flags=0; excess exact rows=0; passed without attendance=0; attended without application=0 |
| MOR-02 | missing ID=187; missing Date=187; blank flags=0; excess exact rows=0; passed without attendance=5; attended without application=30 |
| MOR-03 | missing ID=119; missing Date=119; blank flags=0; excess exact rows=0; passed without attendance=0; attended without application=0 |
| MOR-04 | missing ID=109; missing Date=109; blank flags=0; excess exact rows=2; passed without attendance=0; attended without application=0 |
| MOR-05 | missing ID=0; missing Date=0; blank flags=0; excess exact rows=0; passed without attendance=0; attended without application=0 |
| ACT-01 | missing ID=494; blank slots=988; excess exact rows=1; filled slots1/2/3/4=[494, 494, 0, 0]; month=2026-10-01 00:00:00 |
| ACT-02 | missing ID=484; blank slots=968; excess exact rows=0; filled slots1/2/3/4=[484, 484, 0, 0]; month=2026-10-01 00:00:00 |
| ACT-03 | missing ID=494; blank slots=988; excess exact rows=1; filled slots1/2/3/4=[494, 494, 0, 0]; month=2026-10-01 00:00:00 |
| ACT-04 | missing ID=0; blank slots=0; excess exact rows=0; filled slots1/2/3/4=[0, 0, 0, 0]; month=2026-10-01 00:00:00 |
| ACT-05 | missing ID=1085; blank slots=2169; excess exact rows=1; filled slots1/2/3/4=[1085, 1085, 1, 0]; month=2026-10-01 00:00:00 |
| ASM-01 | missing academic_year=403; missing quarter=0; missing class=0; missing gender=0; missing score=39; missing assessment_date=0; missing village=0; max=100.0; numeric scores=365; excess candidate result keys=0; unnamed scaffold=0; date shapes={'other/unparsed': 373, 'ISO date/datetime': 31} |
| ASM-02 | missing academic_year=445; missing quarter=0; missing class=0; missing gender=0; missing score=55; missing assessment_date=0; missing village=0; max=25.0; numeric scores=391; excess candidate result keys=2; unnamed scaffold=0; date shapes={'ISO date/datetime': 446} |
| ASM-03 | missing academic_year=447; missing quarter=0; missing class=0; missing gender=0; missing score=11; missing assessment_date=448; missing village=0; max=100.0; numeric scores=437; excess candidate result keys=0; unnamed scaffold=0; date shapes={'blank': 448} |
| ASM-04 | missing academic_year=499; missing quarter=0; missing class=0; missing gender=0; missing score=0; missing assessment_date=500; missing village=0; max=25.0; numeric scores=500; excess candidate result keys=0; unnamed scaffold=0; date shapes={'blank': 500} |
| ASM-05 | missing academic_year=0; missing quarter=0; missing class=0; missing gender=0; missing score=0; missing assessment_date=0; missing village=0; max=100.0; numeric scores=0; excess candidate result keys=0; unnamed scaffold=448; date shapes={} |
| ASM-06 | missing academic_year=0; missing quarter=0; missing class=0; missing gender=0; missing score=0; missing assessment_date=0; missing village=0; max=25.0; numeric scores=0; excess candidate result keys=0; unnamed scaffold=500; date shapes={} |
| ASM-07 | missing academic_year=0; missing quarter=0; missing class=0; missing gender=0; missing score=0; missing assessment_date=0; missing village=0; max=100.0; numeric scores=0; excess candidate result keys=0; unnamed scaffold=448; date shapes={} |
| ASM-08 | missing academic_year=0; missing quarter=0; missing class=0; missing gender=0; missing score=0; missing assessment_date=0; missing village=0; max=25.0; numeric scores=0; excess candidate result keys=0; unnamed scaffold=500; date shapes={} |
