# Permission Phase 8: legacy authorization retirement

**Prepared:** 21 November 2026  
**Branch:** `fix/permission-architecture`  
**Migration:** `20261121180000_permission_legacy_retirement.sql`  
**Hosted status:** local candidate only; Preview installation is not yet approved or installed  
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

1. Owner approval for an exact Preview rollback-only dry run of the migration plus activation seal.
2. Review the dry-run catalog, ACL, function, row-count, feature-gate and reconciliation evidence.
3. Separate owner approval for the committed Preview database transaction.
4. Separate owner approval for pushing the frontend commit and allowing a Vercel branch deployment.
5. Signed-in Teacher, Cluster Officer and Leadership acceptance plus direct API denial checks and fresh zero-unexplained-drift reconciliation.

