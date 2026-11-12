# Feedback implementation — 12 November 2026

Continues PR #16 on `fix/frontend-acceptance`. No merge or production release.

Sources: [MASS IDS changes](https://docs.google.com/document/d/1D3E_PPhfBRlFsLuNXccnn45bp4MkAY0M/edit) and [feedback reference](https://mass-feedback-review.goalkeep-8256.chatgpt.site/). The reference was inspected from its public HTML, styles and app modules and rendered locally with its fictional sample data. Only its presentation is used; no fictional outcomes or obsolete calculations are imported.

| Request | Change |
| --- | --- |
| 1. Bigger scorecard numbers | 36px desktop and 32px phone values; original compact labels/body text retained. |
| 2. Girls/Boys charts | Only Girls and Boys displayed. Unknown source values and reporting populations are unchanged. |
| 3. Attendance performance | Attendance reporting uses aggregate APIs and register summaries. Opening it does not download individual annual attendance, activity or profile facts. Shared calculation cache keys no longer depend on page/date when RPC inputs are identical. |
| 4. Option colours | A red, P green, H grey, MM purple; visible letters and selected state remain. Actual computed colours tested. |
| 5. Attendance Save | Existing atomic explicit Save, retry/conflict protection, persisted corrections/clears, audited deletion and post-save refresh verified. Pending Holiday support remains necessary on the hosted backend. |
| 6. Fuller Overview | Existing counts plus good-engagement, low-attendance and above-20 cards for all roles. No dropout card. Current approved calculations remain authoritative; incomplete source coverage shows unavailable rather than fabricated zero. |
| 7. Logo | Expanded and collapsed header use the same image geometry. Only whitespace around the source logo is cropped; artwork proportions are preserved. |
| 8. Teacher centre | A single assigned centre is a fixed label in common filters and centre-entry forms. Shift and other filters remain available. Multiple assigned centres retain a dropdown. |
| 9. Attendance order | Filters, scorecards, charts, then saved register. |
| 10. Learning order | Filters, existing scorecards, notes/round comparison, charts, register and student comparison. |
| 11. Heading case | Shared page headings and section headings use title case. |
| 12. Student summary | Teacher/CO Overview loads the current month's attendance and activities, plus academic-year exam results, in a background scoped request; attendance/activity/exam/engagement stay separate. Search, sortable headers and paging are retained. Leadership stays aggregate-only. |
| 13. All tables sortable | Reversible column-header sorting before local pagination, dates newest-first and names A–Z by default. Missing dates remain last. Profiles use a whole-population server sort and reverse-page wrapper with explicit labelled sort controls, not page-only sorting. Entry rosters remain unpaginated and retain entered inputs. |
| Register follow-up | Attendance includes last editor and timestamp. Assessment register groups by centre/shift/date/round, includes score coverage, average, creator, last editor/time and scoped Edit controls. Leadership has a read-only register. |

## Backend boundary

Read-only hosted inspection confirmed register capability version 2, the register write control enabled, and no Holiday or metadata support. The old backend's save function accepts P/A/L/MM/WO, not H. A/P writes were verified in isolated browser/SQL tests; the hosted reported save failure was not reproduced by inserting programme data.

Migration `20261110120000_attendance_register_metadata.sql` remains pending. It supplies Holiday support, notes and attendance actor labels. New additive migration `20261112052348_feedback_register_reporting.sql` supplies assessment audit summaries, attendance edit timestamps and reversible profile paging. Both are included in GitHub and tested locally; neither is applied to hosted Supabase in this task.

The new migration does not change programme facts, user grants, activation flags, history or guard functions. Its only audit-table permission is SELECT of assessment audit identities for the private application owner, limited by an entity-specific RLS policy. No raw audit access is granted to browser roles. New APIs require a staff session, bounded parameters and authorized centre scope. Actor names use verified staff links; unlinked accounts have a stable pseudonymous staff label. Import identities remain explicitly unrecorded. Auth IDs are not returned.

Application refreshes reject stale role/load generations. Late background requests cannot replace the current role's records. Summary requests use the selected month's fact window and preserve full academic-year assessment boundaries.

## Verification

- 119 frontend tests and 27 workflow checks.
- 52 existing attendance, 80 metadata and 31 new feedback SQL assertions.
- New migration injected-failure rollback, data/grant/gate preservation, staff attribution, timestamps, foreign/anonymous/service-role denial and full-roster reverse paging.
- 22 staff-access assertions and activation/provider replay.
- 1,440 independent SQL/calculation cases and core/visit/security matrix.
- Browser checks cover explicit Save/no click-time writes, failed-save draft retention, clear/delete/reload, names/IDs, per-role Export, compact labels/prominent values, gender charts, fixed Teacher centre, zero additional raw attendance reads on Attendance navigation, page order, mobile layout and actual attendance colours.
- Lint, syntax and build; final browser total and exact connected Preview recorded in PR #16.

All tests use isolated synthetic records. Managed staff sign-in and live production save acceptance are separate; no hosted test records were created.
