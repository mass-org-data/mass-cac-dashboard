# Phase 3B — frontend integration readiness

27 October 2026. Existing frontend functionality is unchanged and still uses its original demo/localStorage implementation. No database or Auth client was attached. Local backend contracts are partially ready; the frontend is **not ready for production database integration**. Keep the 23-interaction Phase 2E mapping as preserved evidence; this table records implementation coverage without rewriting it.

| ID | Existing interaction | Local coverage / remaining contract |
| --- | --- | --- |
| 1 | Programme charts and student summary | Protected list_students and attendance_summary available; remaining charts/read projections, eligibility, coverage and approved reporting semantics pending |
| 2 | Create student profile | register_student creates UUID/display ID/profile/episode atomically; UI candidate review, date policy, ID display and explicit private-field rights must be reconciled |
| 3 | Edit existing student | Immutable identity and historical add/close_enrolment available; profile/board correction, transfers with limited receiving scope, exit-date conversion/reopening need reviewed API |
| 4 | Read cross-programme child record | Child/centre FKs and RLS in place; bounded combined history read API not yet implemented; private projections require explicit rights |
| 5 | Single attendance correction or clear | record_attendance supports revision-aware P/A/L/WO/MM changes; clear-to-unknown semantics/API not implemented; H/calendar authority pending |
| 6 | Bulk Present/Absent/Holiday | Single writes available; no approved atomic bulk/undo/membership contract or generic H action |
| 7 | Create/correct planned CAC session | Minimal explicit confirmation calendar is admin-managed; not the frontend Planned/Held/Cancelled delivery workflow |
| 8 | Create/replace follow-up note | Not activated; privacy/status/revision/retention contract pending |
| 9 | Correct four rounds for a student | record_assessment handles one verified quarter/definition with max25; F aliases, real year binding, precision/status/clear/date-correction contract pending |
| 10 | Batch results/group comment | No batch/comment API; grouping, atomicity, rights and note minimization need approval |
| 11 | Compare scores/school placeholder | Stored results are scoped and date/scale validated; approved comparisons/bands, comparable papers and bounded read projection pending |
| 12 | Create/edit activity details | create_activity handles named single-shift dated events; no category/status/both-shifts/scope-change contract or event-edit API |
| 13 | Individual/bulk participation | record_participation supports revision-aware true/false/unknown; bulk workflow and historical slot bridge remain pending |
| 14 | Record a visit | Visit module not activated; authentic dated source/future-entry contract still required |
| 15 | Add child to Morarji cohort | add_morarji_member available for a supplied verified cohort/enrolment; source cohort/date adjudication still separate |
| 16 | Correct cohort outcomes | record_morarji supports applied/attended/passed/school only; unsupported training/admission/selection/scholarship fields cannot be mapped |
| 17 | Add standalone guidance participant | Guidance module not activated |
| 18 | Guidance follow-up | Not activated; destination/status/privacy workflows unapproved |
| 19 | Teacher guidance feedback | Not activated; no generic private-note endpoint |
| 20 | Aggregate reports | One scoped attendance aggregate available; donor/funding/disclosure and other report endpoints not approved/implemented |
| 21 | Export student/donor summary | No export endpoint or export-specific entitlement; programme read does not authorize private export |
| 22 | Download source archive | Original frontend-only ZIP builder unchanged; private workbooks, SQL runtime material and credentials not included; SQL/tests delivered via Git |
| 23 | Reset local sample records | Original local demo reset unchanged; no backend reset/delete API exists |

Integration needs a later explicitly authorized adapter task: real Auth/session handling, server-scoped async reads, loading/error states and HTTP409 refresh/retry behavior; replace browser role selection as authority; bind actual year/quarter/scope; replace held-session attendance denominator with P/(P+A+L); support confirmed codes and unknowns; remove unapproved mock outcomes from live writes. Preserve layouts where possible, but do not claim semantic parity before these specific gaps are resolved.

Leadership's names are masked by the current conservative private-data boundary. Confirm actual private-field purposes/rights before real accounts are provisioned. Real centre/cluster assignments, historical read access, timezone/as-of/future-date validation, exact exit-date interval mapping, friendly-ID alias format, calendar/H policy, quarter aliases and score precision/statuses remain review matters. No source values, identities, dates or extra enum options should be invented to bridge the gaps.
