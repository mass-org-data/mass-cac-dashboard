# SECURITY DEFINER review — final production preflight

27 October 2026. Frozen SQL baseline `6a2cf56bf3998357b422c86b11a64d3129bdfbd1`. All 19 SECURITY DEFINER functions were reviewed against their migration bodies and the isolated catalog. No implementation changes. Managed-provider effective permissions remain unverified. Exact signatures/ACLs are in [the inventory](DATABASE-SCHEMA-INVENTORY.json).

All 19 use fixed `search_path=pg_catalog` and qualified application references. They use no dynamic SQL or caller-specified relation names. Every function explicitly restricts callers through a local ACL or the owner role default privilege revoke. No PUBLIC/anon/service_role EXECUTE is present or effective in the isolated test cluster.

| Function | Local direct EXECUTE | Review |
| --- | --- | --- |
| `mass_api.add_enrolment` | `mass_core_owner` and `authenticated` | Checks writable existing child and destination centre; inserts a new immutable episode. |
| `mass_api.add_morarji_member` | `mass_core_owner` and `authenticated` | Checks writable enrolment; composite FK binds membership to that episode. |
| `mass_api.close_enrolment` | `mass_core_owner` and `authenticated` | Locks episode, checks centre/version and first closure; trigger prevents invalidating facts. |
| `mass_api.create_activity` | `mass_core_owner` and `authenticated` | Checks destination centre; inserts explicit dated event. |
| `mass_api.record_assessment` | `mass_core_owner` and `authenticated` | Checks writable episode, locks result and validates revision; immutable context plus date/score constraints. |
| `mass_api.record_attendance` | `mass_core_owner` and `authenticated` | Checks writable episode, locks existing mark and validates revision; calendar/date/uniqueness guards. |
| `mass_api.record_morarji` | `mass_core_owner` and `authenticated` | Checks membership centre, locks outcome and validates revision; preserves nullable source flags. |
| `mass_api.record_participation` | `mass_core_owner` and `authenticated` | Checks episode and event centre/shift, locks response and validates revision. |
| `mass_api.register_student` | `mass_core_owner` and `authenticated` | Checks centre write scope; atomic identity/profile/episode creation; no name-based merging. |
| `mass_core.can_read` | `mass_core_owner` and `authenticated` | Reads verified time-bounded user/centre grants using auth.uid(). |
| `mass_core.can_read_child` | `mass_core_owner` and `authenticated` | Checks whether at least one historical episode is in readable centre scope. |
| `mass_core.can_read_profile` | `mass_core_owner` and `authenticated` | Requires explicit profile capability and Teacher/CO scope; any active Leadership role excludes names. |
| `mass_core.can_write` | `mass_core_owner` and `authenticated` | Requires scoped Teacher/CO grant; any active Leadership designation blocks business writes. |
| `mass_core.can_write_child` | `mass_core_owner` and `authenticated` | Checks whether at least one episode is in writable centre scope. |
| `mass_core.guard_record` | `mass_core_owner` only | Trigger-only; immutable identity/context, revision and date/closure/calendar integrity; no arbitrary dynamic SQL. |
| `mass_core.period_contains` | `mass_core_owner` and `authenticated` | Checks explicit academic-year/quarter boundaries for the supplied date. |
| `mass_core.record_audit` | `mass_core_owner` only | Trigger-only; validates allowlisted core table, appends revision/Auth UID/DB actor atomically; no raw values. |
| `mass_core.writable_enrolment` | `mass_core_owner` only | Owner-only helper; locks episode and requires current user centre write scope. |
| `mass_foundation.record_audit` | `mass_foundation_owner` only | Trigger-only; validates allowlisted table/operation, appends revision-only metadata and DB actor; no raw values. |

The other two `mass_api` functions (`attendance_summary`, `list_students`) are SECURITY INVOKER and retain caller RLS; no new definer surface is added. Trigger function invocation does not require callers to have direct EXECUTE once the trigger has been installed. SQL invoker helper/guard ACLs are also captured in the inventory.

## Effective-permission acceptance

- Private schemas are not Data API exposed schemas. Schema USAGE granted to authenticated for SQL/RLS dependency resolution is not endpoint exposure.
- Technical owners must remain trusted NOLOGIN/NOBYPASSRLS roles with reviewed administrator memberships only. Their deliberately permissive helper-read/owner policies mean membership or SET ROLE access is a privilege boundary, even with FORCE RLS.
- Local catalog/default ACLs and actual role tests cover PUBLIC, authenticated, anon, service_role and forbidden role assumption. Hosted inherited grants, creator memberships, existing owner/default ACLs and the authenticator must be checked independently.
- Run the prepared production preflight and postflight metadata reports and review exact function ACLs against this inventory. A count of 19 and fixed search paths alone do not prove safe ownership, provider Auth or caller verification.
- `auth.uid()` is trustworthy only behind the approved managed Auth/gateway or trusted server. Arbitrary SQL sessions can set request-claim settings; never grant business clients direct database login or membership in technical roles.
- User/centre assignments, historical visibility and private-profile capability remain real-operation approvals. No real scope rows are installed by migration.
- Definer writes require immutable published SQL and reviewed future grants: do not expose private schemas, add PUBLIC execute, grant broad owner memberships or widen service_role access to make staging pass. Any necessary correction is a separately reviewed migration.
