# Registration, attendance metadata and centre-wide events

## Requested behaviour

Aashini authorised these changes on 11 November 2026:

- Install the pending Notes, Holiday and edit-attribution database update.
- Enable registration and activity entry for existing authorised operational roles.
- Record one MM and four planned activities per centre per month, shared by both shifts.
- Keep individual participation separate from classroom attendance and the >20-day rule.

## Implementation

- Reuse the existing event/participation tables. No extra programme tables or staff grants.
- Extend event scope to Both shifts. Participation retains each child's actual enrolment, centre and shift foreign key.
- Add event kind: Activity or Monthly meeting. Existing records retain their identities, dates, shifts, values and revisions.
- Prevent duplicate active MM records in a centre/month and duplicate active centre-wide activities by centre/date/name. Four activities is a monthly plan, not a cap on observed events.
- Mark a mistaken event Cancelled after clearing any participation. Keep its audit history; a replacement can then be recorded. Do not silently change a historical event's date or centre.
- Only Held events accept new participation through the frontend. A held event cannot be in the future. Unknown remains unknown; only changed answers are saved.
- Include centre-wide activities in the existing reviewed participation calculations, including shift-filtered reports. Exclude MM from activity metrics and classroom attendance.
- New classroom entry offers A/P/H. Historical MM/L/WO remain unchanged. New v3 register saves reject MM.
- Add an Activities-page centre table: recorded held activities / monthly plan 4, recorded held MM / monthly plan 1. Centre event totals are independent of student grade/gender/shift filters. Zero is explicitly 'none recorded', not proof of no delivery.
- Add MM entry alongside activity entry. The participation roster includes both shifts. Leadership stays read-only.
- Activation is separate SQL, limited to registration and activities. It removes only the activities hard-off restriction and records changes in the existing immutable activation log. Unrelated gates, identities and centre grants remain unchanged.

## Hosted installation order — not executed yet

Supabase is not connected in this chat. No hosted installation or activation is claimed.

1. Inspect hosted migration receipts and exact function definitions. Reconcile installed versions before applying anything; never replay old migrations or use a blind db push.
2. Fingerprint existing programme rows, grants and activation state; capture a provider backup according to the project's existing release procedure.
3. Apply `20261110120000_attendance_register_metadata.sql` through the provider's transactional migration operation if absent. This is the existing PR16 pending update.
4. Apply `20261111120000_centre_wide_events.sql` through the provider migration operation. Confirm expected predicates, preserved rows/RLS and original role scope.
5. Apply `supabase/configuration/2026-11-11-registration-activities.sql` once. It is repeat-safe and leaves other controls unchanged.
6. Verify capabilities, H support, actor labels, new entry controls, and actual scope with existing authorised staff identities. Use approved test records only, or genuine user-entered observations. No fake programme observations for testing.

If a migration fails, its transaction rolls back. After real new centre-wide events are recorded, do not reverse to the old shift-only foreign key or delete them to force rollback. Disable the two newly activated features if needed and fix forward after inspection.

## Validation

- Frontend unit/workflow checks, syntax, lint and build.
- Isolated database tests cover installation rollback, old-value preservation, duplicate protection, both shifts, invalid dates, stale revisions, activation replay, registration, foreign-centre and Leadership denial, MM separation and retained cancellation history.
- Existing attendance metadata, staff-access, 1,440 calculation cases and activation/provider rehearsal remain release checks.
- Browser acceptance adds activity/MM creation, both-shift roster, participation save, unchanged classroom marks and registration through the form, using a disposable synthetic database.

Results and the exact preview commit are recorded in PR17 after CI completes. Synthetic checks do not prove hosted installation.
