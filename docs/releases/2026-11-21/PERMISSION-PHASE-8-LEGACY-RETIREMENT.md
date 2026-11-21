# Permission Phase 8: legacy authorization retirement

**Prepared:** 21 November 2026  
**Branch:** `fix/permission-architecture`  
**Migration:** `20261121180000_permission_legacy_retirement.sql`  
**Hosted status:** core Phase 8 and temporary context compatibility migrations installed on Preview

**Production:** unchanged

## Fresh preflight

- The protected branch Preview still serves commit `6571d23` and Preview Supabase `nilzfsahxoxibvrwsqkd`.
- Preview has four governed accounts, thirteen governed assignment-history rows, 102 retained legacy grants and eighteen officer assignments.
- Reconciliation reports two raw mismatches. Both are explained by completed Phase 7 administration events: the invited Teacher and its centre, and the Cluster Officer's additional governed centre. There is zero unexplained drift.
- Every officer assignment has exactly one governed account-centre candidate. There are no zero-match or ambiguous mappings.
- Assessment entry is enabled. Attendance entry and visit entry remain disabled. No activation value is changed by Phase 8.
- Production has no permission-architecture ledger versions and no `application_users` or `administration_events` table.

## Candidate behavior

- Backfill every historical officer assignment with a required governed assignment link while retaining its original legacy foreign-key value.
- Use governed users and centre assignments for visit discovery, validation, creation and correction.
- Permit Leadership to use governed visit assignments under the approved hierarchy, while enforcing the server-side `visit_entry` gate on direct RPC requests.
- Move Auth-backed staff-directory identity linkage from `staff_operational_access` to `application_users`.
- Remove browser discovery of `user_scope_grants`, revoke operator mutation of legacy grants and overrides, and revoke execution of the inert override helper.
- Retire the legacy clone script with a fail-closed operator error.
- Return only one authoritative `role` and role-neutral centre scope from `get_context`. The React interface no longer consumes role arrays or an operational-role override flag.
- Keep `/vanilla/` unchanged for its separately approved removal phase.

## Preview rollback dry run

The owner approved one rollback-only Preview transaction. It executed the exact migration followed by `supabase/activation/seal.sql`, inspected the transactional state, and ended with `ROLLBACK`.

Inside the transaction:

- all 18 of 18 officer assignments received a governed link;
- all 102 legacy grants and both legacy override rows remained present;
- authenticated legacy discovery and `mass_core_admin` legacy mutation were revoked;
- the staff Auth foreign key targeted `application_users`;
- `get_context` no longer contained role arrays;
- the two reconciliation mismatches remained explained Phase 7 differences; and
- assessment entry remained enabled while attendance and visit entry remained disabled.

Post-rollback verification confirmed exact restoration of the relevant preflight state: migration ledger count zero for `20261121180000`, no governed officer-assignment column, 18 officer assignments, 102 legacy grants, two legacy overrides, prior ACLs and staff foreign key restored, prior role-array context restored, the same reconciliation summary, and unchanged feature gates.

## Preview installation and compatibility hold

The owner approved the committed Preview transaction. The first attempt failed before `COMMIT` because the transaction still held `mass_core_owner` while inserting the provider ledger row. PostgreSQL aborted it, and a read-only check confirmed full rollback. The retry reset the transaction role before the ledger insert and committed successfully.

Preview now has ledger entry `20261121180000` (`permission_legacy_retirement`). All 18 officer assignments are governed-linked. The 102 legacy grants and two override rows remain retained. Browser legacy discovery, operator legacy mutation and override execution are revoked. The staff Auth foreign key targets `application_users`, visit runtime functions contain no legacy authorization joins, reconciliation remains at two explained mismatches and zero unexplained drift, and feature gates are unchanged. Production remains unchanged.

Postflight also found a deployment-order incompatibility. The installed `get_context` correctly omits role arrays, but deployed frontend commit `6571d23` still evaluates `centre.roles.includes(...)`. Two append-only candidates address the sequence:

- `20261121183000_permission_context_compatibility.sql` temporarily returns arrays containing exactly the one authoritative role. It changes no authorization decision.
- `20261121190000_permission_context_retirement.sql` removes those response-only fields after the new React frontend is deployed and accepted.

The portable SQL replay validates both transitions. The temporary compatibility migration is installed as described below. Do not apply `20261121190000` before the frontend cutover.

### Temporary compatibility rollback rehearsal

The owner approved a rollback-only Preview rehearsal of `20261121183000_permission_context_compatibility.sql`. The exact migration ran inside a transaction, followed by catalog and reconciliation checks, and ended with `ROLLBACK`.

Inside the transaction, `get_context` used the `legacy-retired-compatible-v1` marker, returned exactly two `jsonb_build_array(app_role)` fields (the top-level and per-centre response-only arrays), and advertised `operational_roles_enabled=false`. The core Phase 8 ledger remained present and no compatibility ledger row existed. All 18 of 18 officer assignments remained governed-linked; 102 legacy grants and two override rows remained retained; all three retirement revocations remained enforced; reconciliation remained at two explained mismatches and zero unexplained drift; and assessment, attendance and visit entry remained true, false and false respectively.

The independent post-rollback read confirmed the lasting state was unchanged at that point: the core `legacy-retired-v1` function was installed with zero role arrays, the compatibility marker and ledger entry were absent, all 18 governed links and the retained evidence counts remained intact, the retirement revocations remained enforced, reconciliation was unchanged, and the three feature gates retained the same values.

### Temporary compatibility installation

The owner separately approved persistent Preview installation. Fresh preflight confirmed the core ledger, absent compatibility ledger, 18 of 18 governed links and unchanged gates. The migration and its provider ledger row then committed atomically as version `20261121183000`, name `permission_context_compatibility`. The stored ledger statement MD5 matched the reviewed migration file.

Postflight confirmed the compatible API marker and exactly two response-only `jsonb_build_array(app_role)` fields, with operational role switching disabled. All 18 governed links, 102 legacy grants and two legacy override rows remain; the browser discovery, operator mutation and obsolete override-execution revocations remain enforced; reconciliation remains at two explained mismatches and zero unexplained drift; and assessment, attendance and visit entry remain true, false and false respectively.

Fresh authenticated API sessions for Teacher, Cluster Officer and Leadership each returned the expected single authoritative role. The top-level role array and every per-centre role array contained exactly that role, `operational_roles_enabled` was false, and the response advertised `single-role-v1` with `legacy-retired-compatible-v1`. No credentials, tokens, account identifiers or centre identifiers were retained in the evidence.

A fresh read-only Production check found zero Phase 8 ledger versions and no `application_users` or `administration_events` table. Production remains unchanged.

### Frontend deployment and signed-in acceptance

The owner separately approved pushing the thirteen local commits after `6571d23`. The remote `fix/permission-architecture` branch fast-forwarded to `9858d59`. Vercel reported the exact commit Ready, and `dev-mass-cac-dashboard.vercel.app` was aliased to that deployment.

Repeatable system-Chromium acceptance passed with fresh Preview Auth sessions for Teacher, Cluster Officer and Leadership. Every role reached Overview with the correct authoritative role, received its approved navigation scope, opened About and signed out. Leadership alone received User administration and its invite control. There were zero page errors and zero failed application API responses. One generic Teacher console 404 was traced to the absent optional `/favicon.ico`, not an application API or authorization request. No mutation workflow was exercised.

The managed desktop browser-control tool was unavailable, so the documented cloud-desktop fallback used headless Chromium against the actual protected domain. Vercel bypass and Auth session material stayed in permission-restricted temporary files, was never printed, and was removed immediately after the checks.

### Final context-retirement rollback rehearsal

The owner approved a rollback-only Preview rehearsal of `20261121190000_permission_context_retirement.sql`. Fresh preflight confirmed the core and compatibility ledgers, absent final ledger, compatible API marker, two role arrays, 18 of 18 governed links and unchanged gates.

Inside the transaction, `get_context` used the final `legacy-retired-v1` marker, contained zero role arrays and omitted the operational-role flag. The core and compatibility ledgers remained present and the final ledger remained absent. All 18 governed links, 102 legacy grants and two legacy override rows remained; the browser discovery, operator mutation and obsolete override-execution revocations remained enforced; reconciliation remained at two explained mismatches and zero unexplained drift; and assessment, attendance and visit entry remained true, false and false respectively. The transaction ended with `ROLLBACK`.

The independent post-rollback read confirmed exact restoration of the installed compatibility state: `legacy-retired-compatible-v1`, two authoritative role arrays, operational role switching disabled, no final ledger entry, unchanged governed links and evidence counts, unchanged revocations, unchanged reconciliation and unchanged feature gates.

## Retention and rollback boundary

All legacy authorization rows, override rows, identifiers, indexes and original officer-assignment foreign-key values are retained indefinitely as historical and rollback evidence. This migration drops no legacy data. Archival or deletion requires a later explicit decision, a defined recovery window and a rehearsed backup restoration.

Rollback is a reviewed forward migration, not a rewrite of `20261121180000`. Before Preview installation, preserve the preflight catalog, function definitions, ACLs, row counts and reconciliation result. An immediate rollback can restore the prior function definitions and ACLs while leaving the additive governed link in place. It must abort if any post-cutover officer assignment has a null legacy link, because fabricating a legacy grant is prohibited. No officer-assignment administration should occur during the Preview migration acceptance window.

## Local validation

- `npm run lint -- --no-cache`
- `npm run check`
- `npm test` — 141 frontend assertions and 27 workflow/removal checks
- `npm run web:typecheck`
- `npm run test:web` — 211 assertions
- `npm run build`
- `npm run test:staff-access` — 16 governed hierarchy and retirement assertions
- `npm run test:sql:portable` — Phase 8 migration, activation seal, 1,440 calculation cases and permission security checks
- `npm run test:activation` and all four `npm run test:attendance` suites pass.
- `npm run test:directory` still stops at `current centre scope includes current student identity`. The same failure reproduces from an isolated archive of starting commit `def58f6`; Phase 8 does not change that baseline directory behavior.
- `npm audit --audit-level=high` reports no high-severity finding. Four transitive ESLint/minimatch findings remain moderate with no published fix.

## Preview gates still required

1. Owner approval for persistent Preview installation of final response retirement migration `20261121190000` and its canonical ledger entry.
2. Repeat signed-in context checks, direct API denial checks and fresh zero-unexplained-drift reconciliation.

