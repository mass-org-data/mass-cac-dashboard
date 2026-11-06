# Dependent population filters — 4 November 2026

Hierarchy: authorized directory → Donor/Officer → Centre → Shift → Grade. Grade options use eligible dated enrolments in the selected shift. Shift options ignore the old grade so a user can switch shifts and safely clear that grade. A still-valid grade is retained. No default grade or shift is fabricated. Missing values remain missing; no dummy association is introduced.

`filterCentres`, `filterOptions`, `reconcilePopulationFilters` and `resetPopulationFilters` in src/live/population.js are shared by the existing original interface. Rendering reconciles invalid state before requesting or displaying chart/KPI aggregates. This covers dropdowns, centre/gender chart shortcuts, daily shift buttons, history navigation, refreshed records and year reloads. Existing selectors/classes/styles remain in place.

Centre choices come from the authorized directory, including a real centre with no students at the selected snapshot. This preserves Donor → Centre discovery; an empty roster does not mean the centre does not exist. Student Shift/Grade options require actual eligible enrolment associations. Officer choices are not accidentally restricted to the currently selected officer. Changing an upstream donor clears an incompatible centre/officer and then reconciles shift/grade. Clearing filters never broadens the server-granted centre scope.

Snapshots use the same programmePopulation function as tables, counts and exports: selected day on Daily Attendance; month-end for a completed month; today for the current month. Starts are inclusive and ends exclusive. Academic-year changes wait for the correct authorized dataset before reconciling. Reset retains the selected configured year, choosing its start month when today's date is outside it; it does not show current-year dates against a historical dataset. No source date is invented or changed.

Recorded gender is an applicable facet. Users with profile access derive it from authorized profiles; masked profiles never become Unknown. For masked users, gender-dependent Grade/Shift options come from scoped reviewed aggregates (proposal 024) or the compatible023 aggregate for known supported genders. Pending proofs retain only the current choice; no option association is asserted from a masked NULL. Unknown-gender aggregate filtering requires024; the023 endpoint is not called with an unsupported sentinel. Absence of an approved endpoint remains an activation dependency, not a permission bypass.

Text search filters the displayed/aggregated rows using the existing contract; it does not redefine the reference dropdown choices. Query text is not sent to a new unrestricted reporting endpoint. Centres and selected filters are included in the reviewed calculation cache key; refreshed data invalidates the cache. Async responses from an old dataset/session cannot overwrite current calculations. Session cleanup removes the new facet adapter as well as programme data.

Counts explicitly retain their grain: grade/gender/student KPIs deduplicate child UUIDs; centre enrolment chart and student tables/CSV retain enrolment episodes. Multiple legitimate episodes do not become multiple people in distinct-child metrics. Conflicting active grade assignments remain unclassified. Monthly activity counts deduplicate child UUIDs; assessment pairs use UUID/history linkage. No new name matching, business option, calendar or permission was introduced.

## Regression evidence

- Twelve focused unit tests cover all ten requested scenarios plus privacy-aware facets and any-order/source-refresh behavior.
- Eighteen protected local-browser checks cover the actual dropdowns, source ZIP, CSV population, KPI/SQL agreement, year reset, chart shortcuts, grouped cohorts and mobile drawer. Synthetic local Auth/PostgREST only.
- 5,376 independent live read-only SQL facet cases cover112 scopes: all 92 centres,8 donors,11 officers and all programme; April 2023/April 2026/October 2026/November 2026; All/Morning/Evening × All/Girl/Boy/Unknown. Cases include current-day and historical exclusive-end boundaries. Not a hosted staff-session test.
- Existing 880 live calculation and 1,440 isolated SQL/frontend cases rerun successfully. Approved45cd4d3 formulas are unchanged.

Visit Shift filters are deliberately separate from student Shift→Grade facets: Morning/Evening are the approved visit-record enums. An expired/empty student roster must not suppress authorized visit history in that shift. This does not assert that a centre operates both shifts or authorize a visit; the unchanged officer-assignment API enforces actual recording scope, and target applicability remains a source gap. Hidden student Grade/Gender selections are cleared on the visit page.
