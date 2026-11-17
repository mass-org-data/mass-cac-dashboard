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

The initial real-data extraction has been executed read-only for the all-centre Leadership October selection. Private values and centre lists are not committed or published in the preview bundle. Actual signed-in dashboard capture still requires an authorized browser session/credentials; the initial register records untested cases rather than claiming a match.

The current Profiles, Assessments, Annual Donor and Morarji React pages have no October roster/end-month selector. Their current November values cannot be represented as October values; the capture runner records this limitation. Profile and write availability follows the existing backend. The audit does not install missing production functions or activate features. A definition review is also recorded for relative percentage improvement versus the earlier mark-change wording; display agreement alone does not approve programme logic.

Field-level identities, names, free-text feedback and audit actors are not quantitative indicators and are not exported by the independent SQL. Their completeness and permissions need a separate record-quality review. CSV exports of numeric dashboard tables are covered by the same filtered, sorted source calculations; actual browser CSV parity and full multi-role/scenario runs require the signed-in acceptance run.

## Verification

`npm run test:audit` checks comparator rules, cutoff, scenario mismatch, CSV injection, data-stability fingerprints and independently seeded PostgreSQL facts (holiday, true zero, missing data and undated quarter boundaries). `npm run test:audit:browser` checks the actual built ledger, source-file loading, filters, pagination, CSV export and phone overflow. `npm run web:typecheck`, `npm run test:web`, frontend workflows, lint/check and build remain required. Use `MASS_CHROMIUM_MODULE` or `MASS_CHROMIUM_EXECUTABLE` when the environment needs its packaged Chromium runtime.
