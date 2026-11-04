# Final code/security review

Review scope: changes after 45cd4d3 on feature/supabase-frontend; no migration001–023 or proposal 024 SQL changes, no dependency additions, no frontend recreation or redesign.

| Finding | Correction / evidence |
|---|---|
| Grade choices ignored selected Shift | Shared dated facets now respect Shift and other applicable scoped population selections;5,376 independent live SQL cases. |
| Invalid Grade survived Shift changes | Shared reconciliation before render/aggregate/export; valid grades preserved. Twelve focused tests and real local-browser cases cover changes in any order. |
| Centre/donor/year/history changes could retain stale dependent choices | Directory scope reconciliation, loading guard, year-aware reset and render-time validation; no guessed replacements. |
| Profile masking could be confused with missing gender | Protected aggregate proofs provide masked-user facets; masked NULL is never treated as actual Unknown.18browser cases include Leadership without profile access. |
| Missing gender chart shortcuts and grouped cohort presentation | Original buttons/group geometry and verified-year shortcut restored; known/unknown counts remain distinct. |
| Live help short-circuited source download/export controls | Safe code-only ZIP and authorized CSV restored; actual ZIP/CSV download tested. No private artifacts in source archive. |
| Engagement export could imply unapproved classification | Live CSV records unknown colour-boundary state instead of fake No/zero.024aggregate exports preserve distinct-child versus enrolment grains. |
| New async facets could survive logout or stale year | Adapter removed on session cleanup; reads reuse existing epoch/scope-keyed caches and aborted session controller; old epoch responses cannot replace new data. |
| Sticky controls intercepted mobile drawer | Live-only mobile z-index correction; actual pointer navigation test. Base stylesheet/assets unchanged. |
| Empty-database migration tests did not prove populated upgrade preservation | New isolated001–019seeded upgrade freezes all 27 old-table projections; checks after each020–023 and024proposal read; exact-file rollback/retry after every injected failure. |
| Original visual comparison could hide real/source differences |40 screenshots and source-reference inventory recorded separately from real-data/RLS tests; no claim of universal pixel identity or all source charts numerically verified. |

## Authorization and privacy review

All reference/facet inputs are authorized get_context/read_students data or existing scoped aggregate APIs. No client-selected role becomes server authority. Teacher centre scopes and Cluster Officer assignments stay enforced by the unchanged database policies. No real user, role membership, staff mapping, RLS policy, schema exposure or service credential was added. Leadership remains read-only and profile-masked; anonymous programme reads/writes remain denied.

Proposal 024 was reviewed separately: staff session required;1–100 non-null readable centres and all-or-error scope validation; configured year/calendar-month/grade/shift/gender/exam validation; fixed mass_core_owner and search_path; aggregated outputs only; no raw student/profile/feedback/provenance data; no PUBLIC/anon/service_role execution grant. Local expiry/mixed-scope/anonymous/ACL tests pass. Owner-level read access inside a SECURITY DEFINER function is a deliberate approved scoped-aggregate boundary, not proof of hosted compatibility. No elevated shortcut or direct private-schema exposure was introduced. Proposal remains unpromoted/unapplied.

Approved calculations remain in the unchanged reviewed-calculations module and SQL proposal. L=Leave, P/(P+A+L), quarterly 25 mark maxima, UUID-based distinct counts and same-child pairing are retained. No date/shift/name identity inference, schedule-as-delivery assumption, absent-as-unknown conversion, extra Morarji outcome or new numerical engagement threshold was introduced.

Private snapshots, source workbooks and row-level staff reports remain outside Git. Only aggregate counts, public code, synthetic fixtures and privacy-safe documentation are publication candidates. Source ZIP is allowlisted; .env.example placeholders do not contain runtime credentials. CSV formula escaping and stored-markup escaping retain existing tests.

No unresolved code finding is being presented as a reason to weaken security. Remaining hosted recovery/access, source and policy dependencies are explicit in GAP-REGISTER.csv. Full live deletion/undo, sensitive-note storage and source-free guidance remain intentionally blocked; preserving controls does not justify destructive or unauthorized implementation.
