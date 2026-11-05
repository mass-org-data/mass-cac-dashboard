# Repository, prototype and hosted database reconciliation

Inspected 5 November 2026. Implementation base: `feature/supabase-frontend` at
`8c76b0ee711bcd136203ec6960731269e9e53a9d`. Prototype reference:
`migration/frontend` at `85dbbee6258ad434805d0b27f0b44e61cd337f1c`.
Hosted database: MASS `pbkwpfdpdtelmvbkzgvx`, Mumbai.

## Decision

Continue the connected branch. The prototype is a design reference, not the
integration base. Do not replace populated core tables with the earlier proposed
greenfield model or merge prototype browser-storage writes over live handlers.
Retain the prepared migrations and activation gates. No hosted DDL, programme
write, staff-grant change, main merge or production deployment was performed.

## Verified live state

The connected Supabase tool successfully executed read-only catalog and count
queries in this session. The old blanket statement that hosted inspection is
blocked by HTTP401 is no longer current for this connection. It does not prove
that all older Management API clients or credentials are repaired.

- PostgreSQL17.11; execution principal `postgres`.
- Exactly19 applied migrations, through019;27 MASS tables; zero tables without
  enabled and forced RLS in mass_core/mass_foundation/mass_import.
- 1,458 students/enrolments;47,323 attendance observations;207 assessment results.
- Quarter1 has one undated result; quarter2 has206 dated results.
- Calendar, activity, participation, cohort and Morarji outcome tables are empty.
- 020 registration table,021 assignment/visit/revision tables,022 delivery table
  and private activation schema are absent.
- Catalog role membership permits postgres to SET both MASS owner roles. This is
  a prerequisite check, not proof of successful hosted DDL or managed staff Auth.

The new read-only `supabase/compatibility/reconciliation-preflight.sql` captures
the baseline prerequisite query. It does not replace the existing full preflight,
function/ACL fingerprints, data preservation checks or staged installation runner.

## Already implemented versus genuinely remaining

| Area | Existing repository work | Hosted/remaining work |
| --- | --- | --- |
| Original UI + live connection | Auth, scoped loading, dependent filters, API adapters, save/error handling | Verify an exact connected Preview with managed staff sessions; do not use the prototype deployment as proof |
| Attendance | P/A/L/WO/MM mapping, approved calculations, safe explicit-mark refresh, version checks | Stage020 atomic writes and activation controls; calendar remains unverified and empty |
| Quarter-only assessments |020 includes undated results by period overlap | Install guarded020 before enabling quarter-inclusive loading; baseline app intentionally suppresses assessment loading rather than showing a partial cohort |
| Profile/registration/correction |020 controlled APIs;023 transfer; frontend handlers | Installation and separate operation activation; historical overwrites/transfers remain hard-disabled in current control-plane design |
| Officer visits |021 assignments, visits, immutable revisions, RLS; frontend entry/history/trends | Install guarded021, verify real officer/Auth/date scope, then activate approved entry; retain2Morning+2Evening target |
| Activity/CAC delivery |022 categories, statuses and delivery records; protected entry handlers | Install guarded022; live source-backed events/calendar still needed; activities remain hard-disabled by current activation design |
| Demographics/reporting |023 scoped aggregates;024 separate reviewed-chart proposal | Stage023; review/promote024 separately without changing approved calculations |
| Morarji basics | Existing memberships/outcomes and live adapters | Source-backed cohorts are absent; do not create fictional memberships |
| Morarji extra dates/outcomes | Prototype date inputs; connected form explicitly disables unsupported date saves | New additive date/outcome storage, scoped reads and versioned writes remain to be designed;020–024 do not provide these fields |
| Assessment absence/comments | Prototype supports absence/group comment; live schema stores scores only | New status/comment contracts and atomic saves remain; do not turn absence into zero |
| Follow-ups/challenge notes | Prototype browser notes only; live handler blocks unsupported saves | Define protected history/storage and authorized access before collecting real notes |
| Remove/undo | Demo-only removal and snapshot undo | Live deletion unsupported; do not copy localStorage undo into hosted workflows |
| Later school/career modules | Explicit source-dependent/hidden views | Source and reporting definitions remain required |

Additional differences to preserve for deliberate review: the prototype allows
Both-shift activity events whereas current live events have one shift;022 only
permits Cultural/Sports categories, not Important Day; the latest connected review
uses >2 cultural/sports participations for engagement while prototype uses >=2.
This reconciliation does not change the approved calculation module or choose a
new business rule. Separate date/outcome extensions must preserve legacy NULLs,
version checks, authorization, and the current disabled-operation boundaries.

## First implementation delivered

Morarji follow-up previously preferred `db.morarji[enrolment]` even when a different
historical cohort was selected. It now resolves the selected cohort and exact
membership ID, rejects missing/ambiguous matches, and submits the selected record's
revision. The table carries membership identity into the handler. No permission
gate is opened and no unsupported date field becomes editable. Four behavioral
regressions cover historical selection, missing/foreign/ambiguous records, exact
membership resolution and the submitted member/revision with unknown outcomes.

## Execution order ahead

1. Finish hosted read-only definition/ACL/grant-topology preservation review against
   the frozen release; do not equate simple catalog success with full readiness.
2. Use the existing offline envelope builder and controlled020→021→022→023 path,
   keeping operations disabled during installation and verifying each real ledger
   entry and original-data/grant projections. Do not run bare canonical files or
   replay001–019. Review024 as a separate proposal.
3. Verify managed authenticated reads on the exact connected Preview; then test
   specifically authorized new-observation workflows and persistence. Do not
   activate staff provisioning, historical corrections or transfers implicitly.
4. Implement the remaining Morarji, assessment and note extensions as additive,
   versioned contracts, with the matching frontend adapters and database tests.
5. Validate all chart/form/filter paths against actual saved records and source
   completeness before considering a production release. Current scope is Preview.

## Validation of this change

-83 frontend tests pass, including4 new behavioral regressions.
-27 existing demo workflow/removal/undo checks pass; these do not authorize live deletion.
-3 offline activation-envelope builder tests pass.
-Application/build syntax and live-mode build pass. The build has no deployment
 configuration injected and is not proof of a configured hosted runtime.
-No SQL migration was edited or applied; no full PostgreSQL/browser release suite
 was rerun for this small frontend selection change.
