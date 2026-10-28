# Phase 2E — verified frontend controls and compatibility

27 October 2026. Targeted static inspection only of unchanged `src/app.js`; no workbook audit or frontend modification. Values below are source-code observations; the user explicitly requested preserving verified existing registration controls. Other prototype values are evidence, not automatically approved policy.

| Control / field | Exact values or behavior | Evidence |
| --- | --- | --- |
| Student / ID | Name text plus generated display ID; current prototype CAC- numeric max+1 is not a safe server allocator or approved ID format | editChild line 92; profileTable line 59 |
| Centre | scope().map centre IDs/names; dynamic existing centre catalogue, not an enum or authorized staff roster | editChild line 92; scope line 14 |
| Grade | Strings 1,2,3,4,5,6,7,8,9,10 | editChild line 92 |
| Gender | Girl; Boy | editChild line 92 |
| Shift | Morning; Evening | editChild line 92 |
| Enrolled | Required date, no future date; not a Yes/No dropdown | editChild line 92 |
| Enrolment status | Active; CAC dropout; Left programme | editChild line 92 |
| Exit date | Required for non-Active; enrolment <= exit <= prototype today; Active must clear exit | editChild line 92 |
| Class 10 board result | Empty value (“Select result”), Yes, No; shown/enabled only for grade 10; blank is unknown | editChild line 92 |
| Possible match | Normalized name+centre+grade candidate; blocks new save unless checked as different; no automatic merge | editChild line 92 |
| Name | Trimmed, required; no identity uniqueness implied | editChild line 92 |
| Attendance buttons | P,A,H only; blank unmarked; H is displayed Holiday | daily line 49 |
| Percentage | P divided by eligible held-session student-days; H excluded, unmarked eligible dates still enter denominator | attendanceRate line 56 |
| Assessment round | F1,F2,F3,F4; comparisons F1→F2, F2→F3, F3→F4, F1→F4 | filters line 24; learning line 50 |
| Assessment entry status | Recorded; Absent; Not entered. Recorded requires whole score 0..configured max and date <= prototype today; non-Recorded must clear score | editLearningRow line 63; enterMarks line 95 |
| Role scope | Browser role selector and hardcoded sample teacher/CO scope, not authentication or verified assignments | state line 5; scope line 14 |

Registration controls can retain these options. Do not create new gender/shift/status/grade values or map historical source anomalies to them silently. Grade-10-only form visibility is not permission to erase an earlier recorded board result during grade changes. Exit date and proposed exclusive interval end must be reconciled, not mapped blindly. Prototype TODAY is fixed demo time; a later live implementation needs an approved business-time/date contract. No change now.

Existing attendance requires future focused semantic/entry changes to support L/WO/MM and authoritative holidays; its held-session denominator must change. Existing layouts/charts can remain, but a claim of fully unchanged behavior would be incorrect. Registration must use server identity allocation and history-aware edits. Learning must bind real academic year/approved quarter aliases and current max25 instead of demo-year fields; historical conflicts cannot be accepted by default. Existing named activity entry fits the requirement without inferred historical events. Morarji must avoid unsupported outcome writes. All write paths must enforce real server scope, including Leadership denial, rather than trusting visible buttons.

All **23 original interactions** remain in FRONTEND-DATABASE-MAPPING.csv, with two Phase 2E columns added while preserving the original 14 columns as historical evidence. Read the current columns with PHASE-2E-RULE-RECONCILIATION.md; prior 2A/2C mappings are untouched snapshots. No framework or broad UI redesign is proposed. Synthetic direct RLS/API and browser integration testing belong to a later authorized phase, not this static review.
