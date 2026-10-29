# Original-interface integration release —29 October2026 (India)

**Verdict: NOT READY for Production promotion.** Implementation and isolated verification are available on `feature/supabase-frontend`; hosted migrations, verified staff links, authenticated Preview UAT and deployment credentials remain gates. No production SQL, imports, staff grants, frontend deployment or merge was executed for this release. The current production application remains unchanged.

The manager-approved original interface is the single live entry point. Its CSS, branding, assets, navigation, chart registry and original dialog presentation remain the reference; the separate workspace is preserved in source but no longer replaces the live interface, including when `?view=workspace` is supplied. Demo mode remains explicit and isolated. Missing datasets stay visibly unavailable rather than becoming sample records or confirmed zeroes.

## Implemented changes

- Shared episode-aware population selection applies centre/donor/officer, grade, shift, gender and display-ID/name search. Profile tables and exports use that selection. Snapshot date is explicitly displayed: daily date, otherwise selected month end capped at today. Date boundaries are half-open. Mid-month registrations can appear immediately. Historical episodes and fact identities are retained; no child/name-only merging occurs.
- All36,432 tested combinations reconcile against a fresh private administrative export, with0 mismatches. The fresh hosted read-only query returned1458 students and99 in Grade1; these are evidence, not hardcoded UI values.
- Quarter-only assessments are read by documented period overlap. Date remains NULL through numeric corrections. Academic-year selection loads only configured periods/definitions and prevents cross-year alias overwrites; unconfigured periods are not invented. Equal maximum25 does not approve paper comparability: improvement and comparison interpretations remain visibly blocked.
- Original dialogs call actual scoped APIs for registration, profile correction/first enrolment closure, individual/atomic bulk attendance, assessment batches/corrections, named activities, participation, observed CAC delivery, Morarji membership/approved flags and visits. Registration and visit creates are request-idempotent; writes disable duplicate submission, use row versions, refresh from the server and distinguish conflicts/unknown outcomes. Technical batch ceilings are explicit, never silently split.
- Leadership and accounts lacking private-profile capability use minimized aggregate analytics. No private-profile grant or direct private-schema API exposure is added. Individual gender-filtered records remain restricted when that capability is absent. Live role selection is a verified read-only display; the prototype selector does not grant access.
- Visit targets are the newly confirmed2Morning+2Evening per applicable centre/calendar month; all92 centres imply368 visits. Targets are distinct from actuals. Planned records are excluded; four Morning/zero Evening fails achievement; overachievement retains true counts. Officer-specific targets require verified dated links, not name matching or directory observations alone.
- Visit feedback/revision snapshots are private to the authorized authoring officer. Leadership sees scoped aggregate counts only. Corrections require a reason/version; deletion and silent recovery are unavailable. Foundation audit keeps revision-only metadata; sensitive snapshots stay in the restricted operational revision table.
- Scheduling and observed session delivery are separate. Activity metadata has nullable category/status; existing records are not backfilled by assumption. Planned/cancelled activities cannot acquire observed participation; corrections cannot silently invalidate existing participation.
- Sign-out purges the actual persistent Auth key. Review data clears on identity boundaries, scope changes and verification failures. Refreshes verify identity/scope; expired loads cannot repopulate cleared views. Browser navigation stores only non-personal view choices, never programme rows/search names.
- CSV cells neutralize formula prefixes. Dialog labels/titles escape entered text. The public source ZIP uses a reviewed allowlist; untracked working notes/private files cannot be swept into the download.
- Morarji header detection preserves exact worksheet names/physical rows. Reconciliation now finds550 candidates (135/187/119/109/0), all held in the private review computation. Previously548 were staged: the two additional physical row5 observations were omitted by the old offset. No outcome or additional provenance row was imported into production.

## Database release

| Migration | Purpose |
|---|---|
|`202610290020_original_workflows.sql`|Period reads; NULL-preserving score corrections; authenticated-only write contracts; atomic batches; profile/closure; idempotent registration receipts; calendar authority API|
|`202610290021_cluster_officer_visits.sql`|Explicit verified officer links; visit records/private revision history; record/read/aggregate/history APIs; framework audit integration|
|`202610290022_activity_delivery.sql`|Nullable activity category/status and corrections; separate observed CAC delivery; scoped reads and audited writes|
|`202610290023_programme_aggregates.sql`|Minimized programme analytics; assumed/staff-entered/undocumented enrolment-date labels; scoped minimized revision reads|

The deployed001–019 files are unchanged. New files have NOT been applied to hosted Supabase. The full local schema has32 tables,230 columns,45 foreign keys and115 RLS policies. This includes27 existing relations plus registration_requests, officer_assignments, cluster_officer_visits, visit_revisions and cac_delivery_records. Private-schema exposure is unchanged. New functions have fixed search paths and explicit caller/scope checks; no Auth-schema grants or new database roles are introduced.

See [schema/security](SCHEMA-AND-SECURITY.md), [43-gap closure matrix](GAP-CLOSURE.md), [24-chart register](CHART-RECONCILIATION.md), [QA/reviews](QA-AND-REVIEW.md), and [deployment procedure](DEPLOYMENT.md). Checksum authority is `supabase/compatibility/MIGRATIONS.sha256`.

## Boundaries and remaining business conditions

Unresolved historical sources are not imported:1177 student source rows,889 attendance observations,1591 assessment rows,548 previously staged Morarji candidates plus two newly discovered omitted observations. MASS's discrepancy Sheet has not been read/updated because a Sheets connector is unavailable. No source workbook, child identity, private staging SQL or credential is committed.

Deletion/undo retention, sensitive challenge/guidance notes, paper comparability/precision, complete calendar authority, activity eligibility/coverage, advanced Morarji outcomes and historical donor attribution remain conditional. Their controls retain explicit limitations. Actual staff-centre permissions and dated Auth-to-staff links need administrator evidence; existing276 grants were not changed. Programme-wide delivery/history completeness is not inferred from newly entered observations.

No separate hosted test project or three managed Auth test accounts were confirmed. Tests use isolated synthetic data and signed test identities, not production contamination. Vercel CLI reported no credentials; no Preview URL is available. Git protocol access is available, while GitHub REST access is denied in this environment. Publication/remote SHA is reported separately after the commit.
