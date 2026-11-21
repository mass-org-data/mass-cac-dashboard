# Permission Phase 7 · Leadership user administration

**Branch** `fix/permission-architecture`
**Status** Implemented locally. Preview installation and acceptance require approval.

## Operator workflow

Open **9. User administration** in the React workspace as an active Leadership user. Search by email, open a user, and review the current role, application status, and current and ended centre assignments. One active Leadership user can change another user’s role or deactivate another Leadership account. Self-role changes and self-deactivation are denied at the server.

Use **Send email invite** to assign the initial application role and send a Supabase invite. The invitee follows the link, chooses a password, and signs in. Add centre assignments from the new account when needed. An unconfirmed account shows **Invitation awaiting acceptance**. For manual onboarding, create and confirm the email account in the Supabase Auth dashboard, then use **Link existing Auth account** with that verified email. The dashboard does not receive a manually provisioned password.

When changing to Teacher or Leadership, end incompatible assignments first. Deactivation ends every active centre assignment and takes away programme access before the Auth action begins. Reactivation unbans Auth before restoring application access. Restore centre access by creating a new assignment. If the Auth step or finalization fails, use **Retry Auth action** on the account. A provider response that leaves an invite uncertain asks the administrator to check the exact Auth account before attempting a new invite or explicitly linking a confirmed account.

## Security and recovery

- Browsers call the `leadership-admin` Edge Function with their regular Auth session. The function validates the bearer token against Supabase Auth. The database checks the verified subject’s active Leadership role for each operation.
- The Edge Function’s PostgreSQL login may set only the dedicated `mass_user_admin_bridge` role. The bridge can execute four narrow administration functions. It has no direct access to application, administration, or Auth tables. The browser and the PostgREST service role have no grants on these functions.
- Version checks and a database transaction lock serialize role and assignment changes. A connection-scoped advisory lock and a durable request ID serialize retries across the Auth call. Provider failures leave access inactive and append a sanitized failure event. Administration events are private and immutable. The UI displays assignment history and current Auth status.
- Auth ban/unban uses the Supabase Auth Admin API. GoTrue global sign-out requires a target user access token. The database uses the equivalent deletion of that user’s managed `auth.sessions` rows, with the confirmed foreign-key cascade removing associated refresh tokens. The migration checks this schema contract and the session grant is confined to a dedicated non-login definer owner. On reactivation, the programme scope also checks for a current Auth session, so an old access JWT cannot regain programme access.
- If a rollout must be paused, first route staff back to the previous frontend and take the Edge Function out of service under approved changes. Leave the schema and event evidence in place. Application users whose Auth work is incomplete remain inactive. An approved operator should inspect the durable request and Auth state before retrying or recovering that account. Reinstalling older code or restoring role and assignment rows does not restore revoked Auth sessions.
- Later reconciliation must account for authorized Phase 7 changes using the recorded request, immutable event, and assignment history. Keep the Phase 1–3 ledger discrepancy open until the original Preview installation evidence is reconciled.

## Preview installation and acceptance

Obtain approval for each hosted step, then apply it on Preview only.

1. Recheck the migration ledger, current role and assignment counts, Auth session foreign key, and release switches. Dry-run `20261121120000_leadership_user_administration.sql` as a transaction using the real installation principal. Install with the current activation seal and ledger entry after approval. Verify the private owners, privileges, and forced RLS after installation. The migration adds no public PostgREST function and changes no application activation switch.
2. Provision a restricted database login with `SET TRUE, INHERIT FALSE` membership in `mass_user_admin_bridge`. Grant database connection only as required for the approved connection. Configure the Edge Function with `MASS_ADMIN_DATABASE_URL` using a direct or session-pooler connection with full TLS verification. Transaction pooling is incompatible with the connection advisory lock. Set `MASS_ADMIN_INVITE_URL` to the verified HTTPS branch site root. The platform-supplied Auth Admin credential belongs only in the Edge Function environment.
3. Deploy `leadership-admin`. Its handler performs its own GoTrue authentication, so use the Supabase deployment option that disables legacy gateway JWT verification if the project's signing-key configuration requires it. Verify origin handling and a denied unauthenticated request before releasing the UI.
4. Configure the Preview Auth invite redirect allowlist and invite template. The email anchor uses `{{ .RedirectTo }}#invite?token_hash={{ .TokenHash }}`. This leaves the one-time token in the fragment until React consumes it. Approval for any future public-signup policy change is a separate Auth decision. Before sending email, verify the Preview mail delivery settings and approve a synthetic recipient.
5. Release the approved React Preview. Verify signed-in permissions, a real invitation and password setup, the manual account path, two Leadership identities for peer administration, existing-access-token denial, refresh-token revocation, and the unban/reactivation order. Use synthetic accounts and preserve existing gates. Any deliberate provider failure needs its own safe Preview test plan.

## Local validation

- `npm test`, `npm run web:typecheck`, `npm run test:web`, `npm run lint -- --no-cache`, `npm run check`, and `npm run build`.
- `npm run test:sql:portable` runs Phase 7 after the Phases 1–6 security suite. It checks denial, assignment limits, immutability, retry, actual synthetic session-row deletion and refresh-token cascade, and expired session rejection after reactivation.
- `bash tests/security/permission-administration-concurrency.sh` runs overlapping native PostgreSQL transactions for Teacher assignments and Leadership demotions.
- Deno type-checks the Edge Function with the pinned database adapter. Managed Auth email, production-like SMTP, actual ban/unban, and deployed browser acceptance are Preview validation steps.

The broad Docker release suite completes migration installation and its injected rollback check, then stops at a stale core-table inventory expectation. The centre-events suite expects Leadership to be denied a write that the approved Phase 4 hierarchy allows. Both failures reproduce at the starting commit `245ceb1`. The focused PostgreSQL concurrency and portable permission replays validate Phase 7 separately.
