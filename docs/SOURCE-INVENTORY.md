# Source inventory — six workbook audit

Audit date: 26 October 2026. Basis: the six attached XLSX working copies, read without saving or recalculating them. Original Google Drive files were not accessed or modified. Original Drive file IDs, native Google sheet IDs, modification history and export versions were not supplied; workbook hashes identify these exact working copies. Codes below identify workbook families and tab ordinals, not people or original Google IDs.

The Pre-KC-2 Pilot Guidelines PDF is still absent. Process-conformance review against it remains open. `MASS | Shared Project Tasklist` is excluded. This supersedes the earlier Phase 2B missing-workbook status; the Phase 2A frontend findings remain the baseline.

## Files and fingerprints

| Code | Exact uploaded filename | Tabs | SHA-256 |
| --- | --- | ---: | --- |
| ATT | `Mass_MPokket_Attendance2026-27.xlsx` | 19 | `a8321dd18c8d88bd2c1a0d53f22f501e21e5c8e367ef836d0491d3af2eed8c43` |
| CHILD | `SVP_ChildListUpdate.xlsx` | 2 | `b087c62cdfb60def8c2acad08111c5e8ab1d5e473bba9f095dac4a0417a8fa68` |
| VISIT | `Cluster_Officer_Visit_Sheet (1).xlsx` | 14 | `4fa39ef486f37033fa331d2fa873c1dabf415b463a8c25cd73d8c4cb4555eb12` |
| MOR | `Morarji Training.xlsx` | 5 | `e283c17b5cc855329a606a73740c3f6cd184d9fbbfed4de23bede5db3669f681` |
| ACT | `Monthly activity.xlsx` | 5 | `3d4b63de8ab04239fbf5e9beca01ff8a99127e0c49eb4673adeb416fa13d695d` |
| ASM | `Center_Assessment_Score_Entry (1).xlsx` | 8 | `73d2f8c864ca7bc7cfeb2b12f660ace8d110bda55a606c47c27b520deee14e2c` |

The `(1)` filename suffixes are retained as uploaded-copy names; they do not prove these are a different business dataset or version. There are 53 worksheets: 51 visible and two hidden, 29,785 formula cells and 114 validation rules. Every rule allows blanks. No rule or absence of blanks alone establishes an approved mandatory-field policy. No macros or formulas were executed. openpyxl reads formula expressions and stored cached results; it does not verify recalculation freshness. Cached formula errors matching common Excel error tokens were not found; that does not establish business correctness.

## Count definitions

**Candidates** are nonblank-name rows after the detected header, excluding explicitly labelled examples, or non-example visit rows containing input in date/centre/shift/remarks. They are row occurrences, not distinct children, verified transactions or import-ready records. **Partial/scaffold** rows contain some relevant input but no person name; they are not silently imported. Formula-only/format-only rows, headers, explicit example rows and derived reports are not transaction records. Duplicate candidates are counted before review; no deduplication or matching has been performed.

Attendance centre tabs, their master and the hidden helper are alternative/consolidated observations, not additive rosters. The 15 centre tabs contain 494 named row occurrences; the master also contains 494; the hidden helper contains 429 with no recoverable day headers. Do not add them to obtain a child population.

## Every worksheet

Dimensions are the used/formatted extent, not record counts. H=header row, C=candidate rows, E=explicit example/label rows, P=partial/scaffold rows, F=formula cells, V=validation rules. Worksheet names are exact (trailing spaces are called out).

| Ref | Exact tab | State | Dimensions | H | C | E | P | F | V | Classification |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ATT-01 | `Aralimatti` | visible | 36 x 373 | 3 | 31 | 0 | 2 | 1469 | 1 | wide attendance input |
| ATT-02 | `Sheet8` | hidden | 975 x 38 | 4 | 429 | 0 | 0 | 1377 | 2 | historical helper |
| ATT-03 | `Pivot Table 3` | hidden | 47 x 12 | 1 | report only | 0 | 0 | 40 | 1 | derived report |
| ATT-04 | `Avaradi` | visible | 39 x 373 | 3 | 34 | 0 | 2 | 1477 | 1 | wide attendance input |
| ATT-05 | `Badigawad` | visible | 35 x 374 | 3 | 30 | 0 | 2 | 1468 | 1 | wide attendance input |
| ATT-06 | `Bisanakoppa  [trailing space]` | visible | 53 x 374 | 3 | 35 | 0 | 2 | 1467 | 1 | wide attendance input |
| ATT-07 | `Dhawaleshwar` | visible | 39 x 374 | 3 | 34 | 0 | 2 | 1459 | 1 | wide attendance input |
| ATT-08 | `Haleyaragudri` | visible | 36 x 374 | 3 | 31 | 0 | 2 | 1472 | 1 | wide attendance input |
| ATT-09 | `Hallur` | visible | 48 x 374 | 3 | 34 | 0 | 2 | 1463 | 1 | wide attendance input |
| ATT-10 | `Hosayaragudri` | visible | 35 x 374 | 3 | 30 | 0 | 2 | 1472 | 1 | wide attendance input |
| ATT-11 | `Pamaladinni` | visible | 37 x 374 | 3 | 32 | 0 | 2 | 848 | 1 | wide attendance input |
| ATT-12 | `Rajapur` | visible | 46 x 374 | 3 | 41 | 0 | 2 | 861 | 1 | wide attendance input |
| ATT-13 | `Shivapur` | visible | 37 x 374 | 3 | 32 | 0 | 2 | 1472 | 1 | wide attendance input |
| ATT-14 | `Tigadi` | visible | 38 x 374 | 3 | 33 | 0 | 2 | 1468 | 1 | wide attendance input |
| ATT-15 | `Timmapur` | visible | 37 x 374 | 3 | 30 | 0 | 2 | 1472 | 1 | wide attendance input |
| ATT-16 | `Tukkanatti` | visible | 40 x 374 | 3 | 35 | 0 | 2 | 1454 | 1 | wide attendance input |
| ATT-17 | `Waderhatti` | visible | 37 x 374 | 3 | 32 | 0 | 2 | 1449 | 1 | wide attendance input |
| ATT-18 | `MasterSheet2026` | visible | 527 x 374 | 3 | 494 | 0 | 30 | 1825 | 1 | master/consolidation candidate |
| ATT-19 | `Pivot Table 2` | visible | 20 x 11 | n/a | report only | 0 | 0 | 1 | 0 | derived report |
| CHILD-01 | `New Entry` | visible | 1002 x 55 | 1 | 98 | 0 | 1 | 0 | 0 | profile input |
| CHILD-02 | `Sheet2` | visible | 950 x 25 | 1 | 561 | 0 | 0 | 24 | 0 | roster status review |
| VISIT-01 | `Mpokket - Visit Log` | visible | 1000 x 26 | 6 | 28 | 1 | 0 | 800 | 4 | transaction input |
| VISIT-02 | `Mpokket-Monthly Summary` | visible | 1000 x 26 | 7 | report only | 0 | 0 | 22 | 0 | derived report |
| VISIT-03 | `Mpokket-Visit Log` | visible | 999 x 26 | 6 | 32 | 1 | 0 | 800 | 3 | transaction input |
| VISIT-04 | `Mpokket - Monthly Summary` | visible | 1000 x 26 | 7 | report only | 0 | 0 | 19 | 0 | derived report |
| VISIT-05 | `Fanuc-Visit Log` | visible | 1000 x 26 | 6 | 32 | 1 | 0 | 800 | 3 | transaction input |
| VISIT-06 | `Fanuc- Monthly Summary` | visible | 1000 x 26 | 7 | report only | 0 | 0 | 23 | 1 | derived report |
| VISIT-07 | `Fanuc - Visit Log` | visible | 1000 x 26 | 6 | 28 | 1 | 0 | 800 | 3 | transaction input |
| VISIT-08 | `Fanuc - Monthly Summary` | visible | 18 x 5 | 7 | report only | 0 | 0 | 23 | 1 | derived report |
| VISIT-09 | `McAfee-Visit Log` | visible | 1000 x 26 | 6 | 28 | 1 | 0 | 800 | 3 | transaction input |
| VISIT-10 | `McAfee-Monthly Summary` | visible | 18 x 5 | 7 | report only | 0 | 0 | 21 | 1 | derived report |
| VISIT-11 | `McAfee - Visit Log` | visible | 1000 x 26 | 6 | 32 | 1 | 0 | 800 | 3 | transaction input |
| VISIT-12 | `McAfee - Monthly Summary` | visible | 1000 x 26 | 7 | report only | 0 | 0 | 19 | 1 | derived report |
| VISIT-13 | `Dasar UK- Visit Log` | visible | 999 x 26 | 6 | 20 | 1 | 0 | 799 | 3 | transaction input |
| VISIT-14 | `Dasar UK - Monthly Summary` | visible | 997 x 26 | 7 | report only | 0 | 0 | 13 | 1 | derived report |
| MOR-01 | `Mpokket-Morarji Training` | visible | 1001 x 26 | 4 | 135 | 1 | 0 | 0 | 3 | transaction input |
| MOR-02 | `Fanuc-Morarji Training` | visible | 965 x 26 | 3 | 187 | 1 | 0 | 0 | 3 | transaction input |
| MOR-03 | `McAfee-Morarji Training` | visible | 503 x 7 | 3 | 119 | 1 | 0 | 0 | 3 | transaction input |
| MOR-04 | `Dasar UK-Morarji Training` | visible | 1001 x 26 | 4 | 109 | 1 | 0 | 0 | 3 | transaction input |
| MOR-05 | `J.F-Morarji Training` | visible | 504 x 7 | 4 | 0 | 1 | 0 | 0 | 3 | transaction input |
| ACT-01 | `Mpokkket Monthly Activity` | visible | 499 x 7 | 4 | 494 | 1 | 0 | 0 | 1 | transaction input |
| ACT-02 | `Fanuc_Monthly Activity` | visible | 1000 x 26 | 4 | 484 | 1 | 0 | 0 | 1 | transaction input |
| ACT-03 | `McAfee_Monthly Activity` | visible | 996 x 26 | 4 | 494 | 1 | 0 | 0 | 1 | transaction input |
| ACT-04 | `Dasar UK_Monthly Activity` | visible | 104 x 7 | 4 | 0 | 1 | 0 | 0 | 1 | transaction input |
| ACT-05 | `J.F_Monthly Activity` | visible | 1090 x 26 | 4 | 1085 | 1 | 0 | 0 | 1 | transaction input |
| ASM-01 | `Mpokket -  Morning` | visible | 2006 x 26 | 6 | 404 | 1 | 0 | 1 | 6 | transaction input |
| ASM-02 | `Mpokket - Evening` | visible | 2005 x 26 | 6 | 446 | 1 | 0 | 1 | 6 | transaction input |
| ASM-03 | `Fanuc - Morning` | visible | 2022 x 26 | 6 | 448 | 1 | 0 | 1 | 6 | transaction input |
| ASM-04 | `Fanuc - Evening` | visible | 2067 x 26 | 6 | 500 | 1 | 0 | 1 | 6 | transaction input |
| ASM-05 | `McAfee - Morning` | visible | 2022 x 26 | 6 | 0 | 1 | 448 | 1 | 6 | transaction input |
| ASM-06 | `McAfee - Evening` | visible | 2067 x 26 | 6 | 0 | 1 | 500 | 1 | 6 | transaction input |
| ASM-07 | `Dasar UK- Morning` | visible | 2022 x 26 | 6 | 0 | 1 | 448 | 1 | 6 | transaction input |
| ASM-08 | `Dasaea UK-Evening` | visible | 2067 x 26 | 6 | 0 | 1 | 500 | 1 | 6 | transaction input |

ATT-03 has a pivot/report header in G1:L1; ATT-19 has only one populated cell and no usable transaction table. VISIT summary tabs have header row 7. MOR-02/MOR-03 have header row 3, unlike the other Morarji tabs' row 4. Such offsets must not be guessed globally.

## Header fields, types, validation and relationships

### ATT — attendance

Centre/master tabs: row 1 A1 is 1 July 2026; row 2 contains weekday TEXT formulas; row 3 A:E is Name of Child, Grade, Gender, Village Name, Class Category. F onward contains formula-derived day headings and intervening `Total` columns. Most tabs have 365 distinct days through 30 June 2027. ATT-06 has 366 through 1 July 2027; ATT-18 has 366 date-labelled columns but only 365 distinct dates. Neither discrepancy is automatically corrected.

Names/villages/gender/shift are text, grades largely numeric, marks are text codes; totals include numbers/formulas. List validation uses `P,A,WO,MM,L` (order varies). `H` is not a declared source code. Meanings and denominators for WO/MM/L are unconfirmed. Daily and summary formula patterns include TEXT, COUNTIF, SUM/AVERAGE/MAX and date increments. Many supplied row totals are stored values rather than independently verified formulas. ATT-04 has 14 COUNTIF formulas with numeric cached values in date-labelled column CO (25 September 2026), not attendance codes.

ATT-02 (hidden): row 4 A:D is Name of Child, Class, Gender, Village Name; E:AI contains 31 undated mark columns, AJ/AK total present/absent, AL active count. There is no Class Category column. The dates cannot be reconstructed from the visible tabs without owner confirmation. ATT-03 is a derived pivot; ATT-19 is not importable input. The master/centre overlap is evidence of consolidation, not permission to combine or overwrite.

No stable child ID exists in these attendance layouts. Centre tab labels and Village Name must be treated as distinct concepts until mapped; a child's residence is not automatically their programme centre.

### CHILD — registration and roster updates

`New Entry` has 55 header columns in row 1; 98 named profiles plus one partial row. The source's `Sl. No.` is a local serial, not a verified cross-workbook child ID; 72 named profiles lack it. Fields are:

| Column | Exact header | Observed/expected interpretation pending review |
| --- | --- | --- |
| A | Sl. No. | Numeric/local serial or blank; not authoritative person identity |
| B | Name | Sensitive response text; preserve exact meaning until approved |
| C | Village | Sensitive response text; preserve exact meaning until approved |
| D | Sex | Sensitive response text; preserve exact meaning until approved |
| E | Mobile | Phone/PIN represented numerically in places; identifiers must remain text, not arithmetic |
| F | DOB | DOB: date-like values, text formats and blanks; do not infer dates |
| G | Religion | Sensitive response text; preserve exact meaning until approved |
| H | Caste | Sensitive response text; preserve exact meaning until approved |
| I | Moholla | Sensitive response text; preserve exact meaning until approved |
| J | PIN | Phone/PIN represented numerically in places; identifiers must remain text, not arithmetic |
| K | Class | Sensitive response text; preserve exact meaning until approved |
| L | School | Sensitive response text; preserve exact meaning until approved |
| M | Received Preschool education? | Sensitive response text; preserve exact meaning until approved |
| N | Is he/she attending  tuition class or any other? | Sensitive response text; preserve exact meaning until approved |
| O | Dropout? | Sensitive response text; preserve exact meaning until approved |
| P | Child working? | Sensitive response text; preserve exact meaning until approved |
| Q | Father Name | Sensitive response text; preserve exact meaning until approved |
| R | Occupation | Sensitive response text; preserve exact meaning until approved |
| S | Education | Sensitive response text; preserve exact meaning until approved |
| T | Monthly income | Numeric/text/blank financial response; units, currency and ROI scale require confirmation |
| U | Loan taken | Sensitive response text; preserve exact meaning until approved |
| V | From where? | Sensitive response text; preserve exact meaning until approved |
| W | Loan Amount | Numeric/text/blank financial response; units, currency and ROI scale require confirmation |
| X | ROI | Numeric/text/blank financial response; units, currency and ROI scale require confirmation |
| Y | Mother Name | Sensitive response text; preserve exact meaning until approved |
| Z | Occupation | Sensitive response text; preserve exact meaning until approved |
| AA | Education | Sensitive response text; preserve exact meaning until approved |
| AB | Monthly income | Numeric/text/blank financial response; units, currency and ROI scale require confirmation |
| AC | Occupation of children by father | Sensitive response text; preserve exact meaning until approved |
| AD | Awareness Needed | Sensitive response text; preserve exact meaning until approved |
| AE | Siblings | Sensitive response text; preserve exact meaning until approved |
| AF | Any information on child marriage? | Sensitive response text; preserve exact meaning until approved |
| AG | Domestic Issue | Sensitive response text; preserve exact meaning until approved |
| AH | Mother Health | Sensitive response text; preserve exact meaning until approved |
| AI | Mother Devadasi? | Sensitive response text; preserve exact meaning until approved |
| AJ | Disabilities | Sensitive response text; preserve exact meaning until approved |
| AK | B/F | Repeated meal label; preserve block ordinal, do not collapse duplicate headers |
| AL | Lunch | Repeated meal label; preserve block ordinal, do not collapse duplicate headers |
| AM | Dinner | Repeated meal label; preserve block ordinal, do not collapse duplicate headers |
| AN | B/F | Repeated meal label; preserve block ordinal, do not collapse duplicate headers |
| AO | Lunch | Repeated meal label; preserve block ordinal, do not collapse duplicate headers |
| AP | Dinner | Repeated meal label; preserve block ordinal, do not collapse duplicate headers |
| AQ | Hobbies | Sensitive response text; preserve exact meaning until approved |
| AR | Skills Interested to learn | Sensitive response text; preserve exact meaning until approved |
| AS | Things I like in School | Sensitive response text; preserve exact meaning until approved |
| AT | Things I dislike in school | Sensitive response text; preserve exact meaning until approved |
| AU | Any suggestions for improvement | Sensitive response text; preserve exact meaning until approved |
| AV | Mother Tongue | Sensitive response text; preserve exact meaning until approved |
| AW | Languages Known | Sensitive response text; preserve exact meaning until approved |
| AX | Reading  | Sensitive response text; preserve exact meaning until approved |
| AY | Math | Sensitive response text; preserve exact meaning until approved |
| AZ | English Reading | Sensitive response text; preserve exact meaning until approved |
| BA | Word Meaning | Sensitive response text; preserve exact meaning until approved |
| BB | Sentence Meaning | Sensitive response text; preserve exact meaning until approved |
| BC | Any other Info? | Sensitive response text; preserve exact meaning until approved |

`Sheet2` row 1 has A=0 (no usable name/ID label), B Village Name, C Gender, D Grade, E Remove/Retain?, F If retained, mention Current Class, G If removed, mention the reasons. Its 561 name-bearing rows contain 395 `retain`, 84 `remove` and 82 other action labels after case/whitespace normalization. No dropdown rules are present. These observations are not dated enrolment exits and do not identify the same people as New Entry automatically. Some fields contain literal formulas/references; 24 formula cells occur in this sheet. The two sheets have no verified shared unique key.

### VISIT — visits and calculated summaries

Seven log tabs: officer context in row 2 (not reproduced); header row 6: Visit Date, Center Name, Shift, Remarks, Month (auto). Column E uses IF/TEXT. Seven monthly summaries have officer/month context, targets of two morning and two evening visits, and row 7 fields Center Name, Morning Visits, Evening Visits, Total Visits, Status. Summary formulas include COUNTIFS/date bounds, SUM, IF/AND/OR/MAX, but many summary values are also hardcoded. Summary values and counters must be reconciled from verified logs, not imported as separate visits.

Source validation offers project-specific centre lists and Morning/Evening; dates must be greater than Excel serial 36526 (1 January 2000). All 200 non-example input rows lack visit date, and all contain repeated template-like remarks. Seven labelled Example Center rows are excluded; the remaining records require authenticity/date review, not automatic treatment as completed visits. Officer names are context, not authenticated identities or historical assignment grants. Source has remarks, not separate Next action or Completed/Planned fields.

### MOR — Morarji training/outcomes

Header fields A:G: Date, Student ID, Student Name, Applied (Yes/No), Attended (Yes/No), Passed (Yes/No), School Name (if Passed). Five examples are excluded. MOR-05 is example-only. All 550 named candidates have blank Date and Student ID. Yes/No validation applies D:F; date validation uses >1 January 2000; school-name custom validation references Passed=Yes. Source Date meaning and cohort year are not established. School Name is a real source field that the present frontend does not collect. No source training-day count, selection, admission or scholarship-receipt field is present. Data must not be interpreted as those outcomes.

### ACT — monthly activity

Month context B2 is 1 October 2026 on all five tabs. Row 4 fields: Student ID, Student Name, Class, Activity 1-4. Five examples are excluded; ACT-04 is example-only. There are 2,557 named row occurrences, all without IDs. Yes/No lists apply to activity cells but range coverage varies and does not always cover all four columns on every data row. Slots 1 and 2 are filled on all named rows; slot 3 has one response, slot 4 none. In total 5,113 slot cells are blank. A blank is not No.

There is no centre, shift, event date, category, activity title, held/cancelled status or event ID column. Project grouping and class are context, not proof of identity or event occurrence. Preserve source month+slot observations; do not invent four Saturday events or map slots to cultural/sports without approval.

### ASM — assessment

Row 6 A:H: Academic Year, Quarter, Student Name, Class, Gender, Score, Assessment Date, Village Name. Project/shift context is in the tab/title; B3 specifies maximum score. Four morning tabs show 100, four evening tabs 25. Row 7 is explicitly an example and is excluded in all eight tabs. Four named-data tabs have 1,798 candidates and 1,693 numeric scores, all between 0 and 25; four other tabs have 1,896 quarter-scaffold rows without names, not assessment results.

Validation: academic years 2025-26 through 2035-36; Q1-Q4; Morning Grade 1-4 versus Evening Grade 5-10; Male/Female/Other; decimal scores between 0 and B3; dates >1 January 2000. Actual named candidates cover Q1/Q2. These are source quarters, not proven equivalents of frontend F1/F2. Decimal validation does not justify imposing the frontend's integer-only rule.

1,794 named rows lack academic year. Assessment dates: 948 blank, 477 ISO-shaped date values, 373 text values in `dd/mm/yyyy.` or two-digit-year `dd-mm-yy` shapes. Do not fill years or parse ambiguous dates silently. There is no stable student ID in this layout. Count formulas in F2 do not replace a record audit or identify a missing-score result as absent.

## Relationship and import cautions

Names, village/class/shift context and source project labels are candidate matching evidence only. No source establishes a trustworthy global student key, complete dated centre/shift history, or staff-to-auth-account mapping. Never merge people by normalized name or fabricate external student IDs. Keep source snapshot rows independent until adjudication.

Proposed destination mappings, full quality counts, schema justifications, review gates and exception handling are in the other Phase 2B documents. Workbook data stays outside Git; only aggregate findings and field metadata belong here.
