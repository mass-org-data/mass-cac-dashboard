# MASS data verification — October 2026

Branch: `audit/data-verification`, based on `staging`. Open `/audit/` on this branch's deployment. The dashboard at `/` and original application at `/vanilla/` are preserved. The ledger reads imported JSON locally in memory, with no database credentials or private audit results bundled into the site.

## What is implemented

- 86 indicator definitions spanning the current React Overview, Attendance, Profiles, Assessments, Visits, Morarji and Donor Summary, plus Activities/MM in the original interface. A chart/table definition expands into one case for each category/centre/register group, so cases are not counted as unique indicators.
- Independent, bounded, repeatable-read **read-only SQL** against the base tables. It never uses `mass_api` reporting functions as its oracle. No migrations, grants, feature activations or fact writes.
- Rendered-browser capture with explicit role/centre/filter checks, pagination, captured deployment SHA, and screenshots of aggregate cards/charts. Credentials are provided through local environment variables or Playwright storage state; none is logged or saved in results.
- Count equality, displayed-precision comparison, separate ratios/percentages, CSV formula-injection protection, explicit unknown/blocked/not-tested states, and a before/after reference-fingerprint requirement. A numerical agreement is not certified unless the source extraction is stable across the browser capture.
- The dark ledger follows the supplied reference: summary, result chips, search/page/result filters, calculation/source details, independent/database value versus dashboard value, differences, notes, evidence and exports. A collection `{runs:[...]}` can hold multiple role/month/filter scenarios; choose the scenario above the ledger.

## Cutoff and meaning

Initial reporting months: April–October 2026, academic year April 2026–March 2027. All time windows have an exclusive upper boundary; October ends **2026-11-01**. The October roster snapshot uses **2026-10-31**, not the current day. The data is read now from current records; this does not reconstruct a database backup as of October. Current gender/donor attributes are not historical change logs.

Assessment zero is retained. For an unknown assessment date, only a source quarter wholly ending before November qualifies; an undated October–December record is not presumed to be in October. Morarji stage records lack observation dates and remain cutoff-unverifiable. Attendance excludes confirmed non-scheduled sessions and H/MM/WO; historical L stays in the denominator. Unknown students or missing expected calendars are not assumed to have zero attendance.

The independent query follows verified enrolment dates for classroom facts; any disagreement with the reporting function's population policy must be investigated, never fixed by copying that function into the audit.

## Run

Keep real outputs **outside the repository** (the default `audit-runs/` is also ignored). A scenario is JSON containing:

```json
{"environment":"preview","project":"nilzfsahxoxibvrwsqkd","role":"Teacher","month":"2026-10","centres":[{"id":"10000000-0000-4000-8000-000000000001","label":"Synthetic centre"}],"shift":null,"grade":null,"gender":null,"donor":null,"round":2,"earlier":1,"later":2}
```

The example UUID is fictional: replace it with the verified scope. For a Cluster Officer's visits, include `officer` from the verified dated assignment. Student filters do not redefine centre-level event plans or donor association history.

```bash
npm run audit:reference -- --scenario /private/scenario.json --out /private/october-audit
```

Run the generated `reference.sql` through the connected Supabase SQL tool, saving its single `audit_reference` object as `/private/october-audit/reference.json`. Alternatively add `--execute` with an approved `MASS_AUDIT_ACCESS_TOKEN` supplied in the process environment. Add `--event-kind` only when schema inspection confirms `activity_events.event_kind` exists. The query is the same fixed read-only SQL either way.

```bash
npm run audit:capture -- --reference /private/october-audit/reference.json --base-url https://your-exact-deployment.vercel.app --out /private/october-audit
```

Provide `MASS_AUDIT_EMAIL` and `MASS_AUDIT_PASSWORD`, or `MASS_AUDIT_STORAGE_STATE` pointing to a private Playwright session file. Use the appropriate approved account/environment. Deployment protection is separate from programme sign-in; use an existing authenticated session for the exact deployment. The runner checks `release.json` project/commit before capture. All write RPCs are blocked in the audit browser.

Re-run the same `reference.sql` after browser capture and save its object as `reference-after.json`. Then:

```bash
npm run audit:reference -- --reference /private/october-audit/reference.json --reference-after /private/october-audit/reference-after.json --dashboard /private/october-audit/dashboard.json --out /private/october-audit
```

Load `run.json` in `/audit/`. Or generate an expected-only run by omitting `--dashboard`. That run deliberately has **no certified numeric matches**. Copy the PNG evidence alongside the private results. HTTPS evidence links open in the ledger; local filenames are shown for offline review. CSV export includes all filtered rows, independent of the displayed page.

## Current execution boundaries

The initial real-data extraction has been executed read-only for the all-centre Leadership October selection. Private values and centre lists are not committed or published in the preview bundle. The first authorized signed-in Leadership October capture is complete (see continuation results below); additional scenarios still require an authorized session.

The current Profiles, Assessments, Annual Donor and Morarji React pages have no October roster/end-month selector. Their current November values cannot be represented as October values; the capture runner records this limitation. Profile and write availability follows the existing backend. The audit does not install missing production functions or activate features. A definition review is also recorded for relative percentage improvement versus the earlier mark-change wording; display agreement alone does not approve programme logic.

Field-level identities, names, free-text feedback and audit actors are not quantitative indicators and are not exported by the independent SQL. Their completeness and permissions need a separate record-quality review. CSV exports of numeric dashboard tables are covered by the same filtered, sorted source calculations; actual browser CSV parity and full multi-role/scenario runs require the signed-in acceptance run.

## Verification

`npm run test:audit` checks comparator rules, cutoff, scenario mismatch, CSV injection, data-stability fingerprints and independently seeded PostgreSQL facts (holiday, true zero, missing data and undated quarter boundaries). `npm run test:audit:browser` checks the actual built ledger, source-file loading, filters, pagination, CSV export and phone overflow. `npm run web:typecheck`, `npm run test:web`, frontend workflows, lint/check and build remain required. Use `MASS_CHROMIUM_MODULE` or `MASS_CHROMIUM_EXECUTABLE` when the environment needs its packaged Chromium runtime.

## Continuation check — 17 November 2026

The first authorized production browser run is now captured for Leadership, all permitted centres, October. Before/after independent source fingerprints agree. The private run contains the actual rendered Overview cards, categories and all centre-table pages, October Visits availability, the Attendance page's installed-API error and the checked historical-control limitations. This is one scenario; other roles/months/filter combinations have not been run. The October baseline in the native verification sheet was subsequently updated through the owner-approved Kirti connection. See the 18 November section for the revised selected-centre seven-month run.

174 numeric comparisons match; none differ. Coverage is only 4.6%: 810 cases have no eligible source observation, 1,917 have no comparable dashboard display, 847 cannot certify the cutoff, seven lack a settled calculation and six do not apply to Leadership. These categories must not be described as successful checks. The current production Attendance page explicitly reports an older register API; this audit records the failure and does not install or activate functions.

The capture adapter supports current deployed markup without requiring the new audit attributes. It removes accessibility sort announcements from table headers, normalizes documented category aliases (Girls/Girl, Boys/Boy, Sept/Sep), and waits for actual pagination changes. Duplicate centre labels are disambiguated by UUID in independent reference dimensions; when the dashboard gives no identity for the repeated label, those rows are unavailable rather than arbitrarily paired. Duplicate source dimensions are rejected on import/run construction.

`release.json` identifies Production commit `441f8ecfec9d2a98fccc73372cfdfd42dad291dc` and reports a tracked `vercel.json` change; that deployment note is retained in the private capture. No private case values or browser session material are in Git. The private JSON can be loaded into `/audit/` to view this execution; a new visitor sees the indicator inventory until importing a run.

Continuation validation: 13 audit tests (including seeded SQL and duplicate-label regression), 13 built-ledger/browser adapter checks, lint and syntax checks, plus the existing web suite. The earlier full GitHub run passed frontend, portable SQL and browser acceptance; check the latest PR run after this follow-up commit.

## Selected-centre seven-month run — 18 November 2026

The owner selected **Aralimatti and Avaradi** for April–October. `scripts/audit/plan.mjs` defines 14 separate Leadership scenarios (one centre × one month), never a pooled two-centre or seven-month total. Each chart category, centre row and dated/shifted register row is its own comparison. Grades 1–10 include genuine zero-count categories. Recorded facts and source quarters must fall within each scenario's own month-end; a later F2 result cannot be silently read into April's independent historical value.

The deterministic role sample uses seed `20261118`: Cluster Officer, Aralimatti, July, Evening; Teacher, Avaradi, August, Morning. The Officer's Overview and every register page were captured under the verified role/centre/shift. The current Teacher session is scoped to Hosayaragudri and cannot select either target centre; the Teacher sample is explicitly pending an existing authorized Avaradi Teacher sign-in. No account, scope grant, permission, activation or programme fact was changed to make a test pass. Officer-specific visit identity/definition gaps remain flagged.

The captured run has 2,857 individual cases: 1,349 matches, 11 differences, 514 without eligible source data, 122 without a settled calculation/identity, 228 without a comparable dashboard display, 511 without a verifiable historical cutoff and 122 not applicable to that role. Coverage is 49.7%, not full certification. All 16 independent before/after fingerprints agree. The 11 differences are the same `OV08` reporting-window issue: current F2 score counts appear in earlier selected months, while the historical reference only includes observed scores or completed source quarters by that month end. This is recorded for quarterly/monthly contract review, not treated as authorization to change the dashboard calculation.

Production now supports the Attendance register after the 17 November database release. Every selected-centre monthly register page was read, including true zero and incomplete records; pagination waits for changed rows rather than copying the preceding page while the server loads. April–June have no classroom attendance observations in these selected centres. Activities/category observations remain unavailable. Assessments, Profiles, Morarji and Annual Donor pages still lack the controls needed to certify separate historical monthly snapshots; those limitations are listed rather than turning current values into historical matches.

Every case carries its month, role, centre, student filters, source key and SQL-query ID. Full exact read-only SQL is stored once per scenario in `sqlQueries`; the ledger has a separate **SQL query** column and resolves the full statement on each row. CSV exports include it. No browser credential, session, individual student name or private live result is committed. The Google register retains the October baseline and adds **Apr-Oct verification**, **SQL queries**, and **Scenario coverage**. Its row SQL cells reference the corresponding exact executed query. The external register was updated through the owner-approved `kirti.sharma@goalkeep.org` connection.

The ledger defaults to **All loaded scenarios** for a collection and preserves separate centre/month/category rows. Select a scenario to inspect one role/scope. Missing Teacher access is shown as a visible note. It remains a private-file viewer; this change does not implement automatic hosted result storage/loading.

Reproduce the plan:

```bash
npm run audit:matrix -- --out /private/mass-april-october --event-kind
```

Use `--event-kind` only after confirming the column exists. Each numbered directory contains `scenario.json` and `reference.sql`. Execute that read-only SQL and save `reference.json`; run the existing browser capture with the correct authorized account, save `dashboard.json`, and re-extract `reference-after.json`. Then:

```bash
npm run audit:matrix -- --phase collect --out /private/mass-april-october
```

`--csv` optionally writes the larger full-SQL CSV. Missing captures stay untested, and mismatched source scopes or fingerprints cannot certify results. Query logs are display/export text only and are never executed by the ledger. Validation includes the seven-month plan, no future-quarter leakage, zero-count grade categories, query lineage, multi-scenario table/SQL rendering, and loading the actual private collection in the built ledger on desktop and phone.
