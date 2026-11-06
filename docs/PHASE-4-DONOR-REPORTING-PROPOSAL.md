# Donor reporting — preserved earlier proposal

> Superseded for directory associations by the current MASS request: migration 017 implements donors plus centres.donor_id, staff_members and centre_staff_assignments. **Do not create centre_funding.** No funding amounts/periods/financial attribution are approved. The original proposal below is retained as history, not the current implementation contract. See [017 handoff](MIGRATION-017-DEPLOYMENT-HANDOFF.md).

The manager-approved sample frontend has donor labels, filters, aggregates, print and export. Those sample centre-to-donor mappings are not verified funding evidence. No donor fields or attribution are supplied by the 23-table production schema/read proposal, so the live donor controls are unavailable rather than displaying fabricated funding summaries.

Per the current request, future donor reporting requires separately reviewed **donors** and **centre_funding** tables. These names describe a proposed addition only: no SQL, rows, roles, endpoints, funding dates, amounts, allocation percentages or source mappings are implemented by Phase 4.

Decisions required before a design/implementation release:

- Verified donor identities/labels and source authority; do not equate project/programme/workbook labels with donors.
- Centre-funding relationships, actual validity dates and treatment of overlapping/multiple funders; allocation rules only if MASS needs and explicitly approves them.
- Reporting as-of periods and which centre facts can be attributed without double counting or implying causation.
- Permitted recipients, donor identity/account linkage if any, centre/funding scope and disclosure purpose. The current three business roles do not imply an external donor role or public reporting right.
- Minimum aggregate fields, treatment of small groups/privacy risk, export/print permissions and auditable access. Programme read capability is not unrestricted export authorization.
- RLS design, temporal reconciliation, immutable funding provenance/correction and retention/recovery rules, all based on verified requirements.

A future scoped aggregate API should return only approved facts for verified funding relationships and reporting periods, with explicit authenticated recipient/scope checks and no raw child names/household records. It must not expose private schemas, allow arbitrary centre/report selectors, rely on browser donor filters for security or fall back to sample funding assumptions.

This addition is independent of proposal 016 and is **not approved for implementation or deployment**. Existing demo donor views remain available only in explicit sample mode; no real donor data is created or inferred.
