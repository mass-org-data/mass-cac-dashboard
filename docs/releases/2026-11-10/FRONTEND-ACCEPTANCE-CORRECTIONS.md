# Frontend acceptance corrections

The signed-in Phase F preview did not satisfy the frontend brief: names were masked in operational lists, assessment entry was paginated, the centre assessment register was absent, and navigation/reporting requirements remained incomplete. These corrections build on PR #15 (`a418344`) and keep the dependent PR stack intact.

## Explicit requirements added by Aashini

- All-role accounts default to Leadership. Accounts without Leadership keep their authorized Cluster Officer/Teacher default; no role is granted.
- Every login and role transition lands on Overview.
- Number navigation, scorecards and charts with page/component references such as 1.1; do not write “Chart” in a number label. Preserve internal chart IDs/calculations.

## Corrections

| Requirement | Implementation | Remaining acceptance boundary |
| --- | --- | --- |
| F01 | Leadership-first default, Overview entry and role label | Synthetic role/scope browser checks pass; fresh managed sign-in remains a release check |
| F02–F04 | Stable desktop collapse height, retained branding/role, ordered numbered menus, bottom Sign out, inline startup shell, general About, title case | Desktop/mobile synthetic browser screenshots captured |
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
| F23 | Shared direct page jumps, consistent dropdowns, action spacing and mobile rules | Synthetic browser verified; hosted sign-in review remains separate |
| F24 | Added fixture learners explicitly labelled TEST RECORD; no hosted test data | Existing hosted test cleanup is outside these changes |

## Security and data

No hosted schema, data, grants, RLS, feature flags, staff assignments or Production deployment was changed during implementation. Student names are read only using the existing writable-centre attendance roster; full private profiles and aggregate-only Leadership data remain restricted. Failed authorized name reads fail closed.

The additive register migration adds server-side bounded profile paging/search and a nullable notes field to immutable action receipts and versioned RPCs. It preserves v1/v2 clients, all existing marks, actors, immutable history, approved counts and activation controls. New save/delete tokens include the metadata revision to prevent stale notes from being overwritten or deleted. Imported creator identities remain explicitly unrecorded. No Auth IDs are exposed by attribution columns.

This migration has not been applied to hosted Supabase. The frontend falls back to the installed register version and clearly disables unsupported Notes. Do not label Notes or attribution complete on the deployed preview until the migration is installed and verified.

Registration, profile, activity and assessment-correction activation must not be inferred from form availability. Disabled forms are reviewable but Save remains disabled; direct RPC activation enforcement is retained.

## Validation

- Local: lint, syntax, build, 115 unit tests, 27 existing workflow checks.
- Local: 52 existing attendance SQL checks; 72 metadata/profile/stage checks (notes, replay, metadata concurrency, scoped denial, feature gate, audited deletion/history).
- Local: 22 scoped staff-access assertions; portable SQL/security tests and 1,440 independent calculation cases.
- Local: activation/provider transaction replay and preservation tests.
- Dependency audit: no high-severity findings; three existing moderate development-tool findings remain.
- Chromium now runs with the existing packaged browser in this executor. Browser acceptance exercises more than ten learners, failed-save draft retention, explicit Save/reopen/clear/delete, role loading, names/IDs, direct page jumps, search, assessment scrolling, and phone layout. CI runs the same suite with official Playwright Chromium.

## Release sequence

The correction branch targets Phase F. Keep PRs #10–#15 unmerged until the final corrected preview passes. Merge #10, #11, #12, #13, #14, #15, then the correction PR, adjusting bases carefully and preserving ancestor history. The current request authorizes implementation in this single correction PR. Keep the production frontend unchanged; no merge is part of this request. PR #10 was already merged by the time of the fresh repository check. Verify the remaining stack before any later release.

## Follow-up verification and corrections in this same PR

- Verified PR #15's Vercel deployment `dpl_D7RehTJH3gGmbnHwxVqJNvkmrcS3`: READY, commit `a418344146f245e532082711382ba22defb3dadb`, branch `feature/requirements-phase-f`, region `bom1`. Its source was current; the requested acceptance features were absent from that code. This does not establish which URL/session the reviewer used.
- Fixed a real attendance-popup failure: the title is outside the form, so the roster must locate it through the enclosing dialog. The previous form-only lookup threw and replaced the roster with an error.
- Fixed nested rendering when a page-jump input loses focus during replacement of the application root. Unchanged page values no longer rerender; any nested render is queued.
- Overview now uses aggregate reads for every role before detailed downloads. Other roles are never loaded implicitly. Opening Profiles loads roster/basis data; Assessments loads roster/results; Activities loads roster/participation; individual student detail loads its supporting modules explicitly. Teacher Overview charts remain available. Visits do not load all student facts on save.
- Added a bounded `student_profile_page` read: search/sort happen across all matching authorised rows before returning up to ten IDs and a total. Names use only the existing writable-centre roster authority; gender remains protected by the existing private-profile grant. The installed-version fallback retains full-scope local filtering/paging. Existing roster snapshots still support record actions; this is not a claim that the application never caches roster records.
- Attendance and Activity participation now share an unpaginated roster component. Activity values still use the separate participation API, not classroom attendance codes.
- Annual exports wait for pending reporting reads, state that all filtered rows are included, and preserve unknown counts. Donor explanations use annual rather than reporting-month scope.
- Added a server constraint matching the existing nullable Morarji client checks. Confirmed contradictions are rejected; unknown earlier facts are not inferred. `NOT VALID` preserves any historical rows without rewriting them; new writes are checked. No Morarji write gate is enabled.

### Backend/model and data review

Read-only hosted inspection found 28/28 `mass_core` tables with forced RLS. It confirmed the separate children/private-profile design, scoped APIs and existing version/audit mechanisms remain relevant. The original point-by-point response is `docs/releases/2026-11-05/DATA-MODEL-FEEDBACK.md`; prefixes, foreign keys, row versions, date boundaries, delivery versus calendar, assessment keys and retained provenance are explained there. Before this PR's migration, the Morarji outcome table had only its school-name-length check; client-only stage validation was a real server gap, now addressed by the pending additive constraint.

At inspection: 1,458 children/enrolments; 47,338 attendance observations; 207 assessments; one visit; zero named activity events, participation records or Morarji outcomes. These are observations, not a completeness certificate or invented zeros for historical programme activity. Historical activity slots and Morarji/visit source observations still need the source-owner mappings described in `docs/OPEN-DECISIONS.md` and the import exception records. No source rows were newly imported or deleted here.

Source-ZIP review: neither `scripts/build.mjs` nor the CI release path generates a downloadable source ZIP. The server has a ZIP MIME type, not an automatic archive-generation workflow. GitHub's own source-download facility is external to the dashboard; no dashboard control or build job was removed without evidence.

### Validation boundaries

Unit and browser tests use isolated synthetic records. New fixture learners and notes use `TEST RECORD` labels. No hosted programme record was inserted, corrected or deleted to test these changes. The populated migration test injects a failure, verifies rollback of the new column and function, then installs successfully while comparing attendance, assessment, grant and activation fingerprints.

The metadata migration, `student_profile_page`, and server Morarji constraint must be installed before their hosted acceptance can be marked complete. Registration, private-profile editing, activity writes and assessment corrections retain their existing activation controls. D02–D08, final Overview filter agreement, and training-data approval remain programme/reviewer decisions. This PR does not grant new staff roles or invent retest/session/outcome rules.


### Final local checks

- 115 unit tests and 27 workflow checks passed.
- 52 attendance SQL checks and 72 metadata/profile/stage checks passed, including populated rollback/preservation and all 27 nullable stage combinations.
- 22 scoped staff-access assertions passed.
- 1,440 independent SQL/calculation cases, core/visit security matrix, and activation/provider replay passed.
- Lint, syntax checks and build passed. Dependency audit has no high/critical findings; existing moderate development-tool findings remain.
- Browser assertion count and the latest connected Preview are recorded in the PR after the final run. Synthetic screenshots are CI artifacts, not real child data.
