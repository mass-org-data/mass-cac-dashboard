# Permission architecture Phase 5: destructive workflows

**Date:** 19 November 2026  
**Branch:** `fix/permission-architecture`  
**Database:** Preview `nilzfsahxoxibvrwsqkd` only  
**Production:** unchanged

## Result

Migration `20261119150000_permission_destructive_workflows.sql` adds narrow server APIs for:

- Leadership-only student deletion preview and confirmed physical cascade;
- individual attendance deletion, alongside the existing whole-register deletion;
- individual assessment deletion and explicit register deletion, including historical registers whose exact observed date is unknown;
- Cluster Officer-or-higher visit deletion inside governed centre scope.

The browser still receives no direct table delete privilege. Every successful new deletion requires a reason, current version or preview token, and idempotent request ID. An immutable private receipt retains identifiers and counts only; it does not copy student names, attendance marks, scores, visit feedback or other deleted fact payloads.

Student deletion enumerates the reviewed dependency graph and fails before deletion if a new foreign-key dependency is introduced. Dependents are removed in one transaction. Shared activity events, programme cohorts and calendar records are retained. Import provenance and the existing minimized system audit remain retained evidence rather than operational student records.

## Release controls

- A new `student_deletion` activation feature was installed disabled.
- Attendance and assessment deletion follow their existing entry gates.
- Visit deletion follows the existing visit-entry gate, which is currently disabled on Preview.
- Phase 6 must add the impact dialogs, permanence warning, reason/confirmation controls and post-delete refresh behavior before student deletion is enabled.

## Validation

- Full fresh PostgreSQL 17-compatible replay and activation seal passed.
- The isolated destructive-workflow suite passed direct-delete denial, role/scope checks, stale tokens, unexpected dependency rollback, student atomicity, shared-object retention, individual attendance deletion, individual/unknown-date assessment deletion, cross-CO visit deletion, retry idempotency and receipt privacy.
- Existing 1,440 reviewed calculation cases passed unchanged.
- `npm run check` passed.
- `npm test` passed: 137 frontend tests and 27 workflow/removal checks.
- Preview dry-run completed in a rolled-back transaction before installation.
- Preview postflight: one ledger row, seven API functions, forced RLS on receipts, fixed definer search paths, authenticated-only execution, all reviewed guards extended, zero deletion receipts, and student deletion disabled.
- Non-destructive direct RPC probes: anonymous student preview 401; Teacher student preview 403; Leadership nonexistent-student preview reached the API and returned 400; Leadership student delete 403 while disabled; Teacher visit delete 403.
- Read-only Production postflight confirmed no Phase 5 ledger row, functions or receipt table.

No live Preview record was deleted during hosted verification.
