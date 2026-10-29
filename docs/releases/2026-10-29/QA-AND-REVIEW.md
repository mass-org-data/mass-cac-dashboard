# Engineering review and functional verification

**Hosted Preview: NOT EXECUTED. Managed Supabase Auth: NOT VERIFIED for this release. Production test writes: NONE.** Local verification is not presented as a substitute for these gates.

## Pass1 — engineering review

Reviewed the changed original renderer, population selector, loader, session cleanup, write adapters, public archive builder, importer offset, all four additive migrations and their interaction with the unchanged019 baseline. The actual hosted catalogue/source audit remains the reference; no schema redesign or workbook rediscovery was performed.

Issues identified and corrected during this pass:

- Grade omitted from population; profile/search/export scopes diverged. One episode-aware selector now drives these paths; masked demographic scope is calculated through bounded aggregate SQL.
- Fixed-window assessment reads and NULL date comparisons lost legitimate data. Quarter overlap and NULL-safe immutable context are now explicit.
- Child-level deduplication collapsed historical episodes. Episode identity is retained; transfer closes/creates with two explicit dates in one transaction and preserves child/permanent IDs. Simultaneous-assignment and cross-transfer learning-cohort interpretation remain a documented decision condition.
- Author-role and centre scope were insufficient to establish an actual officer identity. A private verified link now requires matching roles/centre, dates and explicitly reviewed Both-shifts authority, with no default derived from NULL directory shifts.
- Planned visits could otherwise inflate completion; same-day/request retries and stale edits needed different treatment. Only Completed counts; request UUID retries are idempotent and row-version corrections conflict safely.4Morning/0Evening never achieves target; actual counts are uncapped. Zero recorded observations render unavailable rather than asserting no real-world visits.
- Source scheduling was not delivery. Separate observed delivery and nullable activity metadata avoid historical backfilling. Existing participation prevents contradictory cancellation; future Held is rejected.
- Original controls could redirect without context or mutate memory before failure. Live handlers now use original dialogs and real RPC responses; unsupported privacy/removal/guidance operations are explicitly blocked. Pending form values are not reported as persisted facts.
- Auth storage cleanup targeted the wrong store; identity/scope transitions and in-flight reads could retain stale views. Actual persistent keys are cleared, requests aborted, subject/scope rechecked and dead loads prevented from repopulating data.
- Academic-year changes could leave dates/window state inconsistent. Configured years load transactionally in the UI; daily date navigation resolves an approved matching year. Source-backed NULL dates remain NULL.
- Data without completeness authority could be classified as low attendance/dropout. Live display classifiers now remain unclassified and unmarked counts stay unknown until authoritative calendar/coverage exists. Recorded P/(P+A+L) remains usable.
- CSV formula prefixes and unescaped dialog text were unsafe. CSV neutralization and escaped labels/titles are tested. A double-escaping issue found by the stored-markup browser test was corrected.
- Public source downloads recursively included untracked working notes. A reviewed allowlist now excludes them and private workbooks/packages. Demo records stay in explicit demo mode; no sample fallback occurs during a failed live load.
- Morarji's fixed row offset skipped two candidates. Per-sheet verified header detection preserves physical rows; all550 candidates remain private/held, not imported.

No critical/high technical finding discovered in this review is silently marked production-approved. Actual broad role grants, missing identity evidence, unknown reporting/retention policies, hosted Auth and deployment remain blocking conditions in the closure matrix. Original CSS, fonts, branding and image assets are unchanged; original chart numbers are preserved. This is structural/functional preservation evidence, not a full pixel-identical deployed Preview comparison.

## Automated results

Machine-readable results: `VERIFICATION.json`. Do not add overlapping suite counts together as though they were unique checks.

|Check|Result|Boundary|
|---|---|---|
|Frontend unit suite|28 passed,0 failed|Includes scope, historical dates, CSV, session cleanup, archive privacy and existing API contracts|
|Original explicit-demo workflow/removal suite|27 checks passed|Browser-local prototype behavior remains isolated from live writes|
|Full current migration/SQL suite|146 behavioral PASS assertions|Fresh PG17 under a non-superuser/NOBYPASSRLS deployer model; synthetic Auth stand-in|
|Migration021 failure/rollback/retry|PASS|Injected divide-by-zero leaves no visit objects; exact file then succeeds locally|
|Concurrent visit corrections|PASS|One same-version edit commits; the other returns PT409; no lost update|
|Original browser integration|27 scenarios passed,0 failed|Actual local PostgREST/PostgreSQL persistence; signed synthetic role identities; no managed Auth/Preview claim|
|Population matrix|36,432 passed,0 failed|92centres×4months×3shifts×11grade choices×3genders; independent private administrative data, not36,432 rendered pages|
|Morarji header tests|2 passed|Header rows3/4, first real physical rows5/6, unknown-header rejection|
|Real private Morarji reconciliation|550 candidates,0 accepted outcomes|135/187/119/109/0; production staging/import unchanged|
|Existing foundation/core/API/directory/import/student suites|PASS|Historical baselines preserved; existing directory regression emits207 PASS notices; current student regression also runs additive schema|
|Local role/Auth-privilege probes|PASS|Managed-role-like local model only; no provider compatibility claim|
|JavaScript syntax/build|PASS|Build success is not evidence of semantic or hosted correctness|

The fresh hosted read-only snapshot still contains1458 children/profiles/enrolments,47323 attendance marks,207 assessments,276 scope grants and19 migration versions. Zero020–023 versions are recorded. No production migration or import was executed.

## Pass2 — functional evidence and limits

Local Chromium exercises CO visit creation/correction, independent SQL-backed visit-count comparison, refresh/history, mobile navigation; Teacher registration/profile updates, stored-markup escaping, individual/bulk attendance, assessment batch, academic-year switching, back/forward, cross-centre denial, activities/participation/delivery; Leadership aggregate-only navigation/private-name masking; fresh/existing/sign-in/out fixture sessions; unavailable API fail-closed behavior. Each successful write is refreshed from the real isolated API; visit history is independently re-read and confirms two revisions. SQL separately validates RLS, unknown dates, score maxima, atomic rollback, privacy and concurrent edits.

The Auth client fixture is installed ONLY by the test bundler. It is not compiled into production. Synthetic users, grants and records are confined to the ephemeral database. Local logs/screenshots are private. Provider signup/password/token-refresh/expiry/revocation behavior has not been exercised against actual managed Auth; a complete all-page visual/accessibility/performance UAT across the deployed Preview has not run.

The old mock-workspace browser script remains as historical source reference. The supported `npm run test:browser` now tests the original integrated interface with a real isolated database; the retired replacement workspace is not the product specification.

## Final gates

Use `DEPLOYMENT.md` for backup, target/owner verification,020→021→022→023 ordering, postflight, failure handling and Preview access. Verify actual staff mappings privately and complete the unresolved policy/source decisions. Do not manufacture accounts, assignments, dates, shifts, visits or outcomes to make a test pass. Do not merge/promote until hosted migrations, managed Auth/role tests, persisted Preview UAT and critical signoffs are evidenced. Verdict remains NOT READY for Production.
