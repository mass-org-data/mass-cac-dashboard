# MASS review fixes — 11 November 2026

## Frontend changes

- Page-number entry no longer reaches the global filter handler and rebuilds the table. Enter explicitly applies the page number.
- New attendance registers hide the correction-reason field. A backend count of "0" is treated as zero. Saved-record correction and deletion retain their required reason and audit path.
- The collapsed sidebar no longer changes the header logo's image dimensions.
- Title case now uses actual word boundaries and applies to scorecard labels as well as headings. Existing chart references are retained.
- The live learning explanation describes the existing paired change in marks, rather than an unrelated percentage-growth formula.
- Average exam score requires a grade selection. Other learning counts remain available across grades. No backend calculation is changed.
- An empty Morarji cohort no longer shows an unrelated default 2025–26 label beside the selected academic year.
- Remove internal workbook/comment wording from the affected empty states and scorecard explanations.
- New classroom marks are A, P and H. Historical MM, L and WO remain readable and can be cleared through the existing audited correction workflow. MM is no longer offered as a new classroom mark.

## Confirmed programme rules

Yallappa's clarification, supplied by Aashini:

- One monthly meeting per centre per month, shared by both shifts.
- Four activities per centre per month, shared by both shifts.
- Keep individual participation for children from both shifts.
- MM/activity participation does not add classroom present days or contribute to the more-than-20 attendance-days rule.
- A plan does not establish that an event happened. Missing participation is unknown, not absence.

## Backend work still required

Do not mark these complete based on frontend controls.

1. Install and verify the existing reviewed attendance metadata migration from PR16. This enables Notes, Holiday saves and attribution. Imported records may still have no known original actor; do not invent one.
2. Verify approved registration and activity activation with the backend owner. Do not bypass existing gates or enable them merely to make a button work.
3. Add a centre-wide event model/API for MM and activities. The current activity event/participation foreign keys bind an event to one shift. A form-only Both shifts option is unsafe. The backend must accept one centre event with eligible morning/evening participants, prevent duplicate events, retain revisions and enforce centre permissions. Retain historical shift-specific source records; do not automatically merge similarly dated records.
4. Add MM entry and reporting against the centre-wide model, with one monthly planned meeting per centre. Record actual dates and participation separately from classroom marks.
5. Verify visit reads and scoped officer identity. The live preview reported the visit API/identity unavailable; this review has not established whether the underlying cause is assignment, activation or API availability. Test save/reload with an approved test record after resolving that cause.
6. Import verified named activity events, participation and Morarji cohorts/results when supplied. Do not substitute fabricated data for empty charts.

## Other decisions and checks

- Morarji academic year/cohort and reporting cadence still need agreement; do not relabel missing data as a confirmed cohort.
- Multiple assessments/retests in one round still need a decision; current uniqueness rules remain unchanged.
- Keep Leadership read-only and role/centre scope enforced.
- Recheck save/reopen/edit/clear/delete, attribution, export downloads and phone layout on the connected preview after backend readiness. Earlier live inspection did not create or delete programme data.

## Validation

- Lint and build pass.
- 118 frontend tests and 27 workflow checks pass.
- Updated browser regression checks cover page-number Enter and the new-register reason/MM behaviour, but the local browser could not launch because this executor denies Chromium's process socket. These browser assertions are not claimed as passed.
- No hosted schema, programme data, permissions, feature activation or Production deployment was changed.
