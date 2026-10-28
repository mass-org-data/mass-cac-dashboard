# Proposed security and RLS requirements — no policies implemented

The sources contain real children's and family information. Treat raw workbooks, identity crosswalks, baseline responses, free-text notes and exception locators as restricted. Frontend role labels and spreadsheet project/officer context do not approve permissions. Exact role capabilities remain D10-D14 decisions; no SQL policy, grant, Auth change or resource was created.

## Data separation

- Private schema/storage: private_child_profiles, baseline surveys/answers, raw source rows/payloads, identity resolutions, exception details, sensitive staff/guardian-related information and audit details. Religion/caste, disability/health, family finances, marriage/safeguarding and other baseline responses must not enter ordinary programme/donor payloads.
- Operational data: approved centre-scoped placements, sessions, marks, attendance, activities, visits and cohort records. These remain personal data even with internal UUIDs and need authorized scopes.
- Reporting: derive only approved metrics from accepted facts. Authorized staff views may expose the minimum necessary child name; donor/public output is not automatically allowed. Anonymous users get no real records. Apply any approved small-cell suppression/aggregation rules server-side before donors can access reports.
- Source metadata in this Git branch is limited to filenames, organizational tab labels, field names, hashes and aggregate findings. It contains no child records or personal IDs. Raw workbooks/row exception registers are outside Git. The build includes docs in the downloadable source ZIP, so public-safe documentation is essential; private reports must not be placed under docs/src/scripts.

## Identity, grants and scopes

Use Supabase Auth only after real staff identity/onboarding/invitation/revocation requirements are approved. Map auth.users to confirmed staff IDs through an authorized process, never by email/name coincidence or client-supplied role metadata. user_scope_grants is a proposal, not an existing grant source. Editable browser role state and workbook tab names must not grant rights.

| Access scenario | Required owner confirmation | Proposed safe default until approval |
| --- | --- | --- |
| Teacher | Which centres/shifts, historical access, data entry and correction permissions, export entitlement | Deny real data; no default assignment from sample centre |
| Cluster Officer | Dated assignments, cross-centre review versus edit, visit correction, former-centre access | Deny beyond explicit approved scope |
| Leadership | Programme-wide reporting versus child/private detail versus administrative powers | Do not equate leadership with unrestricted database administration |
| Security/import administrator | Who can adjudicate identity, inspect baseline, run imports and manage grants | Separate restricted capability; never inherited from a display role |
| External donor | Whether accounts exist, funder identity, funding dates, approved aggregate metrics and disclosure thresholds | No account or direct child/baseline access inferred |
| Anonymous user | Any public dashboard requirement and approved disclosure | No real-record access |

The precise permission matrix must be approved before RLS code. Scope changes must not rewrite historical facts. Decide whether access follows present assignment, assignment at record time or another approved rule; source history is incomplete and cannot answer this automatically.

## Policy and API design requirements

- Enable and test RLS on every exposed table with real data. Revoke inappropriate anonymous/authenticated grants, including direct access to private schemas and service-only staging/audit/grant tables. Verify storage policies separately; RLS on a table does not protect an unrelated file URL.
- Authenticate every read/write and validate approved scope/ownership for the record and its referenced parents. Protect both USING and WITH CHECK paths so clients cannot move a record into another centre, forge user IDs or create out-of-scope child/event links. FK integrity alone is not authorization.
- Prefer security-invoker views/RPCs where supported. Review PostgreSQL/Supabase version and view ownership because ordinary owner-executed views may bypass intended RLS. Any security-definer helper needs fixed search_path, narrow grants, argument validation and an explicit audit of privilege escalation; do not expose a broad helper that returns private underlying rows.
- Server-owned created_by/updated_by, versions, grant approvals and audit entries cannot be forged by clients. Transactions enforce coherent activity/participation, batch marks and bulk attendance writes. Approve correction reasons/approval windows; do not silently retain localStorage last-write-wins.
- Derived reporting must validate caller scope before aggregation and minimize payloads. Do not download all student data to a donor browser and hide names in the UI. Export authorization is separate from on-screen access.
- Limit/filter/paginate on the server when integrating. Prevent unauthorized counts/search/error responses from revealing out-of-scope people. No real-data reset operation is approved; isolate/disable demo reset for real sessions.

## Credentials and platform review

No Supabase connector, project configuration or credential binding was available for inspection. An existing MASS project may exist; its region, schema, grants, RLS, storage, Auth redirects, backups and security settings are unknown. Review the existing project rather than creating a replacement by assumption. Deployment and database resources remain unchanged.

Future public browser config may include project URL and publishable/public key via an explicit reviewed build/runtime path; the current static app has no automatic environment-to-browser injection. Such a key is not authorization. Service-role/secret keys, database connection strings and management tokens remain server-only, securely injected, never committed or bundled. Supply credentials through approved secure settings, not chat. No new environment requirements or dependencies were added now.

Approve least-privilege import credentials, secure artifact storage, region/residency, backups, incident response, retention/deletion and any consent/legal obligations with the responsible owner. Filesystem permissions on current scratch data are an immediate containment measure, not encryption or durable approved production storage.

## Synthetic verification requirements

Test direct API calls, not only role-specific navigation: anonymous denial; cross-centre reads/inserts/updates; forged scope/actor IDs; historical assignment changes; child/parent reference scope mismatch; concurrent corrections; export denial; donor payload minimization/small-cell behavior; private baseline/staging/storage denial; grant/audit tampering; and service-role isolation. Test every approved allowed path as well as denials in an isolated synthetic database.

No real fixtures, private source copies or example child records from these workbooks may enter Git, preview bundles, logs or tests. Source-labelled Example Student rows are excluded from migration and must not be confused with a decision to publish real rows as examples.
