# Proposed frontend read API — version frontend-reads-v1

Prepared locally for review. **Not installed on production.** Proposal: `supabase/proposals/202610280016_frontend_reads.sql`; independent hash: `supabase/proposals/FRONTEND-READS.sha256`. It intentionally stays outside automatic Supabase migration discovery until separately approved. The original 15 files and production manifest are unchanged.

The proposal adds nine mass_api RPCs, one private invoker validation helper, one self-scope SELECT policy and SELECT on six scope columns only. It creates no table, identity, staff assignment, source row or operational reference data. The existing 71 policies are untouched; proposed total 72. All 23 tables still force RLS, with 155 columns and 27 FKs. API functions increase 11→20; existing 19 SECURITY DEFINER functions are unchanged. **All nine new RPCs and the helper are SECURITY INVOKER.**

## Security boundary

- Every new RPC requires actual database role `authenticated` and a managed request UID; neither business-role metadata nor a supplied user UUID establishes identity.
- `get_context` has no input identity/scope parameters. `self_scope_discovery` permits only the current UID's active grants, using server time and exclusive grant-end timestamps. Authenticated SELECT is limited to user_id, centre_id, role_code, starts_at, ends_at, can_read_profiles. Verifier identities, row IDs/revisions and whole-table SELECT remain private; INSERT/UPDATE/DELETE privileges are not added.
- All operational reads require one non-null centre and `mass_core.can_read(centre)` before querying. Existing table/profile RLS remains active; private name/gender/board fields are masked through the LEFT JOIN to existing private-profile RLS. There is no personal-data definer projection.
- Leadership remains programme read-only, private profiles remain masked, and an active Leadership designation prevents writes even with mixed grants. get_context computes write capability through the existing server helper; the frontend never selects its own business role.
- Unexpected inherited service_role/BYPASSRLS callers are rejected by actual-role checks even if they inherit authenticated function ACLs. No new definer, BYPASSRLS role, owner membership, provider Auth grant or schema exposure is introduced.
- Functions use fixed pg_catalog search paths, qualified static SQL, typed UUID/date inputs and no caller-controlled SQL. PUBLIC/anon/service_role direct EXECUTE is explicitly revoked. A fail-closed ACL check rejects unknown creator defaults or authenticated grant options.
- A schema USAGE privilege required by existing SQL/RLS dependencies is not Data API exposure. Never expose mass_core, mass_foundation or auth merely to support the frontend. Technical import/audit tables are never read by these RPCs.

## RPC inventory

| RPC | Inputs | Output / purpose |
| --- | --- | --- |
| get_context | none | JSON api_version, own user_id and active centres: id, label, roles, can_write, can_read_profiles. No other staff directory/grant metadata. |
| get_references | none; requires an active readable centre | Existing non-personal academic years, quarter periods, assessment definitions/maxima, programme cohorts and five attendance definitions. Respects current reference-table RLS; seeds nothing. |
| read_students | p_centre, nullable p_on, p_limit, p_offset | Child/permanent ID, episode ID, grade, shift, explicit interval/status/revision and RLS-masked private profile fields. Null p_on requests historical episodes within that centre; a date requests episodes covering that date. |
| read_attendance | p_centre, p_from, p_until, nullable p_child, pagination | Recorded row ID, child/episode/shift, date, exact code and row revision. Missing remains no row. |
| read_calendar | centre, date window, pagination | Existing confirmation calendar: date, shift, scheduled boolean, ID/revision. No evidence payload and no invented delivery statuses. |
| read_assessments | centre, date window, nullable child, pagination | Actual definition, date, score and correction revision tied to verified historical episode. |
| read_activities | centre, date window, pagination | Named single-shift events, explicit dates and revision. No catalogue/category/status assumption. |
| read_participation | centre, date window, nullable event/child, pagination | Event/child/episode/shift, event date, true/false/NULL and revision. |
| read_morarji | centre, nullable cohort, pagination | Membership/cohort/child/episode, optional outcome ID, independently nullable applied/attended/passed/school and actual outcome revision. |

All page limits are 1–100; offset 0–100000. Operational fact windows require explicit half-open from/until dates, from<until, at most 366 days. These are technical request bounds, not new programme/calendar/academic-year rules. Results have deterministic ordering and no arbitrary table/field selectors. The client reads at most 100 pages per endpoint and limits combined selections to ten assigned centres, failing visibly instead of silently truncating. Context/centre discovery and existing non-personal reference lists are the deliberate metadata exceptions to per-centre pagination.

Date windows and optional filters never widen centre scope. Child/event/cohort IDs from other scopes cannot return other-centre rows. Current verified centre grants allow historical reads as in the existing RLS model; actual historical visibility, staff provisioning and privacy approvals remain activation gates. New read availability does not grant export/disclosure permission.

## Revision and history contract

Reads return the stored row_version. Corrections pass that revision to existing typed RPCs; expected0 is used only for a verified missing row, never a guessed stale record. HTTP409 triggers read-back/review, not automatic write retry. Transport failure can have an unknown commit result, so the UI reloads and asks the user to verify before retrying. No optimistic mutation is presented as persisted.

Enrolment changes append a verified episode or explicitly close the first episode end; identity/context fields remain immutable. The UI labels the first day outside an episode explicitly and performs no implicit last-day conversion. Overlapping episodes are not automatically resolved for new facts. Existing assessed dates/context cannot be retagged. Participation Unknown writes a NULL response with revision; it is not removal. All deletion/restore, profile correction, batch-atomicity and richer audit/recovery contracts remain separate proposals.

## Local and later-hosted verification

`npm run test:api` creates an isolated PG 17.11 database, applies the 15 baseline migrations and synthetic fixture, then explicitly applies this proposal. It tests RLS/self-discovery, private masking, all centre/role/revocation boundaries, input bounds and actual Supabase SDK calls through real PostgREST 13.0.7. PostgreSQL/PostgREST/Node images are pinned; no host ports/mounts, production URL/credentials or real records are accepted. JWT issuance/Auth tables are synthetic stand-ins, not evidence of managed GoTrue sessions.

Prepared read-only acceptance is `supabase/proposals/016-postflight.sql`:23/155/27/72, original71 policies retained,20 API functions, nine invoker reads, same 19 definers and narrow scope-column ACLs. It has not run on production. The old baseline postflight expects 11 functions/71 policies; do not mistake that expected version difference for a failure after an approved 016 install.

If approved later, promote the exact reviewed/checksummed SQL to the normal migration directory in a separate release, inspect the pending ledger list for **016 only**, verify backup/recovery and target permissions, then obtain explicit hosted execution authorization. Never replay or rewrite the 15 deployed versions. No proposal has been promoted, linked or executed against the hosted project here.
