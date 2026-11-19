# Permission architecture migration plan

**Status:** Implementation authorized for a new `fix/` branch and Preview database only; Production remains unchanged

**Prepared:** 18 November 2026

**Implementation branch:** `fix/permission-architecture`

**Repository baseline:** `staging` at `5dcedd7`

**Hosted scope:** Preview Supabase `nilzfsahxoxibvrwsqkd` and branch Preview deployment only

## 1. Objective

Replace the current independent, multi-role, centre-grant model with one explicit hierarchy:

```text
Teacher -> Cluster Officer -> Leadership
```

The resulting system must have these properties:

- one application role per user;
- no role switcher or assumed-role UI;
- Cluster Officer inherits Teacher capabilities;
- Leadership inherits Teacher and Cluster Officer capabilities;
- Leadership automatically covers every current and future centre;
- Teachers and Cluster Officers operate only in centres with active assignments;
- assignment status, not assignment dates, determines authorization;
- inactive users and inactive assignments lose access immediately;
- authorization remains enforced by PostgreSQL/RPCs, not by hidden controls;
- Leadership is the only role with built-in export capability;
- destructive actions use server-generated impact previews, explicit confirmation, audit receipts and transactional deletion.

The owner authorized implementation, branch Preview deployment, and changes to the Preview database only. This does not authorize a pull request, merge, Production frontend deployment, Production database change, or Production Auth/configuration change.

### Implementation progress

- Phase 1 deployed to Preview in `20261118120000_permission_governance_foundation.sql`: private forced-RLS user/assignment records, deterministic backfill and candidate authorization helpers. Existing runtime authorization remains authoritative.
- Phase 2 deployed to Preview in `20261118130000_permission_scope_reconciliation.sql`: trusted dual-read comparison and a mandatory drift assertion.
- Phase 3 deployed to Preview in `20261118140000_permission_read_cutover.sql`: governed centre reads, one-role context, current-student identity scope and reviewed SECURITY DEFINER read corrections. Legacy write authority remains until Phase 4, intersected with governed active status/scope. Postflight found three reconciled users, zero role/status/centre mismatches and no anonymous or service-role execution of the governed context API. Production remains unchanged.
- Phase 4 is implemented in `20261119120000_permission_write_cutover.sql`: governed hierarchical writes, creation/correction parity, Leadership global operational writes, CO-or-higher visit authority, retired operational overrides and coherent attendance release controls.
- Phases 5–8 remain pending.

## 2. Approved business rules

### 2.1 Users and roles

- Valid roles remain `Teacher`, `Cluster Officer`, and `Leadership`.
- Each user has exactly one role.
- A Teacher normally has one centre assignment. The database will enforce at most one active Teacher assignment.
- A Cluster Officer may have multiple active centre assignments.
- Leadership has global centre access and no centre assignments.
- Role switching will be removed from both interfaces.
- The current `staff_operational_access` exception will be retired.

### 2.2 Assignments and account state

- Keep `starts_at` and `ends_at` as administrative history.
- Add an explicit Active/Inactive assignment state and use that state for authorization.
- Dates do not silently grant or revoke access.
- Marking an assignment inactive removes its centre from subsequent reads and writes immediately.
- Marking a user inactive removes all application access immediately and disables the Supabase Auth account.
- Previous assignments may be shown to Leadership in a later admin UI but never provide current record access.

### 2.3 Operational inheritance

- Teacher: CRUD within the one active assigned centre, subject to record-specific validation.
- Cluster Officer: Teacher capabilities across all active assigned centres, plus visit management.
- Leadership: all Teacher and CO capabilities across all centres, plus user, role, assignment, deletion and export administration.
- COs may correct Teacher-created attendance and assessment data within their assigned centres.
- COs may edit their own visit records.
- COs may delete any visit associated with an assigned centre, regardless of creator.

### 2.4 Student identity and history

- Anyone with operational access to a centre may see student names for currently enrolled students in that centre.
- Remove `can_read_profiles` as a separate application permission.
- Former students do not remain visible merely because they previously attended the centre.
- A staff member moving centres loses access to records in the former centre.
- Gender and board-result fields do not need the same privacy boundary as student names.

### 2.5 Exports

- Only Leadership receives built-in CSV/export functions.
- No additional approval is required for a Leadership export.
- This is an application capability, not a promise that readable data cannot be copied manually. A user who can view paginated data can technically transcribe or automate those reads; the server can deny official bulk-export endpoints but cannot make visible information non-copyable.

### 2.6 Deletion and correction

- Create and correction authority are the same.
- Attendance supports individual-mark deletion and whole-register deletion.
- Assessments support individual-result deletion and whole-register/batch deletion.
- Student deletion is Leadership-only and permanently deletes the child, all enrolments and all dependent operational records after a server-generated impact preview and explicit confirmation.
- The deletion preview must list counts by dependent record type.
- Shared centre records are not student-owned and must not be removed with a student. For example, delete a student's activity participation, not the shared activity event; delete their attendance marks, not a centre holiday/session row used by other students.
- A minimal immutable deletion receipt will remain after physical deletion. It will contain actor, time, reason, deleted student identifier, confirmation token and counts by record type, but no retained name or copy of deleted programme facts.

## 3. Target authorization model

### 3.1 New canonical user record

Add a private forced-RLS table such as `mass_core.application_users`:

| Field | Purpose |
| --- | --- |
| `user_id` | FK to `auth.users.id`; one application user per Auth account |
| `role_code` | Exactly one of the three approved roles |
| `status` | `Active` or `Inactive`; the primary application-access switch |
| `starts_at`, `ends_at` | Administrative history, not authorization predicates |
| `approved_by`, `approved_at` | Leadership/admin provenance |
| `row_version` | Concurrency control |

Do not put the programme role in user-editable Auth metadata. Supabase Auth establishes identity; the application table remains the role authority.

### 3.2 New centre-assignment record

Replace role-bearing `user_scope_grants` with a role-neutral assignment table such as `mass_core.user_centre_assignments`:

| Field | Purpose |
| --- | --- |
| `id` | Stable assignment identity |
| `user_id` | Application user |
| `centre_id` | Assigned centre |
| `status` | `Active` or `Inactive`; authorization source |
| `starts_at`, `ends_at` | Historical record only |
| `approved_by`, `approved_at` | Provenance |
| `row_version` | Concurrency control |

Constraints:

- Leadership may not have active centre-assignment rows.
- Teacher may have at most one active assignment, enforced with a transactional guard because the user's role is stored in the parent table.
- CO may have multiple active assignments.
- An assignment cannot be activated for an inactive user.
- Rows are retired/inactivated rather than overwritten, preserving assignment history.

### 3.3 Canonical authorization helpers

Replace the current overlapping predicates with a small reviewed set:

- `current_application_user()` - returns the active application user for `auth.uid()`, otherwise raises/returns no access.
- `current_role()` - returns the one server-authoritative role.
- `role_at_least(required_role)` - compares the fixed hierarchy.
- `assigned_to_centre(centre_id)` - true for Leadership or an active assignment.
- `can_read_centre(centre_id)` - active user plus assigned/global scope.
- `can_write_centre(centre_id)` - same centre rule; record-specific RPCs decide supported operations.
- `can_manage_users()` - Leadership only.
- `can_export()` - Leadership only.
- `can_delete_student()` - Leadership only.
- `can_manage_visit(visit)` - edit requires own visit or Leadership; deletion permits CO with assigned centre or Leadership.

Every helper must remain server-owned, have `search_path=pg_catalog`, use qualified names, and receive no PUBLIC/anon/service-role execution widening.

### 3.4 Remove obsolete mechanisms

After cutover and validation, retire:

- multiple role rows in `user_scope_grants`;
- frontend role selection;
- the global Leadership write veto;
- `staff_operational_access` and its visit-entry exception;
- `can_read_profiles` and the separate private-profile grant flag;
- page-specific checks such as `role === 'Leadership'` where a capability should be used;
- any dependency on assignment dates for runtime access.

Do not remove historical source/audit data merely because the authorization mechanism is retired.

## 4. Supabase Auth and immediate deactivation

Supabase's supported administrator interface provides `ban_duration`; it does not provide a browser-safe application `active` field. Auth administration must run on a trusted server and must never expose a service-role key to the browser.

Recommended design:

1. Add a Supabase Edge Function dedicated to Leadership user administration.
2. Verify the caller's JWT.
3. Ask the database whether the caller is an active Leadership user.
4. For deactivation, first set `application_users.status='Inactive'` through a protected database function. This immediately makes all programme RPCs fail even while an old access token remains cryptographically valid.
5. Use the server-side Supabase Auth Admin API to ban the Auth user and revoke available sessions/refresh tokens.
6. Record success/failure in an immutable administration event.
7. If the Auth call fails after database deactivation, keep application access denied and expose the incomplete Auth step to Leadership for retry. Never roll application access back to Active automatically.
8. The browser's 30-second verification should be shortened or supplemented by authorization-failure handling so the current session is cleared as soon as the next request is rejected.

Reactivation reverses the sequence carefully: unban Auth first, then activate the application user only after Auth succeeds.

Also disable public email signup in the Production and Preview Supabase Auth configuration. New users must be created by the trusted server-side Admin API workflow.

## 5. Database migration sequence

All work must be additive and append-only. Do not edit or replay historical migrations.

### Phase 0 - Freeze and map current identities

- Refresh GitHub, Vercel and both Supabase projects.
- Take a verified Production backup before destructive-schema preparation.
- Export a private, identifier-safe mapping of current Auth users, grants, overrides, directory identities and officer assignments.
- Produce an owner-reviewed mapping from every current user to exactly one target role.
- Proposed default for the three override accounts: Leadership, because Leadership will inherit operational capabilities. Confirm this mapping in the private migration plan before applying data changes.
- Resolve the current CO account that spans 92 centres and the Teacher-only account explicitly; do not infer assignments from names or directory rows.

### Phase 1 - Add the new model without changing behavior

- Add `application_users`, `user_centre_assignments`, administration events and deletion receipts.
- Force RLS on all new tables.
- Add owner/admin policies and revoke anon/authenticated/service-role direct access.
- Add the new helper functions but leave existing RPCs using the old helpers.
- Add consistency checks and indexes.
- Backfill Preview from a reviewed synthetic/current-grant mapping.

### Phase 2 - Dual-read verification

- Build a read-only reconciliation function/test that calculates old and new effective centre scopes for every user.
- Require exact parity for Teacher/CO centres during the transition, except for approved corrections such as reducing a Teacher to one centre.
- Verify Leadership resolves to all centres without assignment rows.
- Do not let both models independently grant access. During dual-read, the old model remains authoritative while the new model is measured.

### Phase 3 - Replace read authorization

- Update `get_context` to return one role, active status, derived centres and capability booleans.
- Update RLS policies and read RPCs to use `can_read_centre`.
- Make child/profile visibility depend on a current active enrolment in an accessible centre, except Leadership global access.
- Remove historical-enrolment authorization from `can_read_child`/`can_read_profile` behavior.
- Review every SECURITY DEFINER read to ensure identifiable fields use the same centre/user predicate.
- Specifically correct the current `student_profile_page_v3`, attendance roster and Preview `dashboard_table_page` inconsistencies.

### Phase 4 - Replace write authorization

- Update operational RPCs to use the new user status, role hierarchy and active assignment rules.
- Remove the Leadership veto and operational override branches.
- Enable correction wherever creation is allowed, retaining version and idempotency checks.
- Keep domain-specific validation: valid enrolment, centre ownership, immutable parent relationships, date bounds and audit reason requirements.
- Preserve feature gates only as release controls, not user-permission mechanisms.
- Consolidate the attendance-register control with the feature-gate presentation so administrators see one coherent capability status.

### Phase 5 - Destructive workflows

Implement deletion as narrow RPCs, never direct table DELETE privileges.

#### Student deletion

1. `preview_student_deletion(child_id)`:
   - Leadership only;
   - locks or versions the child graph consistently;
   - returns counts for profiles, enrolments, attendance, assessments, participation, cohort memberships, Morarji outcomes, academic profiles/revisions, registration receipts and other dependent rows;
   - identifies shared objects that will remain.
2. UI displays the count by type, plain-language permanence warning, reason field and typed confirmation.
3. `delete_student_cascade(request_id, child_id, preview_token, reason)`:
   - Leadership only;
   - idempotent request ID;
   - verifies the preview token/version so records cannot change between preview and deletion unnoticed;
   - deletes dependents in one transaction in reviewed order;
   - leaves one immutable non-PII deletion receipt;
   - fails entirely if any unexpected dependent type exists.

This requires replacing selected `ON DELETE RESTRICT` constraints and immutable delete triggers. Prefer an explicit procedure over blanket `ON DELETE CASCADE`, because the procedure can enumerate, authorize, audit and fail on an unreviewed new dependency.

#### Attendance deletion

- Keep audited whole-register deletion.
- Add individual attendance deletion with the same reason, version, request-token and immutable-receipt rules.
- CO and Leadership can delete records within their effective centre scope; Teacher within the one active centre.

#### Assessment deletion

- Add individual-result and defined register/batch deletion.
- The register key must be explicit: centre, shift, assessment definition/round and observed date where known.
- Never interpret a missing historical observed date as a fabricated date.
- Apply the same scope, version, reason, idempotency and receipt requirements as attendance.

#### Visit deletion

- Teacher: denied.
- CO: any visit whose centre is actively assigned to that CO.
- Leadership: any visit.
- Keep correction/edit author-only for CO; Leadership inherits administrative correction capability.
- Require a reason and preserve a minimal deletion receipt. Do not expose deleted private notes in the receipt.

### Phase 6 - Frontend cutover

For the React interface and maintained `/vanilla/` fallback:

- remove the role selector and role-specific review-view controls;
- consume one server role and capability map;
- generate navigation from capabilities, while keeping backend enforcement authoritative;
- remove Leadership-only read-only wording;
- allow Leadership all operational screens and full visit details;
- restrict Student profiles to currently enrolled students in the effective centre scope;
- remove `can_read_profiles` branching;
- remove CSV/export buttons for Teacher and CO;
- keep Leadership exports backed by an explicitly Leadership-gated server export mode;
- add deletion impact dialogs and confirmation flows;
- on any inactive-user/assignment authorization failure, clear cached data and terminate the local session;
- never retain data from the previous centre/role in memory after a scope change.

### Phase 7 - User administration backend

Build protected APIs first; the full admin UI may follow separately.

- create/invite user;
- assign the one role;
- activate/deactivate user;
- create/inactivate centre assignments;
- list assignment history;
- validate Teacher one-centre and Leadership no-centre rules;
- ban/unban the corresponding Auth account;
- log every administrative change.

Until the Leadership admin UI is approved, these APIs remain unavailable to ordinary browser navigation and administration continues through a separately authorized operator workflow.

### Phase 8 - Retire the old model

Only after Preview acceptance and new-model parity:

- stop writing `user_scope_grants`;
- remove old helper dependencies;
- revoke obsolete function execution;
- remove old policies in a new migration;
- archive or rename old tables only if needed for rollback evidence;
- do not drop old authorization data until the agreed recovery window has passed and a backup restoration has been rehearsed.

## 6. Required test matrix

### Roles and inheritance

- one role per active user;
- invalid/duplicate role states rejected;
- Teacher limited to one active centre;
- CO accepts multiple active centres but rejects unassigned centres;
- Leadership automatically reads/writes new centres without assignment rows;
- no role-switch route, state or request parameter can elevate a user.

### Immediate revocation

- inactive assignment rejects the next read and write with an existing JWT;
- inactive user rejects every application RPC with an existing JWT;
- UI clears cached records and signs out after rejection;
- banned Auth user cannot sign in or refresh;
- Auth-admin failure leaves application access inactive and produces a retryable admin event.

### Direct API attacks

- forged centre ID;
- foreign child/enrolment/event/membership/visit ID;
- mixed authorized/unauthorized centre arrays;
- direct RPC call to a hidden page;
- Teacher/CO attempt to call export mode;
- Teacher/CO attempt Leadership user administration;
- anonymous and service-role contract probes;
- all SECURITY DEFINER functions checked for owner, ACL and `search_path`.

### Historical access

- inactive former assignment reveals no old centre records;
- former student is absent from Teacher/CO profile/search/export results;
- current staff can still view authorised historical facts for students currently enrolled, where the report contract requires them;
- Leadership retains global visibility.

### Destructive actions

- impact preview counts every dependent type;
- stale preview token prevents deletion;
- unexpected dependency prevents partial deletion;
- student deletion is atomic;
- shared activity/calendar records survive student deletion;
- individual and register attendance deletion;
- individual and batch assessment deletion;
- CO may delete another CO's visit in an assigned centre but not edit it;
- deletion receipts contain no deleted names, notes or fact payloads;
- retrying an accepted deletion request is idempotent.

### Export

- export controls absent for Teacher/CO;
- direct export/bulk RPC denied for Teacher/CO;
- Leadership export respects current filters and stable ordering;
- CSV formula-injection protection remains enabled;
- exports never use service-role credentials.

## 7. Preview and release process

1. Implement on a new `codex/` feature branch from the latest intended `staging` baseline after refreshing GitHub state.
2. Use small logical commits and one ready PR targeting `staging` only when requested.
3. Apply additive migrations to Preview only after separate approval for each database change.
4. Backfill only synthetic Preview identities/data first.
5. Run the full repository gate plus new direct PostgREST and browser authorization tests.
6. Perform manual acceptance with one Teacher, one CO and one Leadership account, including inactive-session tests.
7. Reconcile every current Production user to the approved one-role mapping before Production release.
8. Take and verify a Production backup and rehearse recovery for destructive schema changes.
9. Use a gated, one-migration-at-a-time Production release with ledger and postflight checks.
10. Do not deploy the frontend until the compatible database functions and Auth administration backend are installed and verified.
11. Keep a bounded rollback window in which the old grant data is preserved but no longer authoritative.

## 8. Security invariants

- No service-role or secret key in browser bundles, runtime config, logs or source control.
- No direct authenticated INSERT/UPDATE/DELETE grants on programme tables.
- All application and administration tables use enabled and forced RLS.
- Every definer has a non-login, non-bypass owner and fixed `search_path=pg_catalog`.
- Every centre-array RPC rejects the entire request if one centre is unauthorized.
- Leadership authority is derived from the one application role, not a caller-supplied parameter.
- User/assignment inactivity is checked on every protected request.
- Physical deletion is possible only through reviewed, record-specific RPCs.
- Audit/deletion receipts are immutable and minimally identifying.
- UI visibility is never treated as authorization.

## 9. Expected code areas

### Database

- new append-only migrations under `supabase/migrations/`;
- revised activation sealing/classification for new RPCs;
- compatibility preflight/postflight and schema catalog expectations;
- synthetic fixtures and direct authorization/deletion tests.

### Shared/live frontend

- `src/live/role-data.js`;
- `src/live/original-review.js`;
- `src/live/original-actions.js`;
- `src/live/api.js`, `reads.js`, capability discovery and session cleanup;
- legacy navigation, exports, student/attendance/assessment/visit dialogs.

### React interface

- `web/src/session/controller.ts` and backend contracts;
- `web/src/app/App.tsx`, `SideMenu.tsx`, `UserMenu.tsx`;
- Attendance, Profiles, Assessments, Visits, Morarji and donor/export pages;
- table service export mode;
- new destructive-confirmation components;
- later Leadership administration screens.

### Trusted Auth administration

- new Supabase Edge Function source and deployment configuration;
- server-only Auth Admin client;
- leadership verification and administration-event logging;
- no Vercel/browser service key.

## 10. Definition of done

The migration is complete only when:

- every user has one active or inactive application-user record and no ambiguous role union;
- Teacher/CO centre access comes only from active assignments;
- Leadership requires no centre grants and covers newly created centres automatically;
- old role switching and operational overrides are gone;
- inactive assignments and users fail immediately with existing tokens;
- Auth accounts are banned/unbanned through the trusted admin workflow;
- identifiable student data follows the approved current-enrolment scope;
- creation and correction authority are aligned;
- approved individual/register/cascade deletion workflows pass atomicity and audit tests;
- only Leadership can use official exports;
- direct API security tests pass for every role and cross-centre scenario;
- Preview acceptance and controlled Production postflight establish the same effective permissions;
- the owner separately authorizes the Production migration and frontend cutover.
