# MASS CAC Dashboard: Phase 2A discovery handover

Assessment date: 26 October 2026. Status: frontend discovery completed; source-data discovery blocked; database design and implementation not ready.

## 1. Evidence, scope and limits

### Confirmed from source data

No MASS source file, sheet, row, formula, validation rule or business document was accessible. No source-derived finding is asserted in this report.

The supplied folder ID is `1uFA3NiFjEKrkts6J4b5o0E6tErOoD9SB`. A read-only HTTPS request to the supplied Google Drive URL failed with `Tunnel connection failed: 403 Forbidden`. No Drive/Sheets connector is available in this environment. This is an observed environment/proxy denial; it does not establish that the folder has incorrect sharing permissions or contains no files. Original Drive files were not modified.

The referenced **Pre-KC-2 Pilot Guidelines** was not present among available attachments or repository documents. Its contents have not been applied or invented. The uploaded Phase 2A request was read as the user's instruction; project-history documents were treated as evidence, not additional authorization.

| Source inventory requirement | Current evidence |
| --- | --- |
| Folder ID | Supplied above; folder contents not retrieved |
| Exact child filenames and IDs | Unknown; zero files inspected, not zero files present |
| Spreadsheet/tab names and IDs | Unknown |
| Row/column counts, headers, types | Unknown |
| Required/optional fields and identifiers | Unknown |
| Dropdowns, validation rules and formulas | Unknown |
| Date formats, relationships and historical coverage | Unknown |
| Input/master/history/report classification | Unknown |
| Duplicates, missing values and integrity issues | Not assessed |

Source-dependent tasks are stopped. A schema, field definitions for database tables, source-to-destination mappings, PK/FK choices and an ER diagram are deliberately withheld until real sources are inspected. Frontend object names below are implementation facts, not approved tables or proof that corresponding sheets exist.

### Confirmed from frontend and Git

- Inspected `src/app.js`, `src/data.js`, `src/dropout.js`, entry HTML, package/build/export configuration, README and historical project notes at commit `9428656acdb6e924e368e08bd43ba9a139c8f0c9`.
- GitHub remote HEAD advertises `main`; both `main` and `migration/frontend` point to that commit.
- Vanilla JavaScript ES modules; one HTML entry point; no backend calls, authentication SDK, Supabase client or third-party application dependencies.
- Navigation changes in-memory state, not pathname routes. Refresh resets the selected view/role/filters. Responsive navigation shares the same render/handlers.
- The demo's operating date is fixed to `2026-10-20`, not the assessment date.
- Historical notes contain superseded statements; executable source is authoritative for what the frontend currently does, not for real MASS policy.
- No production URL interaction, Drive record reading, live database operation or new browser regression suite was performed during this discovery. The earlier migration test record is separate evidence.

### Proposed decisions versus approved work

Only documentation is prepared here, on local branch `feature/source-data-discovery`; no push or deployment is authorized by this assessment. The migration/security approach below is a proposal requiring review. No proposed entity, constraint, permission or business rule is approved by inclusion in this report.

## 2. Frontend functionality inventory

| View / state | Display and reads | User actions / writes | Important boundaries |
| --- | --- | --- | --- |
| Overview (`overview`) | Roster counts, attendance/engagement, dropout coverage, visits, marks, grade/gender distributions, Morarji scorecard, student summary | Filters; centre/student drill-down; follow-up; donor overview | Leadership and Cluster Officer navigation; Teacher is redirected to daily attendance |
| Attendance (`attendance`) | Attendance percentage, bands, missing entries, sessions delivered, individual monthly status | Open daily entry; update session; follow-up | Bands and monthly totals use a different date selection from the percentage calculation |
| Daily Attendance (`daily`) | Child/date P/A/H entries, marked count, selected shift | Toggle/clear single marks; confirmed bulk Present/Absent/Holiday; date/shift selection | Corrections overwrite the existing child/date entry; marking attendance does not mark the session Held |
| Student Profile (`children`) and detail modal | All scoped roster records, status, dates, marks and follow-up detail | Create/edit profile; open related follow-up | No record deletion, transfer history, enrolment episode history or server-generated ID |
| Learning (`learning`) | F1-F4 combined marks, coverage, bands, common-scale averages and matched-round comparisons | Per-child four-round editor; group marks/date/comment entry | School performance is a placeholder, not a loaded dataset or working form |
| Activities (`activities`) | Held/planned events, participation distribution, cultural/sports engagement, annual-plan reference | Create/edit session; two-stage participation editor; bulk participation choices | Activity participation is independent of daily attendance; plan reference is not evidence of delivery |
| Officer Visits (`visits`) | Monthly completed/planned logs, officer totals and centre/shift coverage | Add visit, feedback and next action | No existing-visit edit action is implemented |
| Morarji (`morarji`) | Separate yearly cohorts; application, exam, selection, admission and scholarship counts | Add existing eligible Grade-5 child to cohort; edit current/historical outcomes | Cohort view ignores CAC month/grade/shift; current map supports only one cohort per child |
| Career Guidance (`guidance`) | Participant/contact/destination/evidence statistics and teacher feedback | Add separate participant; edit follow-up; save feedback | Hidden until optional later-module preview is enabled; not a student-linked production workflow |
| Donor summary (`donor`) | Aggregate counts/charts and separate cohort-year scorecard | Print; aggregate CSV; filters | Not an authenticated donor account; entire underlying local dataset remains in the browser |
| Prototype guide / utilities | Caveats, rule descriptions and source link | Source ZIP; reset sample records; later-module toggle; navigation collapse | Reset replaces local records, not a production deletion operation |

### Navigation, filters and presentation

- Teacher: daily attendance, Student Profile, Learning, Activities and Morarji; optional Career Guidance. Scope is hardcoded to one demonstration centre. The source does not provide a Teacher Overview despite a later historical note claiming one.
- Cluster Officer: overview/My Centres, profiles, visits, attendance, learning, activities and Morarji; optional Career Guidance. Scope is a hardcoded sample officer-name comparison. Leadership sees all sample centres. Role switching is freely available.
- Common filters: September/October 2026 reporting month; centre; shift. Donor filtering is offered for Leadership overview/donor summary; Learning uses F1-F4 and predefined comparison pairs. Morarji uses cohort year/centre independently. Career Guidance is independent of the CAC month.
- Student text search matches name or ID, case-insensitively. Overview has a Needs review toggle. Grade/gender state values exist but the shared `children()` predicate does not apply them; no functional grade/gender filter should be assumed from those state keys. Officer scope is consumed internally, but the shared filter renderer does not expose an officer dropdown.
- Activity event listings do not apply the shift filter in `activityEvents()`, while child statistics do apply student shift. Treat totals across these displays carefully.
- Tables are paginated by hiding rows after rendering all data, ten per page. Pagination is not server-side retrieval or access control.
- Chart references 1-23 cover attendance, participation, sessions, assessments/comparisons, visits, Morarji, guidance destinations and roster distributions. Chart 10 is the school-performance placeholder. Charts are HTML/CSS and inline SVG, not external data services.

## 3. Frontend storage and field dictionary

All fields below describe JavaScript data, not database DDL or source-sheet types. ISO-shaped date strings are used by the demo; actual spreadsheet date representations remain unknown.

| Store | Existing key / identity | Fields and observed representation |
| --- | --- | --- |
| `centres` constant | `C01`-style string ID | `id`, `name`, `officer`, `donor` strings; current assignments only, not dated history |
| `students` array | `CAC-001`-style string | `id`, `name`, `centre`, `shift`, string `grade`, `gender`, `enrolled`, boolean `active`, `note`; forms add `enrolmentStatus`, `exitDate`, `challenge`, optional `boardPassed` |
| `sessions` array | lookup on centre + shift + date | `centre`, `date`, `shift`, `status`; no standalone ID |
| `attendance` object | `studentId|date` | String P/A/H; absence of a key means unmarked, not A; no explicit centre/session/shift/year key |
| `events` array | seeded ID or `EV-` + browser milliseconds | `id`, `centre`, `date`, `name`, `category`, `status`, optional `shift` (legacy seeded events omit it) |
| `participation` object | `studentId|eventId` | Attended/Not attended; seeded Unknown exists; missing key is unmarked |
| `scores` object | student ID, then F1-F4 | Number or null; zero and missing are distinct; key has no academic year, subject or attempt |
| `assessmentDetails` object | `studentId|round` | `maxMarks` number, `status`, `date`, `performance`, `year` string; initialized when app loads; default max is 25, form writes year 2026-27 using an en-dash label |
| `assessmentBatches` object | `round|centre-or-all|shift-or-both` | `date`, `comment`; no year, stable batch ID or preserved membership |
| `followups` object | student ID | `status`, optional next-contact `date`, `note`, `updated` timestamp; one latest record, not history |
| `visits` array | seeded ID or `V-` + browser milliseconds | `id`, `centre`, officer name, `shift`, `date`, `status`, `feedback`, `action` |
| `morarji` object | student ID | `cohort`, nullable integer `trainingDays`, nullable booleans `applied`/`took`/`selected`/`admitted`, `result`, `scholarship`; one current object per student |
| `morarjiHistory` array | nested historical `s.id` | Nested child fields `id`, `name`, `centre`, `gender`, plus the same cohort/outcome fields; separate fictional people, not verified historical links |
| `guidance` array | seeded ID or `G-` + browser milliseconds | `id`, `name`, `centre`, `grade`, optional `gender`/`session`, `followup`, `contact`, `destination`, `verification`; not linked to `students.id` |
| `guidanceFeedback` | single top-level value | Free text, not keyed by centre, programme session, author or year |
| Metadata | top-level properties | numeric `version`, nullable/string `lastSaved`; not record revisions or audit history |

Synthetic seed inspection found 6 centres, 72 students, 576 session records, 2,922 attendance entries, 48 activity events, 504 participation entries, 72 student score maps, 21 visits, 6 current Morarji entries, 6 independent historical cohort records and 12 guidance participants. These are demonstration counts, not MASS source counts.

### Persistence and CRUD mechanics

`app.js` loads one JSON object from origin-local localStorage key `mass-cac-companion-v1`. Missing version seeds the demo; absent sessions/history are filled from the demo, and assessment objects are initialized. `persist()` serializes the entire object, updates `lastSaved` and catches storage errors. There is no authentication, API, concurrent-write control, per-user partition, durable transaction, record audit or cross-device sync. The object is changed in memory before storage; a storage error does not roll back that in-memory mutation. Browser storage can be inspected or modified outside the forms.

Single attendance/participation selections can be cleared, and edits replace values. There is no general delete/archive API. Other than resetting the whole demo, the principal destructive behavior is overwriting previous profile/score/follow-up/outcome values. Batch exam validation collects changes before assigning them; activity session/participation are saved together in local memory, which is not a database transaction.

## 4. Every data-entry interaction and its validation

These are UI checks, not trusted production constraints. Dropdowns are not server-side validation.

| Interaction / handler | Entered or changed fields | Current validation / control values | Outstanding integration issue |
| --- | --- | --- | --- |
| Profile create/edit: `editChild` | Name, centre, shift, grade, gender, enrolment date/status, exit date, challenge, Grade-10 board result | Nonblank trimmed name/date; enrolment <= fixed demo date; scoped centre; Morning/Evening; grades 1-10; Girl/Boy; status Active/CAC dropout/Left programme; inactive requires exit between enrolment and demo date; active requires no exit; board result blank/Yes/No | Confirm real identifiers, categories, transfers/re-enrolment, history and privacy. Possible match uses normalized name+centre+grade; no automatic merge. Different-student checkbox exists on create only. `active` is derived from entered status, which is distinct from calculated monthly dropout |
| Daily mark toggle | P/A/H or missing at child/date | Child must be in current scope and date >= enrolment; UI date max and date-change handler use fixed demo date | No stable session FK; direct and bulk handlers have different guards; backend must validate scope, date, eligibility and revision independently |
| Bulk attendance | Current visible children/date -> P, A or H | Confirmation modal; excludes dates before enrolment | Define atomicity, reasons, edit rights and concurrency; no original source support verified |
| Session: `sessionEntry` | Centre, shift, date, Planned/Held/Cancelled | Date required; Held cannot be future relative to demo date; upsert by centre/shift/date | Centre options scoped in UI; callback does not repeat centre-membership validation. Clarify calendar authority and meaning of cancellations |
| Follow-up: `followup` | Status, optional next-contact date, required note | To follow up/In progress/Completed; nonblank note | Date has no further rule here; previous note replaced. Decide whether repeated actions and audit are required |
| Per-student marks: `editLearningRow` | F1-F4 status/marks/date; existing maximum displayed read-only | Recorded/Absent/Not entered; recorded score integer 0..max and date required; other statuses require blank score; no future date; updates validated before mutation | Academic year/attempt/paper identity absent from key. Existing performance note is preserved, not edited by this form |
| Group marks: `enterMarks` | Group date, per-student status/score, optional overall comment | Same score/status rules; date may fall back to existing result date; read-only maxima | Batch key not stable across changes of scope/year; overall comment is not an individual teacher remark |
| Activity details: `activitySession` | Centre, shift, date, activity name, status | Scoped centre/date required; Both shifts/Morning/Evening; Held/Planned/Cancelled; future Held rejected; category derived from catalogue or existing event | New catalogue has four cultural/sports activities only. Standard catalogue and Important day creation are not established by source; legacy names/categories may persist |
| Activity participation: `activityParticipants` | Per eligible child Attended/Not attended or clear; bulk choices | Held requires nonempty eligible roster and every mark; Planned/Cancelled must have no marks; new exact centre/date/shift/name duplicate rejected | Edit does not run the new-record duplicate guard. Moving an event or changing eligibility can leave old participation keys outside the current roster; reconciliation and transactions need design |
| Visit: `newVisit` | Centre, shift, date, Completed/Planned, feedback, optional next action | Date/trimmed feedback required; future Completed rejected; scoped centre; officer copied from current centre | Stable officer identity and historical assignment needed; no visit correction form currently exists |
| Add Morarji cohort: `newMorarji` | Existing student, cohort-year text | Scoped current Grade-5 students with no current map entry; cohort nonblank; outcomes start unknown | Student can currently have only one current cohort map; arbitrary label is not a verified academic-year definition |
| Morarji update: `editMorarji` | Training days; application/exam/selection/admission flags; result; scholarship | Days blank or nonnegative integer; flags Unknown/Yes/No; result Pending/Passed/Not passed/Not applied; scholarship Not recorded/Pending/Received; application=false cannot have took=true; pass/fail requires took=true; admission=true requires selected=true | Partial consistency checks only; repeat attempts, dates and evidence are not modeled. Historic nested profile handling needs source identity resolution |
| Guidance participant: `newGuidance` | Name, centre, grade | Trimmed name and scoped centre; grades 10/11/12; ID from browser milliseconds | Does not create/link a student profile and does not capture all seeded gender/session fields |
| Guidance follow-up: `editGuidance` | Follow-up date, contact, destination, evidence source | Contacted/Not contacted; Unknown/Class 11 Arts/Class 11 Science/Class 12/ITI Electrical/Diploma course; Self-reported/Verified admission; uncontacted must be Unknown; follow-up date required and <= demo date | Free-standing participant; repeated contact/history and evidence documents absent |
| Guidance feedback | One free-text value | No additional validation; overwritten by Save feedback | No centre/session/author/year scope; cannot infer destination entity |
| Reset demo | Replaces local database with seed; clears result metadata | Confirmation modal | Prototype utility, not a production data-management requirement |

All actual spreadsheet matches and corresponding production entities for these interactions remain unverified. Nothing above authorizes adding fields or tables to compensate for missing sources.

## 5. Calculation register and frontend risks

| Calculation | Executable behavior | Decision still required |
| --- | --- | --- |
| Operating calendar | First 24 non-Sundays; current attendance expectations stop at fixed demo date | Actual per-centre/shift calendar, exceptional closures, time zone and holiday rules |
| Monthly P/A/H/missing counts | Operating dates after enrolment; counts individual marks regardless of explicit held-session status | Reconcile with source calendar and percentage method; exit boundaries and historical assignments |
| Attendance percentage | Distinct Held session dates for current centre/shift/month, >= enrolment and <= demo date; H excluded; P numerator; missing retained in denominator and reported separately | Approve denominator and missing treatment; no source rule verified |
| Attendance bands | Below 15; exactly 15; 16-20; 21-25, with incomplete records withheld in band chart | Month-to-date interpretation and >25 behavior; different widgets do not all enforce upper bound identically |
| Good engagement | More than 20 P days AND at least two cultural/sports participations; no missing attendance or missing core participation; scores excluded | Real rule, exceptional calendars and eligible activity categories |
| Activity completeness | Some counts require no missing participation of any category; engagement checks only missing cultural/sports | Harmonize if new categories are approved |
| Strong participation | Good-engagement records with at least four core activities | Provisional display criterion, not an award or approved ranking |
| Assessment bands | Only 25-mark records; 0-8, 9-15, 16-20, 21-25; lower-band label explicitly unconfirmed | Paper maxima, band labels and whether scores are combined/subject-level |
| Assessment averages/change | Exclude nulls; average only common maxima; compare matched students with same maxima; mixed-max mean change withheld | Equal maximum is not proof of comparable papers or causal impact |
| CAC dropout | Complete calendar month; enrolled by first day; planned-session statuses all resolved; at least one Held day; complete P/A/H for Held dates; all-H unclassified; no P -> dropout | Source-backed approval, exit/transfer handling and rate denominator. Code comments claim earlier PM confirmation; no underlying business document was accessible here |
| Officer coverage | Four visits/centre/month, two per shift | Targets, distinct-visit definition, officer assignment history |
| Morarji outcomes | Independent cohort counts; pass != selection != admission != scholarship | Cohort-year definition, repeated participation and follow-up requirements |
| Guidance outcomes | Contacted/known destinations/verified admissions; qualitative feedback | Session identity, follow-up episodes, programme eligibility and evidence requirements |

Additional risks confirmed by code inspection:

1. Assessment scores and metadata overwrite by student+round even though metadata carries a fixed year. Repeated years/papers/attempts cannot be safely represented by that key.
2. Editing a student's current centre/shift/grade can reattribute old records because historical queries use current profile values. No assignment/enrolment history exists.
3. `children()` includes active students or exits on/after the selected date/month start, without itself requiring enrolment before that date. Profile and programme displays use different inclusion predicates. These are not approved historical roster definitions.
4. Follow-ups, guidance feedback and outcome updates do not preserve prior versions. No actor attribution or correction approval exists.
5. Generated sequential and millisecond IDs are unsafe across concurrent browsers. Names/officer strings and embedded historical people are not reliable production identity keys.
6. Role checks and readonly-looking donor views provide no data isolation; all underlying records are loaded locally. Client-side scope cannot substitute for RLS.
7. School performance, subject marks, evidence files, signatures/approvals and several annual-plan workflows are not implemented. No corresponding schema is inferred.
8. Documentation mentions broader Important day creation, an officer filter and Teacher Overview; the inspected implementation does not expose those features as described. It also documents earlier thresholds superseded by code. Preserve the current app while reconciling policy separately.
9. CSV export quotes cells but does not neutralize spreadsheet formula prefixes in entered text. Before real-record exports, define permissions, minimization and formula-injection handling in a separate approved implementation task.
10. The source-download build recursively packages `src/`, `scripts/` and `docs/`. Real data, private source copies, credentials and sensitive analysis must never be stored in those paths. Secure database migration logs must also stay outside this public archive.

## 6. Frontend-Database Mapping Matrix

See companion `PHASE-2A-FRONTEND-MAPPING.csv` for every interaction's ten requested mapping columns. In every row, **source file/sheet = inaccessible**, **proposed database entity = deferred**, and **unchanged frontend = not yet decidable**. The frontend fields are requirements to verify, not inferred source columns. No claim is made that sources support an existing form, or that a missing sheet means a new entity should be added.

## 7. Source inspection and mapping protocol (proposed)

Once authorized read access or exports are available:

1. Inventory every relevant file with exact original filename/ID, MIME type, parent, version/modified timestamp and available checksum. Separate original sources from copied exports. Inventory all tabs, including hidden tabs, named ranges and reference sheets; report inaccessible items explicitly.
2. Record sheet ID/name, used range and header/data row boundaries. Distinguish physical rows, nonempty records and totals. Inspect formulas and displayed/unformatted values, cell types/number formats, dropdown validation, required-field rules, protected ranges, merged cells and header variants. XLSX/CSV export fidelity limitations must be recorded.
3. Classify each tab from actual contents and owner context: master/reference, input, historical record, derived report or summary. Establish time coverage and locale/date serial interpretation. Do not assume a total or chart sheet is independent input.
4. Produce aggregate quality profiles: missingness per field; uniqueness and candidate-key collisions; controlled-value variants; invalid/ambiguous dates; orphan references; inconsistent enrolment/attendance/outcome states; totals versus detail reconciliation. Keep person-level review in a restricted workspace, not Git or chat.
5. Create a source-field dictionary with observed type, declared rule, observed exceptions, required/optional status and evidence location. Observe rather than guess requiredness from absence of blanks. Map every frontend input to verified fields, and log unsupported frontend fields or missing UI support for real source fields.
6. Obtain owner decisions on identity matching, repeats, historical membership, calendars, metric definitions and permissions. Only then propose entities, keys/cardinalities, lookup values, normalization, indexes and a Mermaid ER diagram.

The eventual source-to-destination mapping register should contain file ID/name/version, sheet ID/name, header/column, source type, target entity/field (not filled yet), transformation/version, key-resolution rule, validation, requiredness, formula-versus-input treatment, evidence and approval status. Keep formulas/raw values distinct from accepted canonical inputs.

## 8. Migration and validation strategy (proposed; not executed)

- Work from authorized immutable snapshots. Retain source version/hash and import-run IDs. Keep raw files and staging records encrypted/access-controlled outside the repository and downloadable frontend ZIP.
- Prefer verified native source record IDs. Where none exist, retain snapshot-specific file ID + sheet ID + row locator and a mapping crosswalk. Row number alone is not stable across edits or sorting; a hash alone cannot distinguish legitimate identical rows. Do not choose an upsert identity until those cases are resolved.
- Record extraction version, source row locator, transformation version and accepted destination identity for every migrated record. Preserve raw-to-canonical lineage without exposing raw PII in logs.
- Duplicate detection should produce review candidates; never automatically merge children by name. Confirm how transfers, re-enrolments, same-name people, repeated scores/events and duplicated exports are distinguished.
- Keep raw values while proposing canonical date/value/name transformations. Reject or quarantine ambiguous dates, unknown controlled values and unresolved references instead of silently coercing them. Never replace missing marks/attendance/outcomes with zero/false/absence.
- Build deterministic, versioned transformations and approved unique-key/idempotency rules. Validate before write, checkpoint batches and use transactions where appropriate. Retry only failed/retryable batches; a rerun must not duplicate accepted records or overwrite a later correction silently.
- Reconcile extracted = accepted + rejected + explicitly classified exclusions per file/tab/run. Reconcile destination inserts/updates/unchanged against crosswalks and natural-grain totals. Compare attendance/status/period distributions, assessment coverage and aggregate metrics, not just total rows. Validate foreign keys after all dependencies load.
- Error register proposal: import run ID, source file ID, sheet ID/name, source row locator, non-PII error code/reason, field reference, review state and retry/correction outcome. Raw offending values and student names belong only in a separately protected review channel if necessary, never public logs or Git. Record formula errors and excluded summary rows separately.
- Require synthetic dry runs, repeat-run tests, failed-batch recovery tests, referential-integrity checks and approved reconciliation thresholds. Plan backups and a rollback/reversal approach before any production write. No real migration is authorized now.

## 9. Authentication and RLS requirements register

No policies are designed as approved rules or activated. Frontend role labels are only prompts for confirmation.

| Requirement to confirm | Evidence / unresolved question | Security implication |
| --- | --- | --- |
| Identity and onboarding | Existing staff identities, login method, invitation/removal and identity-provider requirements unknown | Do not derive privileges from a client role selector or editable user metadata |
| Teacher scope | Demo shows one centre and both shifts | Confirm actual centre/shift assignments, effective dates, read/write rights and correction period |
| Cluster Officer scope | Demo uses a name comparison for four sample centres | Confirm stable staff identity, dated assignments, cross-centre access and authority to edit versus review |
| Leadership versus administrator | Leadership demo sees all data; administrator role not modeled | Separate reporting, data correction, user management and policy administration decisions |
| External donor access | Aggregate UI only; no donor account | Confirm whether accounts exist, funding periods, approved metrics, small-group disclosure limits and drill-down prohibition |
| Historical access | No assignment history exists in demo | Decide access to former centres/cohorts and retroactive corrections |
| Export and sensitive notes | Student CSV contains identifying fields; notes are free text | Confirm export entitlement, minimization, retention and safeguarding requirements |
| Correction/audit | Demo overwrites in place | Confirm actor/time/before-after logging, reasons, approvals and conflict handling |
| Unauthenticated/public access | Prototype has no auth | No anonymous access to real records without an explicit approved requirement |
| Import/service operations | No import identities or service boundary | Privileged credentials must remain server-side; migration access separate from browser access |

Later RLS tests should exercise allowed and denied reads/writes directly through APIs, not just hidden buttons: anonymous access, out-of-scope records, assignment changes, donor payloads, exports and privileged operations. Policy details and role permissions require review first.

## 10. Supabase implementation readiness

No Supabase connector, relevant injected environment binding, local `supabase/` configuration or existing `.env` file was found. An existing MASS project may exist elsewhere; its existence, region, schema, auth, RLS, grants, exposed schemas, backup and security settings are not verified. No project was created or accessed.

Future configuration names to review, not requirements added now:

- Browser public configuration: project URL and the appropriate publishable/public key, delivered through an explicit build/runtime config path. The current static app does not automatically expose process environment values. A public key must be paired with approved authentication/RLS; it is not a service credential. Do not commit actual project configuration or keys during this phase.
- Server-only migration tooling may need a database connection credential and management tooling may need a separate access token. Exact names/scopes depend on the selected workflow. Never expose service-role/secret/database credentials in browser code, source ZIPs, Git or client logs. Supply secrets through approved environment settings, not chat.

After source/model approval, organize reviewed SQL changes in `supabase/migrations/` with ordered versioned files; use synthetic fixtures/seed data and schema/RLS/constraint tests in a separate isolated test database. Verify fresh application and upgrade paths, permitted and denied operations, import idempotency, concurrency and representative query plans. Do not infer table names, constraints or indexes now.

Frontend-confirmed query workloads to evaluate after keys are agreed include scoped centre/shift/date-range attendance, student-linked profile/detail retrieval, event-linked participation, assessment coverage and round comparisons, cohort-year filtering, visit coverage by centre/officer/month, and provenance lookup during import retries. These identify likely indexing and pagination needs without prescribing indexes on an unverified schema. Uniqueness constraints must follow approved record grain, not the demo's current object keys. Authoritative facts and derived dashboard aggregates should be distinguished; normalization and any intentional denormalization/materialized summaries require source evidence and measured query needs before approval.

For the vanilla JS app, a reviewed data-access adapter can translate backend responses into the existing rendering shape while server/database operations enforce identifiers, authorization and transactions. Replacing synchronous local mutations with async reads/writes will require explicit loading/error/conflict behavior; zero frontend-code change cannot be promised. Preserve layouts where possible, but source correctness and security take precedence over mock assumptions. SDK versus direct API usage remains undecided; no dependency was added.

## 11. Questions and decisions register

| ID | Required input / decision | Blocks |
| --- | --- | --- |
| Q01 | Authorized access/export of all relevant Drive files, including historical/master/input/report tabs | Complete inventory, source quality assessment and all source-backed design |
| Q02 | Supply Pre-KC-2 Pilot Guidelines and confirm which process requirements apply | Process-conformance assessment |
| Q03 | Identify authoritative sources/owners and time coverage; identify formulas versus manually entered values | Source precedence, reconciliation and field mappings |
| Q04 | Confirm stable person/centre/staff IDs and identity matching across years, transfers and programmes | PK/FK strategy, deduplication and historical integrity |
| Q05 | Confirm calendars, P/A/H semantics, attendance denominator, missing treatment and dropout rule/denominator | Accepted calculations and migration validation |
| Q06 | Confirm assessment years/rounds/papers/maxima, repeat attempts and allowed comparisons | Result grain and learning model |
| Q07 | Confirm activity catalogue/categories, eligibility, duplicate rules and engagement criteria | Event/participation grain and metrics |
| Q08 | Confirm cohort definitions, repeat participation and historical identity links for Morarji/guidance | Longitudinal programme modeling |
| Q09 | Confirm all roles, dated scopes, exports, donor access and safeguarding/retention obligations | Authentication design and RLS |
| Q10 | Confirm correction history, approval, audit, concurrent/offline behavior and ownership | Write workflows and access rules |
| Q11 | Identify an existing Supabase project through authorized metadata access; review region/security | Environment readiness; no resource creation authorized |
| Q12 | Review any frontend/source mismatch before changing UI assumptions or adding entities | Model acceptance and integration scope |

## 12. Deliverable status and implementation order

| Requested deliverable | Status |
| --- | --- |
| Complete source-file/sheet inventory | Blocked; folder locator and access result recorded |
| Source quality/structure assessment | Blocked; no real-record findings invented |
| Frontend inventory | Completed from inspected source, including forms and local data dictionary |
| Frontend-Database Mapping Matrix | Frontend side completed; source/entity sides explicitly deferred |
| Proposed schema and field definitions | Withheld pending source verification; frontend field dictionary is not a schema |
| Initial ER diagram | Withheld; no source-backed entities/cardinalities yet |
| Source-to-destination mapping | Proposed register/process only; no fabricated mappings |
| Migration/validation strategy | Proposed above; not approved or executed |
| Auth/RLS register | Prepared for confirmation; no policies activated |
| Questions/assumptions register | Prepared; mock behavior explicitly separated from real policy |
| Implementation order | Below |
| Technical handover | This report and companion matrix |

Recommended order: obtain authorized sources and guidelines -> inventory/profile real data -> reconcile every frontend interaction -> resolve identity/history/metric/security decisions -> review schema/ER/mappings -> assess existing Supabase project -> approve SQL/RLS/test design -> test with synthetic fixtures and secure dry runs -> approve migration/integration -> validate in Preview before any production release.

To unblock source inspection, provide authorized Drive/Sheets access or a secure archive of relevant workbooks and supporting documents. Original XLSX files are preferable to CSV-only exports because formulas, tabs and validation metadata matter; for native Sheets, preserve original file IDs, sheet IDs and export timestamps in a manifest and include validation/named-range details that exports omit. Do not change the folder to public merely to bypass the environment denial. Include the Pre-KC-2 guidelines. No credentials or personal records should be pasted into chat or committed to Git.

The project is **not ready to proceed to Supabase implementation**. No application files, business logic, `main`, remote branches, deployments or database resources were changed by this assessment. Documentation remains local and must not be pushed as an implicit deployment action.
