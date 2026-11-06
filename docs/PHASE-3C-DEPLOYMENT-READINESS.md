# Phase 3C — deployment gates and approval-dependent apply sequence

27 October 2026. **No hosted apply is authorized in this phase.** User-identified target: pbkwpfdpdtelmvbkzgvx, Mass CAC Dashboard, Mumbai/ap-south-1. This document is a reviewable runbook, not an executed deployment. It distinguishes a closed/empty schema installation from enabling accounts, personal data, historical imports or frontend traffic.

## Gates by activation stage

| Gate | Blocks empty hosted schema apply? | Blocks later activation/import/operation? | Exact evidence or approval still required |
| --- | --- | --- | --- |
| Explicit execution authorization | Yes | Yes | Approve the exact reviewed commit, 15-file inventory, target, rollout/recovery plan and management actor in a separate request |
| Correct target/ownership/region | Yes | Yes | Read-only confirmation of project ref/name/region/ownership and production boundary; user identification alone is not live inspection |
| Hosted version and managed dependencies | Yes | Yes | PostgreSQL >=15, actual auth.users/id and auth.uid(), existing provider roles; verify on an approved isolated real Supabase target |
| Migration-role permissions | Yes | Yes | CREATE ROLE/schema, SET ROLE/ownership, managed Auth USAGE/EXECUTE/REFERENCES delegation, policy/trigger/ACL authority. Local superuser success is insufficient |
| Existing object/role/ledger collisions | Yes | Yes | Inventory current schemas/roles/constraints and migration ledger; stop on unknown existing objects, do not adopt or overwrite them automatically |
| Technical security architecture | Yes | Yes | Review actual owner/admin/service role capabilities/inheritance/default grants and RLS. Accept private schemas and no real memberships/endpoint enablement during closed installation |
| Backup/recovery capability | Yes | Yes | Verified actual tier/PITR/snapshot options and isolated restore rehearsal; capture approved non-secret role/ownership/grant metadata as well as database state |
| Deployment-free Git publication | Yes for the intended reviewed-publication workflow | Yes for review/release | Branch push and PR require verified Vercel suppression; PR API access currently Forbidden. No merge or Vercel deployment authorized |
| Privacy/purpose/minimum fields | No, only if installation stays empty/closed with no real grants/data and that boundary is approved | Yes before real personal data or user access | Approve lawful/privacy purpose, minimum fields, private projections/exports and safeguarding. Synthetic approval is not permission for real records |
| Retention/deprovisioning/audit/error logs | No for explicitly approved empty/closed schema | Yes before real accounts/grants/data | No retention duration chosen. Resolve append-only history versus correction/erasure, auth.users deletion restrictions, artifact/exception retention, runtime/error-log redaction and recovery expectations |
| Actual staff roles/centre-cluster assignments | No; seed no real memberships/grants | Yes before account provisioning and API use | Verify actual people/Auth linkage, grant authority, start/end validity, scoped read/correction rights, explicit profile capability and historical entitlement. Browser labels confer no rights |
| Real managed Auth/gateway/API exposure | Permission/dependency feasibility must be established before production schema approval; API remains closed | Yes before API/user activation | Test issuer/JWKS, login/refresh/revocation/expiry, real request UID, effective provider ACLs and gateway schemas on an approved isolated Supabase target. Expose curated mass_api only when reviewed; never expose mass_foundation/mass_core/auth |
| Identity/source authority and historical periods | No | Yes for affected historical import | Authorized human identity review, source precedence/aliases, missing year/date/century and cohort evidence; no name-only merge, neighbour-fill or assumed max100 conversion |
| Calendar authority/H/report coverage | No | Yes for calendar writes and final attendance reporting | Approve authoritative scheduled/non-scheduled evidence, H handling, conflicts, zero-denominator/display rounding and coverage. Confirmed P/(P+A+L) remains unchanged |
| Exit dates/overlaps/transfers | No | Yes for affected episodes and live profile workflows | Approve frontend last-day versus exclusive ends_before conversion, legitimate multi-centre/shift overlap, closure correction/reopening and receiving-only transfer workflow |
| Assessment precision/status/paper comparability | No | Yes for affected result entry/import/reporting | Current max25 is confirmed; decide permitted decimals/rounding, clear/absent workflow, additional papers/exceptional repeats and comparable reporting; Q/F alias before frontend binding |
| Friendly student-ID display | No if permanent printable UUID design is accepted in schema approval | Before adopting an additional alias/UI numbering policy | No prefix/sequence business rule selected. Existing permanent ID must not be silently replaced |
| Deferred history/modules | No | Only the track needing them | Identity-resolution/monthly-slot history before those imports; optional guidance/funding/visits/notes separately approved. No mock rows fill gaps |

Privacy/business decisions do not all block an explicitly approved empty schema, but **none of the schema blockers above is waived by that distinction**. No real operational source rows, actual user grants or application traffic may be introduced while their corresponding activation gates remain unresolved. No approval is inferred from silence.

## Exact safe sequence after separate approval

1. **Freeze and review the source.** Verify the foundation/Phase2E/core commits and the subsequent Phase3C documentation commit; inspect the PR into main without merging automatically. Pin the intended release SHA and all 15 hashes in DATABASE-SCHEMA-INVENTORY.json. Confirm only intended SQL/docs/tests are included and no workbook, secret or private fixture exists. Resolve deployment-free publication and review access first; do not push as a Vercel-trigger experiment.
2. **Inspect the identified target read-only.** Through an authorized administrator, confirm project pbkwpfdpdtelmvbkzgvx, name, Mumbai/ap-south-1, ownership and exact database endpoint/production boundary without putting credentials in Git/chat. Review preflight.sql output, existing schemas/roles/grants/policies/ledger, actual PostgreSQL/managed Auth, and API exposure. If names/permissions/schema state differ, stop and reconcile before any write. CLI project binding is an administrative action requiring the separately approved target; do not infer it from local folder names.
3. **Prove compatibility on an approved isolated real Supabase environment.** Resolve the image-registry limitation or obtain an approved existing development target. Apply the same frozen files using the actual intended migration-role capabilities and normal migration ledger. Never apply bootstrap.sql, fixture SQL or Auth stubs to a managed target. Test real Auth issuer/session lifecycle, role memberships, scoped/private direct API behavior, expiry/revocation, actor attribution and recovery using synthetic-only identities. No production smoke test may stand in for this staging step.
4. **Verify and rehearse recovery.** Confirm actual provider backup/PITR availability rather than assuming a tier. Take the approved pre-change recovery point/snapshot and record non-secret role/ownership/ACL metadata; database backup alone may not restore global role changes. Demonstrate restore in an isolated target with an acceptable recovery point/window chosen by owners. Keep backup material restricted and outside Git. Approve who stops/resumes work and how schema/ledger discrepancies will be reconciled.
5. **Authorize the closed-schema window.** Reconfirm the frozen SHA, target and backup evidence immediately before applying. Keep frontend/backend writers, real memberships/grants and new API exposure disabled. This means withholding activation of the new database surface, not pausing/disconnecting Vercel or unrelated existing services. Confirm there are no concurrent schema administrators. Stop on unexpected target objects or migration state.
6. **Apply only the 15 versioned files through the approved migration runner, once, in filename order.** The order is listed below. The runner must stop at the first SQL error and preserve the ledger. Each file is transaction-wrapped, but all 15 files are not one transaction. Do not reorder, skip failures, force a ledger entry, rerun already-applied files blindly, or mutate managed Auth definitions. No test setup, fixture, catalog renderer or source importer is part of this apply.
7. **Verify the closed install read-only.** Reconcile 23 relations/155 columns/27 FK constraints and their exact definitions against the reviewed catalog, six custom role properties, all 71 policies, enabled+forced RLS on all tables, effective table/column/function/default ACLs, 11 mass_api functions, triggers, managed Auth dependencies and the 15 ledger entries. Verify no real grant rows or personal data were seeded; only five confirmed attendance definitions are migration reference data. Confirm private schemas are absent from API exposure and the existing frontend/deployment settings are unchanged.
8. **Resolve any failure before resuming.** A failed file should roll back its own transaction, while earlier committed files may remain. Record the failed version/error and actual schema/ledger state; do not continue into later files. Choose a reviewed forward corrective migration or the approved restore process. Re-test the correction in isolation. No DROP CASCADE, role removal, reset/down migration or destructive production undo is preapproved. Only discard an empty disposable target when that discard is explicitly authorized. Audit revision metadata is not a substitute for restoring old business values.
9. **Obtain separate activation approvals.** Only after real Auth/security tests and privacy/role/calendar/workflow decisions, approve narrowly scoped actual account grants, reviewed mass_api exposure and synthetic smoke checks. Historical source staging/promotion requires its own adjudication/reconciliation approval; frontend adapter/release and Vercel deployment remain separate tasks. Do not assume schema deployment authorizes them.

### Frozen migration order

| Order | File |
| --- | --- |
| 1 | 202610270001_source_files.sql |
| 2 | 202610270002_source_sheets.sql |
| 3 | 202610270003_import_batches.sql |
| 4 | 202610270004_source_rows.sql |
| 5 | 202610270005_import_exceptions.sql |
| 6 | 202610270006_audit_events.sql |
| 7 | 202610270007_auth_scope.sql |
| 8 | 202610270008_identity_history.sql |
| 9 | 202610270009_academic_periods.sql |
| 10 | 202610270010_attendance.sql |
| 11 | 202610270011_assessments.sql |
| 12 | 202610270012_named_activities.sql |
| 13 | 202610270013_morarji.sql |
| 14 | 202610270014_core_security_audit.sql |
| 15 | 202610270015_core_api.sql |

### Supabase CLI template for the separately authorized execution window

These commands are **not executed in Phase 3C**. First validate the chosen CLI version and these operations on the approved isolated real Supabase target. Use an approved credential manager/interactive flow, not a secret embedded in a command, document or Git file. Replace the quoted placeholders only after target/release approval; use no production target as a default.

```sh
git switch --detach 'REPLACE_WITH_REVIEWED_RELEASE_SHA'
supabase link --project-ref 'REPLACE_WITH_EXPLICITLY_APPROVED_TARGET_REF'
supabase migration list --linked
supabase db push --linked --dry-run
# Review the displayed target and exact pending versions against the frozen inventory.
# Only after the separate apply authorization, all gates and backup evidence:
supabase db push --linked
supabase migration list --linked
```

Linking/local binding and dry-run do not authorize production access or replace target verification. Ensure the first pending version/order and existing ledger match the approved state, and that normal migration execution honors the transaction/error-stop requirements above. Stop on collisions or unexpected versions rather than forcing history repair. The repository ignores local supabase/.temp and .branches binding artifacts. Do not commit credentials, use --db-url with secrets, run reset/seed/bootstrap against hosted Supabase, merge main or deploy Vercel as part of these steps.

No hosted CLI connection or apply command was run. The placeholder template is an approval-dependent runbook, not permission to execute it now.
