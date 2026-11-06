# Chart-by-chart reconciliation — 3 November 2026

Calculation workbook SHA-256: `c042a0d1f707d699cb94115e0fa7e82b4fc4e67cc988444b91c901078bf7cc99`. Read all four tabs: Start Here, 24 Chart Calculations, 29 Rule Review Questions, Visit Targets. Original 24 chart numbering skips17. Raw11Approved/4Approved with Changes/6Pending/3Needs Source statuses are preserved in the CSV; comments and the user clarification determine effective implementation.

Comments are authoritative business-rule evidence. Pending with usable comments is approved. Existing documented logic is retained for chart 16; only specific missing evidence is held. Historical documentation is preserved, and the earlier integration queue now points to these decisions.

| Chart | Effective decision | Calculation and consequence | Evidence |
|---|---|---|---|
| 1: Attendance across centres | Approved | P/(P+A+L)×100 per centre; L=Leave; WO/MM/confirmed non-scheduled days excluded; unrecorded unknown. | Live read-only SQL + synthetic SQL; workbook row2 |
| 2: Participation across centres | Approved with changes | Distinct participating child UUIDs once per selected month / distinct eligible children; observed Held events only. | Synthetic SQL; live event source empty; workbook row 3 |
| 3: Attendance bands | Approved | Retain original <15 / 15 / 16–20 / 21–25 present-day bands. Only explicit complete calendar+mark coverage qualifies; >25 held outside bands. | Synthetic SQL; live calendar completeness unavailable; workbook row 4 |
| 4: Attendance by centre | Approved with changes | Same attendance formula as chart 1, grouped by centre. | Live read-only SQL + synthetic SQL; workbook row5 |
| 5: CAC sessions delivered | Approved | Separate observed Held, Planned, Cancelled counts; never infer Held from scheduled days. | Synthetic SQL; delivery API/schema not hosted; workbook row6 |
| 6: Current exam performance | Approved with changes | Selected configured 25-mark quarter; available scores; integer0–8/9–15/16–20/21–25 bins; zero retained, missing excluded; fractional scores explicitly unbanded. | Live read-only SQL + synthetic SQL; workbook row7 |
| 7: Average by centre | Approved with changes | Mean available score for selected quarter per centre, one decimal display; missing excluded, zero retained. | Live read-only SQL + synthetic SQL; workbook row8 |
| 8: Progress across exam rounds | Approved | Descriptive mean and valid n for each configured quarter in selected verified academic year. | Live read-only SQL + synthetic SQL; workbook row9 |
| 9: Change between exam rounds | Approved | Same child UUID in both selected configured exams within one year; scoped historical enrolment facts; mean mark difference plus improved/unchanged/declined. No unmatched means, percentage ratio or causal inference. | Live read-only SQL + synthetic SQL; workbook row10 |
| 10: School performance | Needs Source Data | School-report source, scale and matched baseline not supplied. Precise source-dependent state. | Unavailable; not a numeric pass; workbook row11 |
| 11: Participation distribution | Approved | Each child once within each source-backed category; child may appear in multiple categories; categories are not exclusive shares. Null category Uncategorised. | Synthetic SQL; live source empty; workbook row12 |
| 12: Participation by centre | Approved | Same monthly distinct-child numerator/denominator as chart 2, per centre. | Synthetic SQL; live source empty; workbook row13 |
| 13: Visits by officer | Approved | Completed visits by verified officer/month/centre/shift. Planned, undated observations and excluded example rows are not completed visits. | Existing local visit/RLS tests; hosted API absent; workbook row14 |
| 14: Centre coverage | Approved through comments | Standard >=2 Morning AND >=2 Evening visits. Show actual counts and standard separately. Single-shift applicability is a specific source gap; do not assume all 92 centres applicable or invent reduced targets. | Existing local visit tests; applicability not verified; workbook row15 |
| 15: Children passing year on year | Approved through comments | Count distinct passed children per verified cohort academic year, Grade 5 at linked historical enrolment; optional pass rate omitted. Unknown outcomes are not failures. | Synthetic SQL; live cohort/outcome source empty; workbook row16 |
| 16: Compare cohort sizes | Confirmed existing logic | Distinct verified Grade 5 cohort members using existing confirmed cohort-count contract. Pending without comments is not a reason to discard documented logic; missing identity/year linkage remains source-dependent. | Synthetic SQL; live cohort source empty; workbook row17 |
| 18: After the exam | Needs Source Data; confirmed flags implemented | Separate applied/attended/passed flags. Missing flags unavailable; later selection/admission/scholarship require source and are not inferred. | Synthetic SQL; live source empty; workbook row18 |
| 19: Subject/course chosen | Needs Source Data | Verified course/guidance catalogue, choices and source/privacy rules absent. No fabricated options or values. | Unavailable; not a numeric pass; workbook row19 |
| 20: Attendance across funded centres | Approved through comments | Chart1 attendance under selected donor current centre association. No inferred historical funding interval. | Live read-only donor SQL + synthetic SQL; workbook row20 |
| 21: Activity participation | Approved through comments | Chart2 monthly distinct-child activity calculation under selected donor current centres. | Synthetic SQL; live source empty; workbook row21 |
| 22: Students by grade | Approved through comments | Each active child UUID once by grade at snapshot. Conflicting active grades held/unclassified; no invented precedence. | Live read-only SQL + synthetic duplicate/conflict cases; workbook row22 |
| 23: Students by gender | Approved | Recorded gender and explicit Unknown; distinct child UUID. Masked private profiles are not unknown gender; protected aggregate needed when profiles are unreadable. | Live read-only SQL + scoped synthetic aggregate; workbook row23 |
| 24: Students enrolled by centre | Approved | Eligible dated snapshot enrolments per centre; preserve enrolment grain separately from charts 22/23 child grain. | Live read-only SQL + synthetic SQL; workbook row24 |
| 25: Engagement across centres | Approved counts; specific colour gap | Display recorded attendance and distinct activity counts. Remaining good/review/low colour boundaries unresolved; no invented traffic-light classification. | Live attendance SQL + synthetic activity SQL; workbook row25 |

## Verification boundaries

880/880 live read-only SQL comparisons passed against the hosted001–019 schema using a non-personal private fact snapshot and independent SQL. Covered April and October2026; all 92 centres;8 donor and11 officer scopes; combined grade1/5/6/10/all, Morning/Evening/all, Girl/Boy/Unknown/all; both selected1→2/2→1pairs in all-programme cases. Not every Cartesian combination of every centre and filter was run against production. SQL test cases include each centre unfiltered, all-programme full combinations, and donor/officer shift/gender combinations. No case claims a staff-session/Preview pass.

1,440/1,440 local SQL-to-frontend comparisons passed on isolated PG17 with synthetic records, including historical episode transfer, repeated activity events, category deduplication, Unknown gender, quarter pairing and explicit31-day calendar. Positive verified-year Grade 5 Morarji fixtures are included. Independent JavaScript math and authenticated SQL are compared, not a SQL value compared to itself.

Hosted source contains no observed activity/cohort/outcome records and no020–023delivery/visit APIs. These charts have tested formulas but remain source/API dependent in the hosted frontend. Calendar gaps prevent complete-month attendance band claims. School performance and guidance lack source definitions. No source-dependent chart is credited as a live numeric pass.

## L ambiguity

The workbook uncertainty cell labels L as late. Its approved formula/comments do not explicitly authorize changing the code meaning. Existing confirmed MASS Phase2E and hosted status definition are L=Leave, so both SQL and UI retain Leave and the existing denominator. No historical attendance recoded; no partial/late weighting invented.

## Grain and filters

Snapshot is month-end for completed months, today for current month, or selected day for the daily page, with exclusive enrolment end. Grade/gender charts deduplicate child UUIDs; chart 24retains enrolment grain. Attendance counts enrolment/date observations in the same selected roster. Activity numerator is distinct observed participants; denominator distinct eligible snapshot children. Paired assessments join child UUID across scoped historical episodes in one configured year; per-quarter means preserve the active-episode population. Source dates and missing shifts are never inferred. Delivery/visits have centre/shift/month grain; grade/gender do not describe session records. Morarji uses linked historical Grade 5 enrolment and verified cohort year; year is not guessed from cohort label. Donor filters use current associations only.

## Exact backend dependency

The frontend safely detects capability reviewed_charts24. New proposal supabase/proposals/202611030024_reviewed_chart_metrics.sql adds one bounded authenticated aggregate RPC after020–023. It returns counts/means only, validates every requested centre, requires a staff session, has fixed owner/search_path and no anonymous/service-role EXECUTE grant. Existing private schemas/policies are not exposed or weakened. This is a proposal, not a production migration or applied change. Without it, approved calculations run from authorized complete detail APIs where profile access permits; masked profiles are never interpreted as Unknown. Quarter-inclusive reads still require020; detailed delivery/activity requires 022; masked learning reads require 023.
