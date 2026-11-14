# Phase 5 (Assessments): result

Date: 14 November 2026. Preview project (synthetic data), real Chromium, `dist/` served with the production CSP: `node scripts/perf/attendance-live.mjs` (65 of 65 checks with `--assessment`, all screens built so far).

## What was built (`web/src/pages/Assessments.tsx`, `web/src/assessments/`)
- **Filters:** exam round F1-F4, compare pair (F1→F2, F2→F3, F3→F4, F1→F4), centre, shift, grade, gender.
- **Scorecards 4.1-4.4** from the same reviewed report as the Overview (`reviewed_chart_metrics`): students with scores recorded / all selected students, average score (out of 25), students without a score (missing is not zero), average improvement = (later average - earlier average) / earlier average x 100 for matched students (unknown when there are no matched students or the earlier average is zero).
- **Charts and tables:** 4.5 score bands 0-8, 9-15, 16-20, 21-25 with the count of fractional marks left unbanded; 4.6 average by round; 4.7 average score by centre (shared DataTable); 4.8 matched comparison (improved, unchanged, declined, average change); 4.9 saved assessment register (`assessment_register_summary`: centre, shift, date or Unknown, round, students, average, created by, last edited by and at).
- **Enter marks (Teacher, Cluster Officer):** step 1 centre and observed date (not in the future) show the derived round F1-F4 from the April-March year; step 2 lists the students enrolled that day with a 0-25 box each (blank = unchanged, never zero), a name/ID finder, existing saved results shown read-only, one atomic `record_assessment_batch` (at most 500 scores). Saving follows the server's `assessment_entry` gate.
- **Left to the standard application:** correcting a saved score (`assessment_corrections` is hard-off in the database), the per-student scores table and the school-performance placeholder.

## Checks
- 123 web tests (20 new: round mapping, start and score rules, service calls, page states, entry dialog, axe), lint, syntax check, 138 frontend tests, both builds, `npm audit --audit-level=high` pass.
- Real browser, Leadership, Teacher (Centre 01) and Cluster Officer (Centres 01-09): scorecards fill (Leadership 1,274 / 1,472 for F2, Teacher 13 / 19, Cluster Officer 123 / 152), the register lists saved assessments, entry opens and lists the centre's students (6 of 19 had no result for that round, the rest are shown read-only), Save is disabled while the gate is off, no axe violations including contrast, no horizontal scroll at 375 px, no failed calls, no console errors.

## Not covered
- Numbers side by side with the current Learning page (they come from the same report that matched the current Overview in `PHASE-5-OVERVIEW-RESULT.md`).
- Concurrent edits, real phones, the per-student scores table.

## Live save test (preview, `--assessment`)
The owner approved enabling `assessment_entry` on preview on 14 November (rollback: set `enabled=false`, `approval_reference=NULL`; `assessment_corrections` stays hard-off). As Teacher (Centre 01), Enter marks for round F3 refused a mark of 26, then saved 19 and 22 for two students in one batch. The dialog closed, the F3 scorecard count rose from 13 to 15, the register gained an F3 row, and reopening showed the two results read-only. Saved results cannot be corrected or deleted through the application, so each `--assessment` run leaves two synthetic scores; the check is opt-in for that reason.
