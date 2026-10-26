# Phase 2C — concise approval register

At the original Phase 2C review all entries were Pending. Updated by the user's Phase 2D instruction, reference date **26 October 2026**: eight Conditional, four Partial, three Pending; none Fully Approved. Original recommendations below are unchanged. See PHASE-2D-CONDITIONAL-APPROVALS.md for approved principles, pending conditions, required evidence/owner groups and implementation gates. No implementation is authorized. No private evidence or credentials belong here.

| ID | Priority | Recommended disposition / exact matter to approve | Status | Reference date |
| --- | --- | --- | --- | --- |
| D01 | P0 | Human-reviewed identity; UUIDs only for confirmed people; no fabricated external IDs/name-only matches. Supply authority/evidence and external-ID scope. | Conditional | 26 October 2026 |
| D02 | P0 | Preserve observations; confirm source precedence/aliases and dated assignment/overlap rules; no inferred enrolment or exit dates. | Conditional | 26 October 2026 |
| D03 | P0 | Keep P/A/WO/MM/L literal; supply status/calendar/metric mapping and any H policy before live calculations. | Partial | 26 October 2026 |
| D04 | P1 | Quarantine date/header/formula anomalies; provide approved corrections/precedence without editing original source. | Conditional | 26 October 2026 |
| D05 | P0 | No blanket year/century fill; approve source block/date rules and Q-to-F aliases explicitly. | Partial | 26 October 2026 |
| D06 | P0 | Preserve numeric scores; confirm paper maximum/precision/attempt/status policy; no rescaling or guessed bands. | Partial | 26 October 2026 |
| D07 | P1 | Store historical month/slots separately from new dated events; approve any event bridge and minimal historical display. | Conditional | 26 October 2026 |
| D08 | P1 | Confirm cohort and flag interpretation; retain School Name; unsupported award/training fields stay unpopulated until approved. | Partial | 26 October 2026 |
| D09 | P1 | Hold undated/template-like legacy visits; approve authenticity/dates and separate new dated entry contract. | Conditional | 26 October 2026 |
| D10 | P0 | Minimal operational identity first; defer expanded sensitive-baseline capture; approve purpose/access/retention/region. | Pending | 26 October 2026 |
| D11 | P0 | Explicit server-controlled capabilities/scopes; deny unapproved access; no role-dropdown or donor inference. | Conditional | 26 October 2026 |
| D12 | P1 | Six-table technical foundation first; conditional 35-relation core backlog; defer six optional and two sensitive-history relations. | Pending | 26 October 2026 |
| D13 | P0 | Transactions, optimistic revisions and attributable minimized audit; append follow-up history; isolate demo reset. | Conditional | 26 October 2026 |
| D14 | P0 | Verify existing project and isolated synthetic target; approve migration/RLS/backup process before any DDL. | Pending | 26 October 2026 |
| D15 | P2 | Approve snapshot scope/exclusions; supply guidelines/metadata where available; no unsupported completeness claims. | Conditional | 26 October 2026 |

## How to complete remaining approvals without inventing facts

- Approve the technical handling policy separately from the missing business values. For example, approve preserving unknown years while the source owner resolves them; do not approve filling all rows with the first visible year.
- Identify an authorized owner for each source/security decision. Do not put names of children, private matching records or credentials in the approval response; use a protected adjudication channel for real matches.
- Record approval version/date, conditions, selected rule/value mapping and supporting evidence. Unresolved records can remain quarantined while an independently approved track advances.
- Scope acceptance is not execution permission. A subsequent implementation task must explicitly authorize SQL/code work and its target. This phase creates no migrations, Supabase resources, real data or deployments.

Suggested review order: D01 identity -> D02 historical placement -> D05/D06 academic grain/scales -> D03 attendance -> D10/D11/D14 privacy/permissions/platform -> D04/D07/D08/D09 source modules -> D12/D13 rollout/editing -> D15 process authority. Source owners may work in parallel outside this agent workflow; no approval is inferred from silence.

## Dated approval boundary

Only the specific Phase 2D technical principles are conditionally/partially approved. The original recommendations are review proposals except where explicitly covered by those principles. No business code meaning, date/year, scale, person match, retention period, actual grant, database scope or platform target has been approved by inference. D10/D12/D14 remain Pending. Detailed current conditions are in PHASE-2D-CONDITIONAL-APPROVALS.md; remaining questions and readiness are in the other two Phase 2D documents.
