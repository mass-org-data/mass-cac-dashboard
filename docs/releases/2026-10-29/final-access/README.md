# Revised final release: access separation and activation

The29 October revised instruction and clarification govern this continuation. Attendance editing, assessment editing and Cluster Officer visit entry/correction remain required release features. They are implemented and tested locally; hosted operational activation is not claimed. Previous Phase2/3/audit/release documents remain preserved as dated evidence.

## Access implemented

The manager-approved interface opens directly with its branding, navigation and original chart sections. A signed-out visitor sees **Access approval pending** for protected values and filters. No programme RPC is issued, demo seed loaded, personal record downloaded or anonymous account created. Unknown values render as dashes rather than false zeroes. The public view exports no invented dataset.

An optional **Authorize changes** dialog uses an existing managed Supabase account. `getUser()` verifies identity; the server supplies actual roles, current centre scope and capabilities. No shared credential, application-secret privilege, invented account, new scope grant or caller-selected role is introduced. Existing JWT-based centre RLS, profile privacy and version checks remain authoritative. Existing verified sessions enter the live original interface directly; sign-out purges programme data and returns to the no-login dashboard. No password is stored by application code or committed.

This is a secure interim authorization mechanism **only for administrator-verified existing accounts with approved scope**. It does not solve missing staff identities. If no such account is available, real writes stay blocked; a browser button cannot grant authority. Final staff-email provisioning waits for the MASS spreadsheet. Officer visit writes additionally require a verified dated Auth-to-directory staff link; none is fabricated from names or NULL source shifts.

All 24 charts remain in scope. [PUBLICATION-APPROVAL-MATRIX.csv](PUBLICATION-APPROVAL-MATRIX.csv) lists each original visual and its approval/source dependencies. Public-safe material currently includes branding/navigation, field labels, metric definitions and the confirmed2+2 target policy—not live centre counts, programme statistics, names or sensitive breakdowns. MASS must approve:

- Measures and aggregate fields, permitted audience and permitted detail for centres/donors/officers.
- Centre, grade, shift, gender and time filters, combinations and repeated-query/differencing risks.
- Small-group handling and export permissions. No numerical suppression threshold is invented.
- Any future personal-data disclosure separately; permission to publish charts does not authorize student records or sensitive visit feedback/history.

No anonymous read endpoint or broadened RPC ACL was installed. The current staff RPCs are not repurposed for public reporting. An approved minimized public read contract remains a separate activation dependency. The public source-download allowlist now excludes internal documentation/audit reports, because those contain programme statistics. Repository documents are retained; no private workbook/data is included in the archive.

## Operational dependencies (unchanged canonical migrations)

|Workflow|Required migration/API|Current result|
|---|---|---|
|Individual attendance|Existing record_attendance;020validation/history reads|Locally persisted and corrected; hosted tests pending|
|Atomic bulk attendance|020record_attendance_batch|Local transaction/duplicate/revision tests; no anonymous execution|
|Assessment entry/correction|020record_assessment_batch, period-aware reads, existing canonical mutator|Local score/max 25/NULL-date/quarter/year/concurrency checks; blank does not erase a score|
|Correction audit|020read_record_revisions; original immutable foundation audit|Minimized actor/revision/operation/time evidence; does not claim stored previous/new attendance or assessment values|
|Visit entry/correction/history|021officer_assignments and visit RPCs|Local author/scope/date/status/idempotency/revision/concurrency checks; full sensitive visit snapshots restricted|
|Activity/delivery details|022|Local named event/participation/delivery persistence; unknown historical coverage stays unknown|
|Profile-safe demographic/learning aggregates|023|Scoped server aggregates; no profile access broadened; anonymous execution closed|

Original source workbook/provenance/receipts remain preserved. Corrections modify the operational current value under version control and append an immutable audit revision; they do not delete or rewrite original source provenance. Full before/after snapshots for attendance/assessment are not stored by the technical audit. Do not label minimized revision history as a full value-reconstruction/recovery system. Recovery coverage remains an essential release safeguard.

Visit monthly trends are loaded explicitly through existing scoped monthly summary RPCs. They retain true uncapped completed counts, NULL for unobserved coverage, separate2+2 targets and both-shifts achievement. Officer filtering is applied server-side; changing filters cannot reuse another officer's cached results. Fresh writes invalidate and refresh previously requested trends. No new database migration is needed for this frontend addition.

## Production gates and controlled deployment

Production still has001–019 only. The exact23-file manifest remains unchanged. Apply only020→021→022→023, with error-stop and DDL/history recording in the same transaction. The first 17 deployed history versions have provider aliases; do not use bulk db push, repair history or replay001–019. Use the prepared deployment-readiness operator bundle and read-only preflight/postflight. Expected postflight:32 tables / 230 columns / 45 FKs / 115 policies, forced RLS and closed anonymous/service RPC ACLs, unchanged old data and empty new operational tables.

The user is not requesting that Codex make a manual backup. No backup was created. That does not waive recoverability. No current recoverable backup/isolated restore evidence is available; the provider API lists no backup and PITR is disabled. The older pre-import JSON snapshot is insufficient for current recovery. This blocks production migrations until an administrator supplies a verified recovery facility/evidence. Do not request passwords in chat or silently accept an unrecoverable deployment.

No authenticated Vercel CLI/connector is available. The existing branch skip rule prevents push from being a published Preview. Existing project deployment access and verified Preview-scoped configuration are required; no new paid project, Git disconnection, main merge or Production promotion was performed.

Hosted managed Auth, Preview persisted writes, staff scope and final privacy/UAT verification remain unpassed. Use only isolated synthetic identities/records for automated write tests. Existing real staff may perform authorized read-only production UAT; no fixture accounts or writes are added to production to force a pass.

## MASS versus technical dependencies

MASS: approve the publication matrix; provide verified staff identities/emails/roles/centre scopes and dated officer links; confirm calendar/completeness, assessment paper comparability/precision, applicable visit scope, source corrections and retention/export audience where still unresolved. Unsupported school/guidance/Morarji extra outcomes or unknown activity details cannot become correct charts through code alone.

Administrator/technical: current private recovery evidence; secure deployment connection or administrator execution; Vercel Preview permissions; an approved isolated hosted Auth/write-UAT facility; named maintenance/recovery owner and window. The present broad runtime scopes need MASS confirmation before new staff activation; no permissions were widened here.

See [source reconciliation](OFFICER-SOURCE-RECONCILIATION.md) and [verification results](VERIFICATION.json). No final application/Preview URL is claimed: the production frontend was preserved, and the revised release has not been deployed.

## Staff spreadsheet: exact activation information

For each actual person MASS must supply a verified identity/email, approved role, unambiguous canonical centre(s), effective assignment dates and observed/explicitly approved shift authority. The administrator can then link to an existing Auth UUID and canonical directory staff record privately. Permission to read private profiles must be explicit. Officer links need source verification and matching dated operational scope; blank directory shift is not Both-shifts authority. Same-name people and similarly named centres must not be merged. Do not invent dates, provision future permissions from a directory label, or create Leadership accounts. Missing evidence blocks that person's operations, not continued local development.
