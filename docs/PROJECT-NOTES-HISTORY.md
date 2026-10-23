# MASS · CAC Programme — interactive prototype

A fresh English-language, mobile-first prototype. All children, staff, results, donor assignments and records are fictional. Six centres demonstrate behaviour; they are not a verified programme-wide dataset.

## Run and deploy

Serve `dist/` with any static HTTP server. No dependency installation, build step, framework or API key is required. Import this repository into Vercel with the supplied `vercel.json`; the output directory is `dist` and there is no build command. Do not deploy real student data in this browser-only prototype.

The source ZIP available in the app contains this portable static project. The app is not connected to Google Sheets, MASS records, an authenticated database or a Vercel project yet.

## Role previews and workflows

- Teacher: Aralimatti, both shifts. Enter/correct daily P/A/H attendance; manage child profiles; enter combined F1–F4 marks; record activity participation; follow up Morarji and guidance cohorts.
- Cluster officer: four sample centres assigned to Meera. Review centre attendance/learning/engagement and record visits. Corrections use the same records.
- Leadership: all six sample centres. Programme filters include donor and cluster officer. Donor summary is aggregate-only, without student names or editing.
- The role selector is a design preview, not authentication or a security boundary.

## State, records and calculations

`data.js` generates the sample dataset; `app.js` renders the views, handles forms and writes state to browser localStorage under `mass-cac-companion-v1`. Unique child ID links the records. Attendance has one value per child/date; participation one value per child/event; combined test one score per child/exam round. Re-entering updates the existing record, rather than duplicating it. All changes stay in the same browser and can be reset through About this prototype.

- Attendance entry: P present, A absent, H holiday. Blank stays unknown and is never treated as absent. H = holiday is a design interpretation to confirm. The prototype shows counts rather than an unsupported attendance percentage.
- Sample operating calendar: first 24 non-Sundays in September/October 2026; attendance expectations stop at 20 October. The actual centre calendar, exceptional closures and per-child holiday rules must replace this before production.
- Attendance bands: <15 low; 15 average; 16–20 good; 21–25 very good. For October these are month-to-date counts, not projections.
- Good engagement requires >20 P days AND >2 attended activities. Exam scores are independent. Incomplete attendance/activity records show Incomplete rather than a definitive engagement label. “Below two activities” is a provisional low-participation flag, not a confirmed business rule.
- Cultural events: first and third Saturdays. Sports: second and fourth Saturdays. Planned and cancelled events do not count as held participation opportunities. Participation is Attended / Not attended / Unknown. Four sample events per centre per month.
- One combined exam per F1–F4 round. Sample integer scale 0–25; actual maximum is unconfirmed. <8 low, 9–15 average, 16–20 good, 21–25 excellent. Score 8 is explicitly unclassified. Unrecorded marks are null, not zero. Round averages exclude nulls. F1→F2 mean change uses only children with both scores; sample tests are treated as comparable for illustration. Real comparability must be confirmed.
- CAC sessions are a distinct centre/date/shift record. Planned total includes subsequent held/cancelled sessions. Marking children present does not automatically declare a session held.
- Visits: 4/centre/month, 2 morning + 2 evening. Completion totals and shift coverage are separate. Targets are based on centres selected, not a flat officer target.
- Morarji: historical 2025–26 Grade-5 preparation cohort, currently Grade 6. Application, exam attendance, pass, selection, admission and scholarship receipt are distinct stages. Pass counts do not imply scholarship receipt. Weekend training August–February.
- Career guidance: January 2026 sample Grades 10–12 cohort, with later contact/destination/evidence. It is independent of the CAC month filter. Teacher feedback is qualitative and is not a confidence score.
- School report comparison is explicitly unavailable; no school improvement or causal CAC impact is fabricated.

## Production integration requirements

Replace browser localStorage with authenticated server APIs and a database. Suggested entities: users, dated centre assignments, centres, children, dated enrolments/shift assignments, operating calendar, sessions, daily attendance, activity events, participation, exam rounds and scores, officer visits, programme cohorts and follow-ups. Use server-side role and centre authorization on every read/write. A role dropdown is not authorization.

Use upserts with unique keys for child/date attendance, child/event participation and child/exam results. Resolve concurrent changes using version checks; preserve who changed what, when, and the previous value in an audit log. Confirm whether corrections need a reason or approval. Define offline behaviour and conflict resolution before promising offline sync.

Donor summaries should query the same records through a dated donor–centre funding mapping, not a second copy of student data. Confirm overlapping donors, funding periods, attribution, aggregate disclosure limits and which metrics external donors may see. Keep student details out of donor responses. No external donor account exists in this prototype.

PM review: real calendar and H meaning; score scale and score-8 band; grade-10 coaching placement; current vs historical enrolment; historical teacher/officer assignments; low activity threshold; school-report fields and comparability; actual donor mapping/access; enrolment exits/transfers; correction permissions and audit policy; cohort/event eligibility; whether additional important-day events should be counted separately from the four Saturday activities.

## Scope

Core: role-specific navigation, attendance, roster, sessions, combined assessments, four-activity participation, integrated student summary, follow-ups, officer visits and leadership donor filtering. Included programme previews: Morarji and guidance. Deferred: PTM workflow/awards, external donor login, school-report import/comparison, production authentication, live database, audit history and offline sync. Do not interpret deferred items as agreed exclusions from the final project.

## Branding

MASS logo supplied through https://share.google/ZbkEySvfDIMOt65d3, resolving to https://svpindia.org/wp-content/uploads/2023/04/Mass.jpg. The original JPEG is bundled locally, not remotely hotlinked. Header and sidebar show the logo without altering its image. Teal/yellow brand colours are independent of semantic green (good), red (low) and orange (average).

## Morarji cohort comparison

Morarji detail uses a cohort-year filter and centre scope, without a donor filter. The bar chart compares recorded passing-child counts across distinct 2024–25 and 2025–26 fictional cohorts. Cohort size, exam taking and pending counts provide context. Historical sample records are separate children, and existing browser edits are preserved when the history sample is added. Programme and donor overviews show an aggregate Morarji scorecard with its own explicit cohort year; the donor scorecard has no child detail or programme link. Counts are not affected by the CAC month/grade/shift filters. Donor centre scope applies only on overviews, using the prototype’s static sample mappings; dated real mappings remain to be confirmed. The internal preview role is named Cluster Officer.

## Field-photo entry improvements

The student progress report photo informed exam-date, maximum-marks, marks-obtained, result-status and teacher-performance-note fields. Main challenge is optional in the shared student profile. Signatures are not converted into approvals; review/sign-off rules remain open. Records cover the prototype’s single 2026–27 assessment year. Original numeric score values are preserved, and new metadata uses child ID + exam round. Raw-score averages require a common maximum; 25-mark bands are not assigned to other scales. Equal maxima alone do not establish comparable tests.

Children is the main roster route for Teacher, Cluster Officer and Leadership. Attendance, assessments and activities offer Add student shortcuts to the same form. Possible matches on name/centre/grade prompt a review; names are never merged automatically. An explicit different-student confirmation allows legitimate namesakes. New IDs are linked across all records; no attendance or marks are prefilled for a new child. Real cross-device IDs must be generated server-side.

The annual field-photo calendar is a planned May 2026–April 2027 reference, not evidence of held events. Cultural/sports events and important days have separate categories. Add activity captures name, centre, applicable shifts, date and planned/held/cancelled status. No child participation is inferred from a plan. Important-day participation is included in total participation but excluded from green-engagement cultural/sports counts pending confirmation. Other annual-plan items stay reference-only; PTM remains deferred.

## Class 10 board result
The shared student profile has a Yes/No `boardPassed` field, displayed only for Grade 10. Blank/unset means Not entered, never No. Children → Grade 10 shows the result in the existing student summary; the child detail also displays it. This is manually recorded board-exam status, separate from F1–F4 CAC marks and engagement. No result is inferred or prefilled.

## 22 October front-end review
- Overview alone contains the combined student-performance summary. Student Profile owns roster entry and edits; Attendance and Learning use focused tables. Teachers also have an Overview.
- Learning has all four rounds and a per-student Edit marks table, with atomic validation, dates, missing/absent statuses, fixed recorded maxima and teacher notes. Matched-round change excludes missing values and mismatched maxima; mixed-scale mean change is withheld. Equal maxima do not establish comparable papers.
- Participation is at least two cultural/sports activities; green engagement also requires more than 20 present days and complete records. Strong participation lists all-four records, with provisional selection explained; this is not an award ranking.
- Monthly attendance chart: P entries / eligible student-days in explicitly Held sessions, excluding holidays and pre-enrolment dates. Missing entries are visible and retained in the denominator. PM must confirm the rule.
- Donor reporting remains aggregate Overview only, with Print report. No donor login or new permissions.
- Added Morarji cohort entry from existing profiles and career-guidance participant entry. Newly created Morarji outcomes remain unknown, not false. Cluster Officer visit entry and feedback remain within assigned sample centres.
- Weekly subject data, school-report comparisons, final top-performer criteria, paper scales/score-8 interpretation and real access permissions are not inferred.
- Sticky header/filter context and mobile layout preserve MASS branding. All data remains fictional and browser-local.

## Confirmed CAC dropout rule — 22 October 2026
Zero attendance for a full completed calendar month, with held sessions and complete P/A/H attendance records. Months still in progress, mid-month enrolments, unresolved session statuses, missing attendance and no eligible held sessions stay Not classified. H is excluded as holiday. Classification is recalculated on corrections; it never changes the roster or asserts school dropout. Overview displays count and assessed/unclassified coverage; Attendance and student details display status/reason. No dropout rate is computed until its denominator is agreed.

## Chart references
Charts have fixed global references Chart 1–21, stored in chartNumbers by page and heading. References remain stable across roles, filters, empty data states and navigation; printed donor charts retain their references.
