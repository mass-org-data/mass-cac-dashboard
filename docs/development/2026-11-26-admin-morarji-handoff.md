# Admin and Morarji Development Handoff

Date: 26 November 2026  
Branch: `feature/admin-morarji-ui`  
Base: `fix/vercel-feedback-round-3` at `e421afc`  
Pull request target: `staging`

## Objective

Implement the Admin and Morarji changes in no more than three reviewable phases while preserving the existing authorization, audit, concurrency, idempotency and historical-record protections.

Do not resolve or reopen Vercel comments. Do not mutate Production, merge, promote, or apply hosted database changes without the approvals required by `AGENTS.md`.

## Phase 1 — Schema, APIs and authentication

### Account provisioning

- Replace new email invitations and Auth-account linking with direct account creation through the trusted Leadership administration service.
- Use an email-shaped Login ID as the Supabase Auth username. It may be synthetic and does not need a functioning mailbox.
- Let the administrator enter a password or generate a cryptographically random 16-character password. Confirm the Auth identifier without sending email.
- Add a required display name for new accounts. Existing accounts may temporarily display their Login ID when no name is stored.
- Never persist, log or return plaintext passwords after the one-time credentials dialog closes.
- Support administrator password reset and authenticated self-service password change.
- On administrator reset, clear the account's admitted application sessions so old sessions fail application authorization even while an already-issued stateless access token has not expired.
- Remove Invite and Link controls and reject new invite/link operations. Preserve immutable administration history and keep compatibility for already-issued invite links during this release.
- Preserve role rules, centre assignments, self-role/self-deactivation protection, optimistic versions, idempotent request IDs and retry handling.

### Centres, donors and academic years

- Add `Active`/`Inactive` status and row-version support to centres and donors. Never permanently delete either entity.
- Inactive centres remain available in historical reporting filters with an `Inactive` label, but are excluded from new-record, staff-assignment and operational selectors.
- Deactivating a centre atomically ends its active staff assignments while retaining their history.
- Add academic-year status with exactly one Active year. Initialize the year containing the migration date as Active and all other configured years as Inactive.
- Inactive academic years remain available in report filters. Block new enrolments, registers, assessments, visits, sessions and Morarji memberships in them, while allowing authorized corrections to records that already exist.
- Add an effective per-year centre-to-donor assignment table with one donor per centre and academic year.
- Seed every configured academic year from each centre's existing donor association, as explicitly approved by the owner. Future donor changes affect only the selected academic year.
- Update donor reporting to resolve the donor from the report's selected academic year.
- Extend the trusted Leadership administration service with audited, versioned centre, donor, academic-year and donor-assignment operations. Do not expose direct browser table mutations.

### Morarji data model

- Replace cohort membership immediately with direct academic-year membership.
- Backfill membership years from `programme_cohorts.academic_year_id`. Abort if a cohort lacks an academic year or if the conversion would give one child duplicate membership in the same year.
- Enforce one Morarji membership per child and academic year, update all reads/reports/writes/audit definitions, then remove the cohort foreign key and `programme_cohorts` table.
- Permanently remove `school_name` and its existing values from the UI, exports, APIs and schema, as explicitly approved by the owner.
- Continue using `children.id` as the stable relational child identifier. The generated display `student_id` is never a foreign key. Profile tables retain their own UUID primary keys and unique child relationships.

## Phase 2 — Admin UI

Rename `8. User administration` to `8. Admin` and add four localized tabs using existing components and design tokens.

### User Management

- Show Display Name, Login ID, Role, Status, Assigned Centres and Actions.
- Support create, edit, role/assignment changes, reset password, deactivate and reactivate.
- Keep Teachers limited to one active centre, Cluster Officers scoped to assigned centres and Leadership without centre assignments.
- Show credentials once after create/reset with a Copy Credentials action, then erase them from client state when the dialog closes.
- Add Change Password to the signed-in user menu and reauthenticate with the current password before updating it.

### Centre Management

- Provide a searchable, sortable table with name, status, selected-year donor and assigned staff.
- Support add, edit, deactivate and reactivate; never delete.
- Confirm deactivation and explain that assignments will end while historical records remain.

### Donor Management

- Provide a searchable, sortable table with donor name, status and centre assignments for the selected academic year.
- Support add, edit, deactivate/reactivate and year-specific centre assignment management; never delete.
- Inactive donors remain visible historically but cannot receive new assignments.

### Academic Year Management

- Show start/end dates, Active/Inactive status and actions.
- Add future April–March years together with their four assessment periods.
- `Set Active` atomically deactivates the previous year.
- Never delete years or automatically promote students. Explain that inactive years remain reportable and permit corrections only.

## Phase 3 — Morarji UI

- Replace Cohort with Academic Year throughout the interface.
- Add one paginated server-side Grade 5 roster for the selected academic year and authorized centres, left-joined to Morarji membership and outcome data.
- Default `Training students only` to on, showing students with `Applied = Yes`. Turning it off shows every Grade 5 student, including students without membership.
- Preserve student-name/ID search, sorting, CSV export and conditional Centre-column visibility.
- Use one-click three-state controls cycling `Not recorded → Yes → No → Not recorded`.
- Show Appeared only when Applied is Yes. Show Passed only when Appeared is Yes.
- When changing a parent value would hide saved downstream values, warn on Save and require confirmation before clearing them to Not recorded.
- Saving an all-students row with Applied=Yes atomically creates the academic-year membership and outcome. Corrections retain optimistic version checks.
- Allow Teachers to edit Grade 5 records only for their assigned centre. Remove the frontend Teacher exclusion without weakening centre-scoped backend authorization.
- Do not implement non-CAC intake or Morarji training attendance. Add a reminder in `AGENTS.md` and the release record to confirm both requirements with the client later.

## Validation and release

- Add migration tests for backfills, conversion collisions, one Active year, per-year donor uniqueness, inactive-write guards, correction exceptions and permanent school-column removal.
- Add administration tests for account creation, password reset/self-change, absence of email dispatch, password non-persistence, session invalidation, role/assignment rules, self-protection, concurrency and retries.
- Add Admin UI tests for all tabs, localization, sorting/search, status behavior, inactive historical visibility, responsive behavior and accessibility.
- Add Morarji tests for the default applied-only filter, all-Grade-5 toggle, academic-year isolation, three-state cycling, dependency confirmation, Teacher scoping and atomic creation/correction.
- Run the complete validation workflow in `AGENTS.md`, including web typecheck/tests, portable SQL, permission, student, attendance, API, build and browser suites.
- Apply reviewed migrations only to Preview Supabase `nilzfsahxoxibvrwsqkd`, after a fresh explicit approval.
- Visually verify Leadership, Cluster Officer and Teacher on the protected Preview.
- Open the finished pull request against `staging`. Do not merge, promote, act on Production or resolve Vercel comments.

## Copyable colleague prompt

```text
Continue development in the MASS CAC Dashboard repository on
`feature/admin-morarji-ui`.

Before changing anything:
1. Read AGENTS.md and this handoff document completely.
2. Fetch origin and verify the latest origin/staging state.
3. Preserve unrelated user-owned working-tree changes. Do not stage or commit
   `.gitignore` or `docs/releases/2026-11-23/` unless the owner separately asks.
4. Inspect current GitHub, Vercel and Preview Supabase state. Read-only
   inspection is allowed. Obtain explicit approval before every hosted
   database or control-plane mutation required by AGENTS.md.
5. Never resolve or reopen Vercel comments.

Implement the approved work in no more than three commits/phases.

PHASE 1 — Schema, trusted APIs and authentication
- Add Active/Inactive centre and donor status.
- Add Active/Inactive academic-year status with exactly one Active year.
- Keep inactive centres/years reportable but exclude them from new-record
  selectors and writes. Permit corrections to existing records in inactive
  years.
- End active staff assignments atomically when a centre is deactivated.
- Add per-academic-year centre-to-donor assignments, unique by centre/year.
  Backfill every configured academic year from the existing centre donor and
  update annual donor reporting to use the selected year's assignment.
- Extend the trusted Leadership service for centre, donor, year and assignment
  management with audit, idempotency and optimistic concurrency.
- Replace new invite/link provisioning with server-side Supabase Auth account
  creation using an email-shaped Login ID and an admin-provided/generated
  password. Confirm it without sending email. Add admin password reset and
  authenticated self-service password change. Never store or log passwords.
  Clear admitted application sessions on reset.
- Remove new Invite/Link UI and reject new invite/link requests while
  preserving audit history and already-issued invite-link compatibility.
- Replace Morarji cohort membership immediately with direct academic_year_id
  membership. Validate/backfill before removing cohort references and
  programme_cohorts. Enforce one child/year membership.
- Permanently remove Morarji school_name and all existing values.
- Preserve authorization, audit, idempotency, optimistic concurrency and
  retained-history boundaries.

PHASE 2 — Admin UI
- Rename `8. User administration` to `8. Admin`.
- Add localized User Management, Centre Management, Donor Management and
  Academic Year Management tabs.
- User Management: display name, email-shaped Login ID, role, status, centre
  assignments, create/edit/reset/deactivate/reactivate, one-time credentials
  display and self-service Change Password.
- Centre Management: add/edit/deactivate/reactivate, selected-year donor and
  assigned staff; no deletion.
- Donor Management: add/edit/deactivate/reactivate and year-specific centre
  assignments; no deletion.
- Academic Year Management: add future years and atomically set one Active
  year; no automatic student promotion or deletion.
- Reuse existing components, design tokens, responsive behavior and EN/Kannada
  localization.

PHASE 3 — Morarji UI
- Replace Cohort with Academic Year.
- Return a server-paged Grade 5 roster for the selected year and authorized
  centres, left-joined to membership/outcomes.
- Default `Training students only` on, showing Applied=Yes. Turning it off
  displays every Grade 5 student.
- Use three-state one-click controls cycling Not recorded → Yes → No → Not
  recorded.
- Show Appeared only when Applied=Yes and Passed only when Appeared=Yes.
- Confirm before clearing hidden downstream values.
- Atomically create membership/outcome when an all-students row is first marked
  Applied=Yes; version-check corrections.
- Allow Teachers to edit only their assigned centre by removing the frontend
  exclusion without weakening backend authorization.
- Remove School everywhere.
- Record that non-CAC intake and Morarji training attendance remain deferred
  pending client confirmation.

Identity rule:
- Use children.id as the stable child foreign key.
- Never use the generated display student_id as a relational key.
- Profile tables retain their own UUID primary keys and unique child constraints.

Validation and delivery:
- Add migration, security, API, React, accessibility and three-role browser tests.
- Run the complete validation workflow from AGENTS.md.
- Use only Preview Supabase `nilzfsahxoxibvrwsqkd`, after explicit approval.
- Produce a release record with migration order, rollback limits, security
  impact and visual-verification evidence.
- Open the completed PR against staging.
- Do not touch Production, merge, promote, or resolve Vercel comments.
```

## Locked owner decisions

- Login IDs are email-shaped and may be synthetic; no functioning mailbox is required.
- Passwords are shown once, never stored by the application, and can be reset or self-changed.
- Existing centre donors are assumed to apply to every already-configured academic year for initial backfill.
- Donor relationships are thereafter academic-year-specific.
- Morarji cohorts are removed in this release rather than retained as a compatibility layer.
- Existing Morarji school values are permanently deleted.
- Morarji controls use a three-state cycle.
- Dependency changes confirm and clear hidden downstream values.
- Centre deactivation ends active assignments.
- Inactive centres remain in historical reporting filters but not new-record selectors.
- Inactive academic years permit corrections to existing records but no new records.
