# Historical officer visit evidence

Historical visit workbooks name the actual officers; the operational visit API requires a login-linked assignment and an authenticated creator. Source names, remarks and dates must not be replaced with a test account, invented feedback or backdated login access.

The additive import schema keeps monthly historical officer-centre evidence in `mass_import.historical_officer_assignments` and dated entries in `mass_import.historical_officer_visits`. These reference existing staff and centre IDs and frozen source/review provenance. A reporting month records observed source coverage, not an employment or authorization interval. This creates no Auth account, scope grant or operational authority. Future permission migrations therefore do not need to fabricate governed links for this evidence.

`scripts/imports/historical_visits.py` prepares a private plan from a workbook, the completed correction register and a current database identity snapshot. Explicit review rows link source aliases to existing identities; a newly confirmed spelling is retained separately from the canonical directory label. Conflicting officer selections override only the identified source tabs. No fuzzy match is applied. Missing dates, duplicate visit keys, unknown identities, invalid shifts and future dates remain held. Neither dated records nor blank remarks imply an invented completion status or feedback.

The generated transaction registers immutable source provenance, inserts historical assignments before their visits, checks exact retries and rejects source/target drift. Review freeze SHA-256 uses `common.canonical(review)`. Raw source freezes, review decisions, private plans, execution findings and recovery files remain outside Git and CI artifacts.

Both tables have forced RLS, restricted import-only insert/read permissions, immutable guards, source/review fingerprint checks and foreign keys. Application roles have no direct access. No existing runtime RPC, feature gate or frontend is changed. Existing dashboard visit charts and registers do not yet consume this history; a later reporting integration must keep source entries separate from the operational completion workflow and avoid double counting.

Validation: `npm run test:historical-visits` tests synthetic records, rollback, repeated import, alias decisions, duplicate/date holds, unknown remarks, immutability, no login/scope changes and app-role read denial. The portable SQL replay validates compatibility with the later governance migrations. Do not replay installed hosted migrations solely because provider timestamps differ from local file versions.

Hosted installation identity: local version `20261124062419` corresponds to provider ledger version `20261124063323`, name `historical_officer_visits`. The provider allocates its own timestamp; check the installed definition and name before later releases.
