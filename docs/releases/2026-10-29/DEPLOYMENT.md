# Controlled deployment and final verification

**Nothing in this procedure was executed against hosted Supabase. No production backup was created in this phase.** Database inspection/export used read-only administrative queries. Existing project/data are not a destructive test environment.

## Before migration execution

1. Review the exact feature-branch commit and23-file SHA256 manifest. Verify that001–019 hashes equal the deployed release; do not replay them. Run `sha256sum -c supabase/compatibility/MIGRATIONS.sha256` from repository root.
2. Confirm target `pbkwpfdpdtelmvbkzgvx`, Mass CAC Dashboard, Mumbai, and the trusted postgres deployment principal. Run `supabase/compatibility/020023-preflight.sql` read-only. Expect19 recorded versions/27 existing MASS tables and no020–023 objects. Inspect postgres SET/INHERIT access to the existing owners. Do not mistake permissions of the read-only inspection principal for migration execution rights.
3. Have the authorized administrator create and privately verify a current Free-project manual backup using the existing `docs/PRODUCTION-MIGRATION-PREFLIGHT.md` procedure. Cover application schemas/data, roles/memberships, ownership/grants/default privileges, function/policy/trigger definitions, Auth-related recovery dependencies, migration ledger and exposure configuration. Keep credentials in protected connection facilities, dumps outside Git, permissions0600, and record integrity hashes. Test recoverability in an isolated database without replaying managed service-role definitions blindly. This environment lacks a direct database backup credential; read-only query exports are not a substitute for a recoverable complete backup.
4. Confirm no concurrent migration/DDL/import job. Capture existing programme counts and scope grants privately. Obtain required privacy/operational approvals before staff activation; empty additive schema installation is separate from account provisioning/import.

## Exact execution order

Use the existing trusted migration runner that records Supabase history and fails on errors, against this reviewed commit only:

1. `supabase/migrations/202610290020_original_workflows.sql`
2. `supabase/migrations/202610290021_cluster_officer_visits.sql`
3. `supabase/migrations/202610290022_activity_delivery.sql`
4. `supabase/migrations/202610290023_programme_aggregates.sql`

Each file is transactional and includes schema-cache reload where applicable. Verify the recorded version and expected objects after EACH successful file, before continuing. Do not paste files into a tool that records no migration history and assume they were registered. Do not strip transaction boundaries or manually invent ledger rows to hide a failure. Use the already established deployment mechanism; its identity, transaction and ledger behavior must be confirmed by the operator before execution.

On ANY error: stop the sequence; capture sanitized SQLSTATE/file/version; check the actual transaction/ledger/object state read-only. A failed transaction must be rolled back before retry. Do not reset the database, drop existing foundation/core objects, replay001–019, or automatically reverse a successfully committed migration. Reconcile the exact partial state and prepare a reviewed forward correction or administrator recovery from the verified backup. The isolated021 injected-failure/retry test proves only local transaction behavior, not hosted recovery.

After all four files, run `supabase/compatibility/020023-postflight.sql`: expect32 forced-RLS tables,230 columns,45 validated FKs,115 policies,23 recorded versions and closed anonymous/service RPC ACLs. Existing student/fact counts must match the pre-deployment snapshot; all new operational tables start empty. Confirm API exposure still excludes mass_core/mass_foundation/mass_import. No staff link or synthetic fixture is installed by these migrations.

## Verified staff linkage — separate controlled step

Do not create Leadership accounts or grant scopes from directory names. An administrator must privately verify each actual existing Auth user, current CO centre grant, canonical staff identity, matching directory assignment, applicable dates, explicitly verified Both-shifts authority and verification reference. Only then provision `officer_assignments` through the trusted owner-controlled process. The database trigger checks role/centre consistency; it cannot establish that a human identity is correct. No unrestricted link/write API is supplied. If the mapping is ambiguous, visit creation stays blocked. Existing runtime scope grants remain unchanged.

## Preview configuration and procedure

The Vercel CLI reported no existing credentials. No Preview deployment was created. GitHub REST access is denied here; Git protocol access works. The previously verified Ignored Build Step skips this feature branch, so pushing code is not evidence of a published Preview. No Vercel settings were changed.

An authorized Vercel operator should authenticate locally (`vercel login`), inspect and link ONLY the existing project: team `mass-data-dashboard`, team ID `team_6bfGAi9fNVAAJ9NQqg0VzHM4`, project `mass-cac-dashboard`, project ID `prj_MvZqQP2cdpRce7NxWR1JzvBsIBdL`. Verify `.vercel/project.json` matches these IDs; do not create a project or disconnect GitHub. Set Preview-scoped variables through private configuration:

- `MASS_APP_MODE=live`
- `MASS_READ_API=frontend-reads-v1`
- `MASS_DIRECTORY_API=directory-v1`
- `MASS_SUPABASE_URL=https://pbkwpfdpdtelmvbkzgvx.supabase.co`
- `MASS_SUPABASE_PUBLISHABLE_KEY` = the approved publishable key, never a service/secret key.

Use the verified existing project and deploy the exact feature commit in Preview mode (`vercel deploy --scope mass-data-dashboard`; **no `--prod`**). Confirm target Preview, project IDs, commit and build output before browser tests. Do not alter Production settings or merge main. If the skip rule cancels a Git build, that is not a usable Preview; manual Preview deployment still requires authorized credentials. No guessed Preview URL is supplied.

## Managed Auth and persisted UAT

No separate hosted test project/three synthetic managed accounts were confirmed. Continue using local synthetic tests until a properly isolated environment is supplied. Do not put fixture accounts, role grants, child records or cleanup jobs in the real programme project. A separate schema in the same production project is NOT assumed isolated: Auth, API configuration, resources, statistics and accidental queries remain shared; using it would require a reviewed proposal before any change.

For final hosted verification: use an approved isolated environment with actual managed Auth accounts for all three roles and verified synthetic centre scopes; adapt the pinned target configuration only after that target is approved. Exercise fresh/existing/expired sessions, sign-out, scope revocation, cross-centre denial, all pages/charts, filters, registered student/transfer/profile changes, attendance/batches, quarter-only corrections, activities/participation, delivery, visits/edits/history, retries, failures, navigation and mobile. Save→re-read→refresh→audit must be demonstrated; remove fixtures only under the test environment's recovery process. Screenshots/row IDs and credentials stay private.

The existing production project can later receive read-only UAT by authorized real staff without manufactured test writes; that does not replace isolated write/RLS/Auth verification. Hosted migration compatibility and Preview UAT remain unpassed until actually executed. Production promotion remains NO-GO until critical checks and approval conditions are evidenced.
