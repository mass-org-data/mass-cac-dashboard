# Permission architecture: remaining work and handoff

**Prepared:** 20 November 2026  
**Repository:** `mass-org-data/mass-cac-dashboard`  
**Working branch:** `fix/permission-architecture`  
**Completed implementation:** Phases 1–8 on Preview
**Remaining implementation:** separately gated Production release only; legacy-interface removal is implemented on the permission branch pending its Preview deployment record

> **22 November 2026 status:** This is a historical takeover plan. Phase 7 and Phase 8 are complete and accepted on Preview, public signup is disabled there, reconciliation has zero unexplained drift, and Production remains unchanged. The detailed current state is in `AGENTS.md` and the Phase 7/8 release records below.

## 1. Read this first

Before changing anything, read:

1. `AGENTS.md`, especially **Permission architecture Phases 1–6 (20 November 2026)**.
2. `docs/PERMISSION-ARCHITECTURE-MIGRATION-PLAN.md`.
3. `docs/releases/2026-11-20/PERMISSION-PHASE-6-FRONTEND-CUTOVER.md`.
4. Migrations `20261118120000` through `20261119180000` in `supabase/migrations/`.
5. The matching security tests under `tests/security/` and the portable replay in `tests/release/portable-sql.mjs`.

Fetch the remotes and inspect GitHub, Vercel and both Supabase projects before acting. The repository notes are a handoff snapshot, not proof of current hosted state.

## 2. Current position

Phases 1–6 are implemented and pushed on `fix/permission-architecture`. They establish:

- one application role per user: Teacher, Cluster Officer or Leadership;
- hierarchical capabilities: Teacher → Cluster Officer → Leadership;
- active-status-based users and centre assignments;
- one active centre maximum for Teachers, multiple active centres for Cluster Officers and global scope for Leadership;
- server-enforced read/write scope and Leadership-only official exports;
- narrow, audited and idempotent destructive workflows;
- a React interface with no role switcher and immediate local sign-out after authorization failure.

The migrations are installed on Preview Supabase only. Production is unchanged. No PR has been opened and the branch is not merged.

The latest recorded Preview activation state is:

| Feature | Preview state |
| --- | --- |
| Assessment entry | Enabled |
| Attendance entry | Disabled |
| Visit entry/deletion | Disabled |
| Student cascade deletion | Disabled |

Re-check these values before relying on them. Do not enable a feature as an incidental part of another change.

The legacy interface was deliberately not updated during Phases 1–8. Its separately approved removal is now implemented on the same permission branch without changing shared React integration modules.

## 3. Remaining work overview

| Workstream | Status | Requires hosted mutation? | Approval boundary |
| --- | --- | --- | --- |
| Phase 1–6 signed-in acceptance | Complete on Preview | Completed approved synthetic checks | Production remains separately gated |
| Phase 7 administration backend and UI | Complete on Preview | Preview database and trusted Edge Function | Production separately gated |
| Auth signup and account-disable configuration | Complete on Preview | Public signup disabled; admin lifecycle accepted | Production separately gated |
| Phase 8 retirement of legacy authorization | Complete on Preview | Three append-only migrations installed | Evidence retained; no legacy data deletion |
| Remove `/vanilla/` | Implemented, Preview verification pending | Frontend/build/routing only | No database or Production change |
| Production release | Not authorized | Production frontend, database and Auth | Requires a separate gated release approval |

## 4. Immediate takeover checks

- Confirm the branch is clean and compare it with `origin/fix/permission-architecture`, `staging` and `main`.
- Check whether a PR has been opened or any commits have landed since this handoff.
- Confirm the protected Vercel Preview is built from the expected branch and Preview Supabase project.
- Inspect the Preview migration ledger and installed function definitions; do not infer installation from repository files.
- Confirm Production does not contain the permission migrations or behavior unless a later approved release record says otherwise.
- Re-run the relevant local gates before new implementation.
- Use synthetic Preview identities and data only. Never print credentials or private student information.

## 5. Acceptance of Phases 1–6

Complete signed-in acceptance with Teacher, Cluster Officer and Leadership accounts before retiring the old authorization model.

### Teacher

- Has one server-selected role and no role-switch control.
- Can read and write only within the one active assigned centre, subject to activation gates.
- Cannot query a foreign centre through direct table/RPC requests.
- Cannot invoke export-sized server reads.
- Loses access on the next request when the user or assignment becomes inactive; cached information is cleared and the browser signs out.

### Cluster Officer

- Sees every active assigned centre and no unassigned centre.
- Inherits Teacher operations within those centres.
- Can see and delete any visit in an assigned centre, even when another CO created it.
- Cannot edit another CO's visit where the author-only correction rule applies.
- Cannot invoke Leadership export or administration functions.

### Leadership

- Has global access without centre-assignment rows, including centres created later.
- Inherits operational Teacher and CO capabilities.
- Can use official exports.
- Can preview the full student-deletion impact and use the deletion workflow only when its release gate is explicitly enabled.

### Direct security probes

- Anonymous programme access fails.
- A malicious authenticated user cannot elevate role, forge centre scope, pass a foreign parent ID or mix authorized and unauthorized centre arrays.
- Existing JWTs do not bypass inactive user/assignment status.
- SECURITY DEFINER ownership, ACLs and `search_path` remain sealed.
- Deletion receipts contain no deleted name, private notes or copied programme facts.

Record acceptance evidence without exposing account credentials or private data.

## 6. Phase 7: user administration backend

Build and test the protected administration boundary before adding ordinary browser navigation.

### 6.1 Database administration API

Add reviewed, narrowly scoped functions for:

- listing application users and their current role/status;
- listing current and historical centre assignments;
- creating the application record for a newly invited Auth user;
- assigning exactly one role;
- changing a role while enforcing Teacher/CO/Leadership assignment invariants;
- activating and deactivating an application user;
- creating and inactivating centre assignments;
- rejecting a second active Teacher assignment;
- rejecting active assignments for Leadership;
- rejecting assignment activation for an inactive user;
- retaining `starts_at` and `ends_at` as administrative history only;
- optimistic concurrency/version checks; and
- immutable administration events for actor, action, subject, time, outcome and non-secret error state.

The browser must not receive direct table privileges. Every administration function must require an active Leadership caller, use qualified objects and a fixed safe `search_path`, minimize returned personal data and remain unavailable to `anon` and `service_role` through PostgREST grants.

### 6.2 Trusted Auth administration

Auth account creation, ban/unban and session revocation require a trusted server boundary, such as a reviewed Supabase Edge Function. Never place a service-role or secret key in the browser, Vite build or repository.

Required behavior:

1. Verify the caller's JWT and ask the database whether the caller is active Leadership.
2. For deactivation, mark the application user Inactive first so programme access fails immediately.
3. Ban/disable the Supabase Auth account and revoke supported sessions/refresh tokens.
4. If the Auth step fails, keep application access inactive, record a retryable incomplete administration event and do not silently reactivate the user.
5. For reactivation, unban Auth first; activate the application user only after Auth succeeds.
6. Use the provider's currently supported Admin API rather than inventing an `active` field in Auth tables. Re-check current Supabase behavior before implementation.
7. Verify whether public email signup is enabled. Prepare a separately approved Preview change to disable it so accounts are created only through the trusted invite/admin workflow.

Never expose secret values in logs, screenshots, tests or handoff notes.

### 6.3 Administration workflow tests

At minimum, test:

- Teacher, CO, anonymous and inactive Leadership callers are denied;
- Leadership can create/invite and administer a user without receiving secrets;
- one-role and assignment invariants cannot be bypassed by concurrent requests;
- deactivation denies the next programme read/write using an already-issued JWT;
- banned users cannot sign in or refresh after the Auth action completes;
- Auth failure leaves application access inactive and produces a retryable event;
- reactivation ordering cannot create an active application user with a still-banned Auth account;
- retries are idempotent;
- administration history is immutable and contains no passwords, tokens or service keys; and
- direct table access remains denied.

### 6.4 Leadership administration UI — confirm scope first

The original plan authorizes a backend-first approach; a complete Leadership UI was not separately approved. Ask the owner whether Phase 7 should include it.

If approved, it should provide:

- user search and status/role display;
- invite/create-user flow;
- role change with a clear impact warning;
- activate/deactivate with confirmation and Auth-sync status;
- current assignment management;
- assignment history display; and
- clear retry/support state for incomplete Auth operations.

The UI must only reflect server capabilities. Hidden navigation is not the security boundary.

## 7. Phase 8: retire the old authorization model

Do not begin removal until Phase 1–7 Preview acceptance is complete, reconciliation remains at zero unexplained drift and rollback/recovery is approved.

### Required inventory

Find every remaining dependency on:

- `mass_core.user_scope_grants`;
- legacy role arrays and frontend role switching;
- old `can_read`/`can_write` branches superseded by governed helpers;
- `staff_operational_access` and special visit exceptions;
- `can_read_profiles` and private-profile grant flags;
- assignment dates as runtime authorization; and
- compatibility functions, policies, tests, imports and documentation that still write or trust the old model.

### Retirement sequence

1. Stop all new writes to the legacy grant/override mechanisms.
2. Re-run old-versus-new reconciliation and investigate every mismatch.
3. Move every remaining policy/RPC to governed helpers.
4. Revoke obsolete execution privileges and remove obsolete policies in a new append-only migration.
5. Preserve historical authorization rows for rollback/audit; archive or rename only if required.
6. Do not drop old data until the owner approves a recovery window and a backup restoration has been rehearsed.
7. Remove obsolete compatibility code and tests only after replacement security tests prove the same or stronger boundary.

### Phase 8 exit criteria

- no runtime read, write, export or administration decision depends on the old model;
- no browser path can select or submit an assumed role;
- no import or operator process recreates legacy grants;
- portable SQL and hosted Preview catalog checks pass;
- zero unexplained reconciliation drift;
- rollback instructions and retained evidence are documented; and
- Production is still unchanged unless a separate release has been approved.

## 8. Separate legacy-interface removal

The owner intends to remove `/vanilla/` in the next dedicated UI phase. Keep this work reviewable and separate from authorization migrations unless instructed otherwise.

The removal should include:

- deleting the legacy build input and `/vanilla/` output deliberately rather than leaving dead assets;
- removing its navigation link, redirect/rewrite assumptions and legacy-only tests;
- confirming React remains the root interface;
- checking CSP, routing, caching and Preview protection after removal;
- retaining any shared security/configuration utilities still used by React; and
- documenting what was removed and how to roll back.

Do not delete legacy files with broad or destructive commands. Resolve the exact files and references first.

## 9. Production release remains a separate project

Nothing in this handoff authorizes a Production mutation or merge.

Before any Production release:

- obtain explicit owner approval for the exact migration and frontend range;
- take and verify a Production backup;
- calculate the unapplied migration chain from the deployed ledger;
- rehearse the exact chain and rollback against a disposable/restored database;
- dry-run each hosted migration, then install one reviewed transaction at a time with `supabase/activation/seal.sql` and the migration ledger entry;
- preserve activation values unless separately approved;
- run read/write/direct-attack postflight checks for all three roles;
- verify Vercel Production uses only the Production Supabase project;
- confirm the strict Production CSP remains in effect; and
- record the release, commit, migration ledger, validation and rollback evidence.

Do not merge to `staging`/`main`, open a PR, promote a deployment, enable a feature, change Auth configuration or touch Production without the owner's explicit approval for that action.

## 10. Validation gates

Use the full gate from `AGENTS.md` when the implementation warrants it. For permission work, the minimum expected set is:

```bash
npm ci
npm run lint -- --no-cache
npm run check
npm test
npm run web:typecheck
npm run test:web
npm run build
npm audit --audit-level=high
npm run test:staff-access
npm run test:sql:portable
npm run test:attendance
npm run test:activation
npm run test:directory
npm run test:imports
npm run test:students
npm run test:api
npm run test:browser
MASS_CHROMIUM_EXECUTABLE=/usr/bin/chromium MASS_TEST_MULTI_ROLE=1 npm run test:attendance:browser
```

Run the Docker-backed integration suites sequentially as required by `AGENTS.md`. Add focused tests for every new administration or retirement invariant; do not rely only on UI tests.

## 11. Decisions to obtain from the owner

Ask only when the answer affects implementation or hosted state:

1. Should Phase 7 include the full Leadership administration UI, or backend/operator tooling only?
2. What invite experience should a new user receive: emailed invite, temporary-password recovery flow, or another approved process?
3. Which Leadership users may administer other Leadership accounts, and may a user deactivate or change their own role?
4. Is dual approval required for Leadership-role changes, account deactivation or student deletion activation?
5. How long should administration events and retired legacy authorization rows be retained?
6. When may the disabled Preview gates for attendance, visits and student deletion be enabled for acceptance testing?
7. Should `/vanilla/` removal happen before Phase 7, after Phase 7, or on a separate parallel branch?
8. After Preview acceptance, what recovery window is required before Phase 8 may archive or eventually drop legacy authorization data?

## 12. Definition of handoff completion

The remaining permission programme is complete only when:

- Phase 7 safely manages application and Auth lifecycle with immutable evidence;
- any approved Leadership admin UI has passed signed-in acceptance;
- Phase 8 removes all runtime dependence on the legacy grant model without losing recovery evidence;
- `/vanilla/` is removed in its separately approved phase;
- all role, centre, revocation, direct-attack, deletion and export tests pass;
- Preview acceptance is signed off; and
- a separately authorized Production release is completed and documented.
