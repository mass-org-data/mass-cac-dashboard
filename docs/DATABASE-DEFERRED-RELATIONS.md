# Deferred relations and proposal reconciliation

> Directory 017 update: donors, staff_members and centre_staff_assignments are now implemented locally as a minimal source-backed directory. Existing centres gains a single donor association. The older staff/staff_assignments proposal below still describes deferred Auth linkage and dated responsibility history; it is not a request to add that hierarchy. Per the current user instruction, no centre_funding table or financial facts are implemented. See [017 handoff](MIGRATION-017-DEPLOYMENT-HANDOFF.md).

Phase 3C, 27 October 2026. The preserved Phase 2E proposal has 43 named relations. **23 names now have local implementations; 20 remain deferred.** This is not a decision to discard source history or implement the other 20. See [implemented dictionary](DATABASE-DATA-DICTIONARY.md) and the unchanged [43-relation proposal snapshot](DATABASE-PROPOSED-DATA-DICTIONARY-PHASE-2E.md).

| Proposed relation not implemented | Track / classification | Gate and required treatment |
| --- | --- | --- |
| `projects` | Reference/business scope | Authoritative project labels/grain; no project label automatically grants donor access. |
| `centre_aliases` | Historical reconciliation | Reviewed aliases/source precedence; no fuzzy centre or residence merge. |
| `placement_observations` | Historical preservation | Protected source observations/uncertain dates; do not fabricate accepted episode bounds. |
| `roster_reviews` | Historical preservation | Review labels/retention decisions need dates/authority; no automatic operational exit. |
| `private_baseline_surveys` | Sensitive history, deferred | Purpose, lawful/privacy basis, minimization/access and retention before expanded capture. |
| `private_baseline_answers` | Sensitive history, deferred | Question/version semantics and field-level sensitive-data approval; no blanket archive import. |
| `staff` | Identity/security extension | Verified staff/Auth identity linkage; existing explicit user_scope_grants is not a person registry. |
| `staff_assignments` | Business assignment history | Effective responsibility/overlap and historical entitlement policy distinct from current access grants. |
| `assessment_batches` | Frontend extension | Stable batch identity, comments, atomicity and note privacy not yet implemented. |
| `monthly_activity_returns` | Required before historical ACT import | Historical monthly return grain/source scope; do not turn source month/slots into invented events. |
| `monthly_activity_responses` | Required before historical ACT import | Preserve Yes/No/unknown slots separately; evidence required for any real-event bridge. |
| `centre_visits` | Source/operational module deferred | Authenticity, dates, officer/scope and future-entry contract; no template rows treated as Completed. |
| `followup_actions` | Frontend extension | Privacy, status, attributable revisions and retention need approval. |
| `guidance_sessions` | Optional module | Live scope and actual session identity/date contract not approved. |
| `guidance_participants` | Optional module | Person linkage/standalone participants and scope contract not approved. |
| `guidance_followups` | Optional module | Destination/status/evidence and private contact workflow not approved. |
| `guidance_feedback` | Optional module | Author/session/privacy/retention contract not approved. |
| `funders` | Optional reference/security | No automatic conversion of project names into funding identities or accounts. |
| `centre_funding_periods` | Optional history/security | Funding attribution periods, actual donor capabilities and disclosure approval. |
| `identity_resolutions` | Required before historical person promotion | Authorized human identity adjudication/evidence/current-decision revisions; no name-only automated merge. |

## Implemented names do not imply complete proposal parity

Foundation tables deliberately minimize filenames/headers/payloads/notes and use opaque references and allowlisted issue/audit metadata. Current core uses UUID display IDs, narrow private profiles, explicit dated episodes, current-process quarter/scale definitions, explicit event participation and Morarji flags. It does not implement the proposal's shared origin columns, full staff/project hierarchy, source-equivalence/self-link history, all status/edit/bulk workflows or every optional field on each implemented name. The exact final columns/keys in the implemented dictionary override assumptions based on the old proposal.

Historical monthly responses and unresolved identities remain unpromoted. Original source evidence stays under its existing restricted handling boundary, and restricted foundation import_exceptions plus aggregate reconciliation track held/excluded occurrences without copying personal values into ordinary logs. No source workbooks or real historical rows were read/imported in this phase. Preserving source evidence is not approval for indefinite retention or for committing private artifacts.

No deferred relation is silently represented by a new enum, mock row or unsupported outcome in an implemented table. Optional modules are not database-deployment prerequisites; source-specific history/adjudication relations and approvals can become prerequisites for the later import track that actually needs them.
