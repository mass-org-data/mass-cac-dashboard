# MASS hosted installation — 5 November 2026

Target: `pbkwpfdpdtelmvbkzgvx` (Mumbai), from PR #2 at `2a6990f`.
The user's continuation request authorizes controlled hosted installation and
approved entry activation. Main and Production are excluded.

## Completed in the hosted database

| Canonical source | Actual provider version | Recorded name |
| --- | --- | --- |
|020 original workflows |20261105131813 |mass_020_original_workflows_sealed |
|021 officer visits |20261105131906 |mass_021_cluster_officer_visits_sealed |
|022 activity delivery |20261105131957 |mass_022_activity_delivery_sealed |
|023 programme aggregates |20261105132040 |mass_023_programme_aggregates_sealed |
|024 reviewed metrics, reviewed separately |20261105132154 |mass_024_reviewed_chart_metrics_sealed |

The five canonical SQL files remain byte-identical. These are real provider
receipts for executed sealed payloads, not manually stamped canonical versions.
The original19 ledger rows, including provider aliases, remain unchanged.
Never run blind `db push`, replay001–019, repair/stamp the ledger or rerun these
stages using their local timestamps. Reconcile both recorded names and payload
provenance before any future deployment.

Inventory after023:32 programme/foundation/import tables,230 columns,45 validated
foreign keys and115 policies. The separate private activation schema adds2 tables,
10 columns and2 policies. All34 tables have enabled and forced RLS. After024,
21 API functions have checked entry guards; anonymous and service-role execution
remain denied. Application roles cannot assume either owner role or update controls.

## Execution safety and preservation

Fresh catalog/grant inspection succeeded through the connected Supabase tool.
Both existing test accounts and all276 active grants were captured privately.
The Leadership account has92 grants; the Teacher/Cluster Officer account has184.
No account, grant, profile capability or directory assignment was changed.
Names, emails and UUID-to-centre maps remain outside Git.

All27 original tables were fingerprinted using their original columns. Before
each stage, bounded SHARE ROW EXCLUSIVE locks and an in-transaction fingerprint
check prevented concurrent programme/grant changes. After each committed stage,
the same27 fingerprints were rechecked. The fingerprints also matched after the
three explicit control activations. This includes every original programme value,
audit row, import receipt and scope grant, not just row counts.

The existing fixed-ledger builder cannot be sent directly to `apply_migration`,
which owns its own migration receipt. The new offline provider builder removes
only the outer executable transaction and manual history insertion; it preserves
the canonical stage SQL and seal. A deferred constraint trigger on a temporary
receipt table checks at COMMIT that exactly one matching provider ledger entry
exists, including the canonical source-hash marker. A provider that commits the
DDL before its receipt, splits statements into autocommit, or double-logs a stage
cannot commit the installation. No application-facing intermediate unguarded
functions are committed. All14 controls remained false throughout installation.

Isolated PostgreSQL17.5 WASM rehearsal proved successful staged installation,
injected-failure rollback, missing-receipt commit rejection, original-value
preservation and direct disabled RPC denials. The actual hosted installations
then committed successfully with this deferred receipt check. The source-only
manifest and private original-column snapshot reproduce the applied payloads;
execution files/fingerprints stay outside the repository.

For offline reproduction ONLY, using the privately captured original baseline:

```sh
python scripts/activation/prepare_provider.py --output /private/replay-review \
  --baseline /private/baseline.private.json --include-proposal-024
```

This command never connects. Its initial ledger/preservation guards reject replay
against the now-upgraded database.024 remains a separately classified source in
the generator; its inclusion is never the default.

## Current operations

| Control | Current state | Meaning |
| --- | --- | --- |
|reviewed_reads |Enabled |Scoped024 reporting available |
|attendance_entry |Enabled |New explicit observations; existing values cannot be overwritten |
|assessment_entry |Enabled |New0–25 results in configured quarters; unknown exact dates stay unknown |
|visit_entry |Disabled |No verified dated Auth-to-directory officer assignments exist |
|All three correction controls |Disabled/hard-off |Historical overwrites remain blocked |
|Transfers, profiles, enrolments, calendar, activities, Morarji |Disabled/hard-off |No activation is implied by schema installation |
|Registration |Disabled |No new accounts or student records created |

The three control changes have immutable activation-event records. No programme
observation was inserted for testing. Genuine save/reload browser verification
must use genuine user-entered observations; do not fabricate records to pass it.

## Verification completed

-544 hosted filtered cases pass across July, August, September and October:
 136/month, covering all92 centres,8 donor groups and35 additional combined filters.
 Independent SQL populations, P/A/L/exclusion counts, attendance percentages and
 quarterly counts/means match the newly installed reviewed API.
-The live all-centre read returns1,458 students and207 assessment results,
 including the one quarter-only undated result. Empty calendars/activities remain
 unavailable; they are not manufactured into zeros or classified bands.
-All21 guarded endpoints were denied while disabled, in a hosted READ ONLY
 transaction using the existing account's authenticated SQL role/claims. This
 checks server authorization, not a managed browser-issued JWT/session.
-All74 dollar-quoted hosted function bodies match their frozen baseline/stage/seal
 sources after removing only the expected entry guard. The SQL-standard identity
 helper was inspected separately. Function ACLs/owners/search paths were reviewed.
-83 frontend tests and27 existing demo workflow checks pass. The latter are not
 authority for live deletion/undo.
-7 offline builder/validation tests pass;5 staged provider rehearsals pass.
-Existing core SQL assertions, visit/delivery/scoped-reporting assertions and
 definer security matrix pass in isolated PostgreSQL17.5 WASM. All1,440 independent
 JavaScript-versus-SQL calculation cases pass after sealing, with reviewed reads
 enabled in isolation. Native concurrency and managed Auth remain separate tests.
-Syntax/build pass; original UI styles/assets and24 chart contracts remain intact.

## Remaining work and precise boundaries

1. Authenticated Vercel and MASS Leadership browser sessions now work on the
   configured Preview below. Read-only Overview, Attendance, Learning, Activities,
   Morarji, Officer and Donor pages and dependent filters were checked. This does
   not certify all 24 charts or genuine save/reload workflows. Leadership sign-out
   cleared programme data. Teacher sign-in was declined; the user clarified that
   a dedicated Teacher account must first be created. Obtain its verified email
   and centre/shift scope before inviting it. No password should be sent in chat.
   No deployment protection setting or bypass was changed.

   Preview (commit `0761829`):
   https://mass-cac-dashboard-l52z6ivcf-mass-data-dashboard.vercel.app/

2. Visits need verified dated Auth-to-staff officer links. Directory names and
   broad test grants cannot establish those links. No link or visit was invented.
3. Morarji dates/training days/selection/admission/scholarship, assessment absence
   and group comments, and protected follow-up notes still need additive storage,
   revision/access contracts and matching adapters. They are not implemented by
  020–024. Existing unsupported controls remain explicit and do not save locally.
4. Final staff permissions require verified identities/scope/dates. The user now
   requests one dedicated Teacher account; its email and assignment remain needed.
   Existing test grants are intentionally retained. Google Sign-In stays last; no
   OAuth/Auth config changed.

Security advisor status is not all-green:24 signed-in SECURITY DEFINER notices
now describe the intentional scoped/gated API, plus the pre-existing disabled
leaked-password-protection warning. No new public API/table access was introduced.
Review details at the official linter/password guidance; no paid Auth feature or
existing test-account configuration was changed to silence warnings.

No main merge or Production deployment occurred.

## Approved quarterly reference configuration

The existing April 2026 academic year now has all four quarterly assessment
periods and four maximum-25 definitions. Existing Q1/Q2 definitions were retained;
Q3/Q4 reference rows were added without invented dates or results. The separate
idempotent DML script is `supabase/configuration/2026-four-quarter-definitions.sql`;
it does not add a migration receipt. The provider rehearsal runs it twice.
After hosted configuration, fingerprints of all original rows in the 27 original
tables still match the pre-installation snapshot, including original audit rows.
New configuration audit rows are intentional additions. No programme observation
or existing account/grant was changed.
