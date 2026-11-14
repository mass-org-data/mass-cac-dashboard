# Phase 5 (Annual donor summary): result

Date: 14 November 2026. Preview project (synthetic data), real Chromium, `dist/` served with the production CSP: `node scripts/perf/attendance-live.mjs` (105 of 105 checks, all screens built so far).

## What was built (`web/src/pages/AnnualDonor.tsx`)
- **Leadership only** (others see a note and no report is requested), a separate route as the requirements say.
- **Filters:** academic year (April-March) and donor (current directory associations).
- **Cover:** donor, the year with its exclusive end date, number of authorized centres.
- **Scorecards 7.1-7.4:** centres in the selection, students enrolled at the reporting date, annual recorded attendance, loaded months.
- **7.5** monthly attendance line (missing months are gaps, not zeroes); **7.6** centre comparison in the shared table (donor, students, annual present, absent, leave, annual attendance %, loaded months; sortable, ten per page).
- **Export:** the shared CSV of the table, with a plain-language explanation under it: one row per centre, what each column is, unknown is never zero.
- **Annual attendance adds P, A and L over the loaded months before dividing**; it never averages monthly percentages (rule from the requirements). One reviewed report per elapsed month runs two at a time, the same data the current page uses; a month that fails is a gap, is named in an alert with Retry, and is left out of the annual figure.

## Checks
- 165 web tests (9 new: P+A+L summing, months requested, cover, failed month, all months failing, donor filter, export note, Leadership only, axe), lint, syntax check, 138 frontend tests, both builds, `npm audit --audit-level=high` pass.
- Real browser, Leadership (92 centres): the annual attendance on the page is 86.0 percent, equal to the P/(P+A+L) total counted directly in the database (148,354 / 172,470); ten centres per page; the CSV has a header and 92 centre rows; no axe violations incl. contrast; no horizontal scroll at 375 px; no failed calls or console errors. A Teacher gets the Leadership-only note.

## Timing and limits
- The page took 13.9 s to finish on preview (about eight monthly reports at two a time, about 1.7 s each). It is not on the Overview's critical path. A single batched annual call, like the monthly series, would cut this; it needs a reviewed migration, so it is left as an option.
- "Loaded months" counts months whose report loaded, including months with no attendance yet (April to June on preview), as the current page does.
- Not covered: numbers side by side with the current page, printing, real phones. The current page's Print report button was not rebuilt.
