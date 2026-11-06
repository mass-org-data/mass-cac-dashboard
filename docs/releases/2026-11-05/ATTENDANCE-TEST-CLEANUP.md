# Five test attendance entries — completed cleanup

The user explicitly authorized removal of five Aralimatti attendance observations
dated 5 November 2026, inserted through the Teacher frontend between 20:11 and
20:17 IST. Insertion audits matched exactly two P, two A and one L, all revision 1,
from the approved Teacher identity, with no subsequent corrections/history.
No names, enrolment identifiers, private manifest or original row values are
published in this repository.

## Executed outcome

- Hosted provider receipt: `20261105150407`, name
  `mass_20261105_attendance_test_cleanup`. This is a one-use administrative
  operation, not a new general application migration to replay with db push.
- Attendance count: **47,328 → 47,323**. All five selected IDs are absent; no other
  attendance value changed. All original programme/import/audit relations were
  locked in stable order and fingerprinted inside the atomic transaction.
- All five original insertion audit rows remain unchanged. Five immutable private
  receipts retain original rows, insertion-audit hashes, reason, administrative
  principal, transaction, timestamp and approved manifest digest in
  `mass_maintenance.attendance_cleanup_20261105`.
- Existing 276 test-account grants remain byte-identical. The separately
  user-approved dedicated Teacher grant is retained. No account was changed.
- The approved centre's 5 November read API returns zero rows. November reviewed
  reporting returns P=0, A=0, L=0 and null percentage, preserving unknown coverage.

## Controlled mechanism

`scripts/maintenance/prepare_attendance_cleanup.py` is offline-only. It consumes a
private manifest of five exact rows, SHA256 row/audit fingerprints and the frozen
guard definition. It refuses an incomplete or different P/A/L distribution.

The normal guard rejected the earlier direct DELETE; the standard audit table
also intentionally allows only INSERT/UPDATE. The reviewed envelope therefore
creates separate private, forced-RLS cleanup receipts. Within the same transaction,
it adds a **specific guarded exception**, requiring the existing administrative
session, the exact original row and a same-transaction private receipt. No RLS,
trigger, audit constraint or replication protection is disabled; no app DELETE
grant or client-controlled bypass flag is introduced. Other rows still raise the
normal `55000` deletion error even while this exception exists.

A private, no-argument, invoker procedure creates the five receipts and deletes
only those five IDs, checking both affected counts. Before commit the original
guard definition and ACL are verified byte-for-byte restored. The procedure,
temporary helper and technical read policy/rights are removed. Only private
immutable receipts remain; there is no reusable deletion endpoint. The original
guard SHA256 is
`91bf5a52e6cb4765db48ba86b921bb0817cd80734d3772f49a3e9b926ce69e69`.

A deferred constraint verifies the provider adds exactly one matching migration
receipt in the same transaction. Missing receipt, later row history, fingerprint
drift, dependent relations, incorrect counts, timeout or unrelated-data changes
roll back the entire operation. Never retry the installed payload or change the
guard manually. Future cleanups require a separately reviewed request and manifest.

## Isolated verification

`npm run test:cleanup` runs PostgreSQL 17 WASM with existing migrations and
synthetic isolated fixtures, without a network or hosted data writes. Seven
scenarios passed before execution:

1. Missing atomic provider receipt rolls back deletion and all DDL.
2. Failure after deletion rolls back observations, receipts and guard changes.
3. Changed row hash rejects the entire cleanup.
4. Changed insertion-audit hash rejects the entire cleanup.
5. Unrelated ordinary deletion is denied during the exact-row exception.
6. Authenticated staff cannot execute the maintenance procedure.
7. Success removes exactly five, preserves other observations and original audit
   rows, restores the guard, makes receipts immutable/private and removes endpoints.

This is isolated SQL verification, not a native concurrent stress test.

## Browser status and continuing work

The earlier signed-in Teacher session displayed the existing app, both shifts and
the approved centre. Refreshing requires a fresh sign-in in the resumed browser.
The attempted sign-in returned the application's generic message, “Unable to sign
in or verify your session.” No credentials were read and no automated retry was
made. Post-cleanup chart display is therefore pending; direct hosted reporting
and read API results above are verified. Do not label the browser regression
complete based on those SQL checks.

Continue PR #2 with the Morarji membership fix intact. Additional Morarji dates/
outcomes, assessment absence/comments and follow-up storage remain outstanding.
Officer entry awaits verified dated Auth/directory assignments. Google Sign-In
remains last. No main merge or Production deployment occurred.
