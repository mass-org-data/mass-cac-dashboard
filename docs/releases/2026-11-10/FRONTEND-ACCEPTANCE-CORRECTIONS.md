# Frontend acceptance corrections

The signed-in Phase F preview did not satisfy the frontend brief: names were masked in operational lists, assessment entry was paginated, the centre assessment register was absent, and navigation/reporting requirements remained incomplete. These corrections build on PR #15 (`a418344`) and keep the dependent PR stack intact.

## Explicit requirements added by Aashini

- All-role accounts default to Leadership. Accounts without Leadership keep their authorized Cluster Officer/Teacher default; no role is granted.
- Every login and role transition lands on Overview.
- Number navigation, scorecards and charts with page/component references such as 1.1; do not write “Chart” in a number label. Preserve internal chart IDs/calculations.

## Corrections

| Requirement | Implementation | Remaining acceptance boundary |
| --- | --- | --- |
| F01 | Leadership-first default, Overview entry and role label | Signed-in deployed read-scope verification |
| F02–F04 | Stable desktop collapse height, retained branding/role, ordered numbered menus, bottom Sign out, inline startup shell, general About, title case | Browser screenshots and narrow-screen checks |
| F05–F08 | Leadership Overview uses month, centre, donor and year; demographic/shift breakdowns; whole-selection scorecards; consolidated sorted centre table; annual donor filter order | Retained centre/time filters are an implementation assumption for review |
| F09 | Monthly attendance line directly below Attendance scorecards | Approved calculation unchanged |
| F10 | Unapproved activity/Morarji columns omitted from Overview comparison | D04/D05 still require programme decisions |
| F11 | Export explanation retained; MASS copyright footer | Download contents and hosted reporting check |
| F12–F14 | Ordered register; creator/editor columns; fixed Teacher centre; Notes; conditional correction reason; existing-record prompt; grouped Delete/Cancel/Save | Notes/attribution require migration `20261110120000_attendance_register_metadata.sql` |
| F15 | Weekly Off label; installed Sunday-only backend restriction explained | D02 pending; backend calendar semantics unchanged |
| F16 | Reuse the existing authorized attendance name roster for operational names; name/ID search; gender/shift sorting; direct page jumps; registration form review | Registration/profile activation remains enforced |
| F17 | Remove live global correction/removal launcher; keep edits with identifiable module records | Unsupported destructive removal stays unavailable |
| F18 | Visit saves refresh only the saved month/scope rather than reloading all student/attendance facts; stale visit reads cannot overwrite the refreshed list; inset actions | Signed-in deployed save check |
| F19–F21 | Single unpaginated whole-centre marks roster; live round feedback; existing-result prompt; saved centre/date/round groups; same group form for edits; historical unknown dates preserved; separate student comparison | Retests and uniqueness changes await D03; correction gate unchanged |
| F22 | Activity session/participation forms and analysis retained; disabled forms explain activation and cannot save | D02/D04 and hosted activity activation remain pending |
| F23 | Shared direct page jumps, consistent dropdowns, action spacing and mobile rules | Synthetic browser plus hosted visual review |
| F24 | Added fixture learners explicitly labelled TEST RECORD; no hosted test data | Existing hosted test cleanup is outside these changes |

## Security and data

No hosted schema, data, grants, RLS, feature flags, staff assignments or Production deployment was changed during implementation. Student names are read only using the existing writable-centre attendance roster; full private profiles and aggregate-only Leadership data remain restricted. Failed authorized name reads fail closed.

The additive register migration adds a nullable notes field to immutable action receipts and versioned RPCs. It preserves v1/v2 clients, all existing marks, actors, immutable history, approved counts and activation controls. New save/delete tokens include the metadata revision to prevent stale notes from being overwritten or deleted. Imported creator identities remain explicitly unrecorded. No Auth IDs are exposed by attribution columns.

This migration has not been applied to hosted Supabase. The frontend falls back to the installed register version and clearly disables unsupported Notes. Do not label Notes or attribution complete on the deployed preview until the migration is installed and verified.

Registration, profile, activity and assessment-correction activation must not be inferred from form availability. Disabled forms are reviewable but Save remains disabled; direct RPC activation enforcement is retained.

## Validation

- Local: lint, syntax, build, 111 unit tests, 27 existing workflow checks.
- Local: 52 existing attendance SQL checks; 28 new metadata checks (notes, replay, metadata concurrency, scoped denial, feature gate, audited deletion/history).
- Local: 22 scoped staff-access assertions; portable SQL/security tests and 1,440 independent calculation cases.
- Local: activation/provider transaction replay and preservation tests.
- Dependency audit: no high-severity findings; three existing moderate development-tool findings remain.
- Local Chromium launch is blocked by executor socket permissions; the shared browser cannot reach the local fixture port. Added a separate GitHub browser-acceptance job with official Playwright Chromium. Do not claim browser acceptance before that job passes.

## Release sequence

The correction branch targets Phase F. Keep PRs #10–#15 unmerged until the final corrected preview passes. Merge #10, #11, #12, #13, #14, #15, then the correction PR, adjusting bases carefully and preserving ancestor history. The user authorized merging when appropriate, but release readiness still requires the hosted metadata migration and final signed-in preview acceptance.
