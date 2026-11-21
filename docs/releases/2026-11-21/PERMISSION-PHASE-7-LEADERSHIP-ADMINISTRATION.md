# Permission Phase 7 · Leadership user administration

**Branch** `fix/permission-architecture`
**Status** Database migration installed and verified on Preview. Auth hook activation, database login provisioning, Edge Function deployment, and signed-in acceptance are pending.

## Operator workflow

Open **9. User administration** in the React workspace as an active Leadership user. Search by email, open a user, and review the current role, application status, and current and ended centre assignments. One active Leadership user can change another user’s role or deactivate another Leadership account. Self-role changes and self-deactivation are denied at the server.

Use **Send email invite** to assign the initial application role and send a Supabase invite. The invitee follows the link, chooses a password, and signs in. Add centre assignments from the new account when needed. An unconfirmed account shows **Invitation awaiting acceptance**. For manual onboarding, create and confirm the email account in the Supabase Auth dashboard, then use **Link existing Auth account** with that verified email. The dashboard does not receive a manually provisioned password.

When changing to Teacher or Leadership, end incompatible assignments first. Deactivation ends every active centre assignment and takes away programme access before the Auth action begins. Reactivation unbans Auth before restoring application access. Restore centre access by creating a new assignment. If the Auth step or finalization fails, use **Retry Auth action** on the account. A provider response that leaves an invite uncertain asks the administrator to check the exact Auth account before attempting a new invite or explicitly linking a confirmed account.

## Security and recovery

- Browsers call the `leadership-admin` Edge Function with their regular Auth session. The function validates the bearer token against Supabase Auth. The database checks the verified subject’s active Leadership role for each operation.
- The Edge Function’s PostgreSQL login may set only the dedicated `mass_user_admin_bridge` role. The bridge can execute the private authorization check and four administration functions. It has no direct access to application, administration, or Auth tables. The browser and the PostgREST service role have no grants on these functions.
- Version checks and a database transaction lock serialize role and assignment changes. A connection-scoped advisory lock and a durable request ID serialize retries across the Auth call. Provider failures leave access inactive and append a sanitized failure event. Administration events are private and immutable. The UI displays assignment history and current Auth status.
- The first Preview dry run found that the managed installer cannot delegate Auth-schema access or session deletion. The revised migration stays in the application schema. The trusted Edge Function obtains identity details, invitations, and ban/unban from the Supabase Auth Admin API.
- Revocation uses the Supabase Postgres Custom Access Token Hook. Application deactivation invalidates admitted session IDs immediately. The hook denies token refresh and MFA for revoked sessions, including after unban. A fresh password or invite sign-in after reactivation admits a new session. Programme RPCs and the administration boundary check those admitted sessions for previously deactivated users. Supabase retains its managed session rows. Access tokens already issued by the provider are denied by the application and cannot be renewed through the hook.
- The hook executes under `mass_core_owner`, a non-login, non-bypass definer, with explicit execution granted only to `supabase_auth_admin`. Existing accounts retain their current token behavior until a Phase 7 deactivation. The hook returns the original token claims for admitted sessions.
- If a rollout must be paused, first route staff back to the previous frontend and take the Edge Function out of service under approved changes. Leave the schema, token hook, and event evidence in place until any affected accounts have an approved recovery path. Turning off the hook prevents previously deactivated users from establishing new application sessions. Application users whose Auth work is incomplete remain inactive. An approved operator should inspect the durable request and Auth state before retrying or recovering that account. Reinstalling older code or restoring role and assignment rows does not restore revoked Auth sessions.
- Later reconciliation must account for authorized Phase 7 changes using the recorded request, immutable event, and assignment history. Keep the Phase 1–3 ledger discrepancy open until the original Preview installation evidence is reconciled.

## Preview rollback rehearsal

The revised migration and activation seal ran in one transaction on Preview. In-transaction checks passed for all three private tables, five bridge functions, the Auth hook’s owner and execution grants, and the feature gates. Postflight matched preflight for the schema, function ACLs, migration ledger, feature gates, and governed account and assignment counts. The Auth hook installation was rolled back and the Auth hook setting is disabled. Managed Auth acceptance remains pending.

## Preview database installation

On 21 November 2026, the approved migration and activation seal committed in one Preview transaction, with ledger entry `20261121120000` (`leadership_user_administration`). The installed migration SHA-256 is `eb43e2eeca87e329b0208ebfe4d7521c9552ca53fdbdb18c1ff9e83e730b63d8`.

Read-only postflight verified forced RLS on the three private tables, the bridge’s five function grants, and the Auth hook’s owner and execute grants. The earlier ledger, the three users and ten active assignments, the attendance register control, and the feature gates matched preflight. Assessment entry remains enabled. Attendance entry, visit entry, and student deletion remain disabled. The Auth hook is installed as a database function and is disabled in Preview Auth settings.

## Preview installation and acceptance

Obtain approval for each hosted step, then apply it on Preview only.

1. Recheck the migration ledger, current role and assignment counts, Auth hook configuration, and release switches. Dry-run `20261121120000_leadership_user_administration.sql` as a transaction using the real installation principal. Install with the current activation seal and ledger entry after approval. Verify the private owners, privileges, and forced RLS after installation. The migration adds no public PostgREST function and changes no application activation switch.
2. Provision a restricted database login with `SET TRUE, INHERIT FALSE` membership in `mass_user_admin_bridge`. Grant database connection only as required for the approved connection. Configure the Edge Function with `MASS_ADMIN_DATABASE_URL` using a direct or session-pooler connection with full TLS verification. Transaction pooling is incompatible with the connection advisory lock. Set `MASS_ADMIN_INVITE_URL` to the verified HTTPS branch site root. The platform-supplied Auth Admin credential belongs only in the Edge Function environment.
3. Enable the separately approved Preview **Custom Access Token Hook** at `pg-functions://postgres/mass_core/administration_access_token_hook`. Confirm ordinary Preview sign-in and refresh still work before exposing lifecycle actions. Stop rollout if another custom token hook appears. Check its behavior and compose it through a separate reviewed change before proceeding.
4. Deploy `leadership-admin`. Its handler performs its own GoTrue authentication, so use the Supabase deployment option that disables legacy gateway JWT verification if the project's signing-key configuration requires it. Verify origin handling and a denied unauthenticated request before releasing the UI.
5. Configure the Preview Auth invite redirect allowlist and invite template. The email anchor uses `{{ .RedirectTo }}#invite?token_hash={{ .TokenHash }}`. This leaves the one-time token in the fragment until React consumes it. Approval for any future public-signup policy change is a separate Auth decision. Before sending email, verify the Preview mail delivery settings and approve a synthetic recipient.
6. Release the approved React Preview. Verify signed-in permissions, a real invitation and password setup, the manual account path, two Leadership identities for peer administration, existing-access-token denial, refresh-token revocation, and the unban/reactivation order. Use synthetic accounts and preserve existing gates. Any deliberate provider failure needs its own safe Preview test plan.

## Local validation

- `npm test`, `npm run web:typecheck`, `npm run test:web`, `npm run lint -- --no-cache`, `npm run check`, and `npm run build`.
- `npm run test:sql:portable` runs Phase 7 after the Phases 1–6 security suite. It checks denial, assignment limits, immutability, retry, old-session refresh denial and fresh-session admission through the Auth hook, and old JWT rejection after reactivation.
- `bash tests/security/permission-administration-concurrency.sh` runs overlapping native PostgreSQL transactions for Teacher assignments and Leadership demotions.
- Deno type-checks the Edge Function with the pinned database adapter. Managed Auth email, production-like SMTP, actual ban/unban, and deployed browser acceptance are Preview validation steps.

The broad Docker release suite completes migration installation and its injected rollback check, then stops at a stale core-table inventory expectation. The centre-events suite expects Leadership to be denied a write that the approved Phase 4 hierarchy allows. Both failures reproduce at the starting commit `245ceb1`. The focused PostgreSQL concurrency and portable permission replays validate Phase 7 separately.
