# Approved multi-role staff access

This dependent change follows Attendance PR #8. Three explicitly approved Auth accounts can retain Leadership reporting access while entering programme records within their verified Teacher/Cluster Officer assignments. Ordinary Leadership accounts, unapproved mixed-role accounts and out-of-scope centres remain blocked for writes.

The server returns an explicit `operational_roles_enabled` flag from a private forced-RLS approval table, never user-editable Auth metadata. `can_write` still requires an active Teacher or Cluster Officer centre grant; the approval only removes the blanket Leadership veto for these accounts. A flag alone cannot grant centre access. Global feature flags are preserved; visit entry is available only to explicitly approved accounts with their own verified, dated officer assignments. Disabling the private approval immediately restores the Leadership write block.

The frontend defaults approved multi-role accounts to Cluster Officer and enables the existing verified-role selector using only roles returned by the server. Leadership shows the reporting scope, Cluster Officer its assigned centres, and Teacher only teacher-assigned centres. Attendance popups and assessment rosters follow the selected role's centre set. Detailed record loading is restricted to operational write centres; 92-centre Leadership reporting continues through aggregates. Existing profile flags are unchanged.

New officer identities are explicitly Auth-backed operational staff, not fabricated spreadsheet observations. Original source-backed staff and assignment provenance remains intact and immutable. New assignments start on the approval date and cover both shifts; no historical visit assignment is inferred. Imported source-slot uniqueness is retained through a partial index, allowing separate Auth-backed assignments without fake source-row IDs.

## Hosted installation and verification

- Source: `20261109080424_approved_multi_role_staff_access.sql`; hosted receipt `20261109081705`.
- Three existing Auth accounts were resolved exactly. One requested email spelling was corrected by the user before any grant was made.
- `scripts/staff/clone-operational-access.sql` mirrors the currently verified template, using exact Auth emails supplied privately at execution. It never creates Auth accounts or copies passwords. Each account has Leadership access to 92 centres, Cluster Officer scope over nine centres, and Teacher scope over one centre (Hosayaragudri), both shifts.
- Two new accounts received 204 centre-role grants; the template account's grants were retained. Only three private operational approvals and three Auth-backed staff identities were added, with nine officer assignments per identity. The original source staff rows remain untouched.
- Hosted scope/capability probes passed for all three accounts: nine writable centres, nine owned officer assignments, enabled attendance/assessment/visit entry. Actual attendance, assessment and visit saves were verified for each account inside an explicitly rolled-back transaction. No test programme observations persisted.
- Programme counts before/after: 47,323 attendance, 207 assessments, zero visits. Scope grants increased from 379 to 583; staff identities from 136 to 139.

## Validation

93 frontend tests, 27 existing workflow checks, 52 attendance SQL assertions, 22 dedicated operational-access assertions (including exact template cloning for multiple identities), existing core/definer-security SQL, and 1,440 independent calculation comparisons pass. Chromium's extended 32 assertions cover mixed-role attendance, assessment and visit saves, Leadership view-only mode, and teacher-only roster scope, alongside the existing popup/clear/deletion/mobile checks. Lint, syntax/build and diff checks pass.

Hosted checks prove database authorization and write contracts; they do not substitute for each user's managed sign-in. Use the updated branch Preview and sign out/in to pick up the new role/scope context. The frontend is not merged to main or released to Production by this change.
