# Phase 2C — decision analysis

Review date: 26 October 2026. Existing Phase 2B evidence is reused; no full workbook audit was repeated. The original review left all 15 decisions open. A dated Phase 2D approval overlay (26 October 2026) now records eight Conditional, four Partial and three Pending dispositions. Original evidence/recommendations below are preserved; only explicitly stated technical principles are accepted. Business conditions remain unresolved and implementation is not authorized. Source references resolve through SOURCE-INVENTORY.md and DATA-QUALITY-REPORT.md.

P0 = identity/security/data-grain blocker for the affected live path; P1 = module or historical-promotion gate; P2 = process/completeness gate. A lower priority is not permission to skip an approval. Approving a safe handling approach does not fill in missing business facts.

## D01 — Student identity (P0)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Use internal UUIDs only for verified child identities; never manufacture external identifiers or merge by names alone; uncertain cross-source matches stay unresolved until authorized review.

**Remaining pending decision:** Identity-matching authority, evidence standards, external-ID issuer/scope/display, actual matches and the accepted-current revision contract.

**Required evidence / proposed owner group:** MASS designated identity/data owners; documented matching authority and protected corroborating evidence. No individual is assigned here.

**Current implementation gate:** No person matching, UUID allocation for uncertain people, canonical FK promotion or external-ID constraints until authority/evidence/scope are resolved. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve an authoritative identity owner/reviewer process, admissible evidence, handling of namesakes, technical UUIDs for confirmed people, and the scope/display of any real external student ID. Approval of a method is not approval of a person match.

**Evidence already established:** Phase 2B: MOR 550/550 and ACT 2,557/2,557 named rows lack Student ID; ATT/ASM have no shared child-ID column; CHILD-01 has 72/98 blank local serials. No source proves cross-workbook identity.

**Database impact:** Gates children/private_child_profiles and every child FK. identity_resolutions must retain evidence, ambiguity, reviewer and one explicit current accepted revision. children.external_student_id alone lacks issuer scope for scoped uniqueness.

**Existing frontend impact:** Use server-returned internal IDs, preserve visible names/forms, and never fabricate CAC-style source IDs. If showing a technical record reference, label it as such. Search/linking must not merge by name.

**Recommended approach:** Approve human-adjudicated, evidence-backed resolution with no name-only matching; create technical UUIDs only for confirmed people; leave absent external IDs NULL. Until issuer scope is approved, keep external source identifiers in provenance and do not enforce a guessed global external-ID unique rule.

**Risks and consequences:** Review effort and unresolved records reduce early coverage; wrong reviewer decisions can still merge people. Require attributable decisions, reversal/history and coverage reporting.

**Must implementation wait?:** YES for canonical people/matches and business FK promotion. Metadata shells and synthetic identity-review tests can be drafted after technical approval without resolving real people.


## D02 — Historical assignments and source precedence (P0)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Preserve original centre/class/shift observations and historical assignments; do not overwrite past assignments with current values; never invent enrolment, transfer or exit dates.

**Remaining pending decision:** Source precedence, centre aliases/residence distinctions, verified effective dates, multiple-shift/centre and overlap handling.

**Required evidence / proposed owner group:** MASS programme staff and source data owners; approved precedence/alias map and evidenced dated placement decisions.

**Current implementation gate:** No guessed intervals, source-precedence merges or final overlap/attendance-grain constraints; unknown history remains observations. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve authoritative attendance input views, centre aliases versus residence labels, legitimate multiple shifts/centres, effective-date evidence, enrolment/transfer/re-enrolment rules and overlap policy. Identify which legacy dates remain unknown.

**Evidence already established:** Phase 2B: 15 centre tabs have 494 named occurrences, master 494 and hidden helper 429; they are not additive populations. CHILD retain/remove has no effective dates; current profile attributes are not a history ledger.

**Database impact:** Use placement_observations for source snapshots and enrolments/staff_assignments only for confirmed intervals. Canonical attendance uniqueness and any exclusion constraints depend on multi-shift/overlap policy.

**Existing frontend impact:** Keep registration layout; transfers/class/shift changes require explicit effective context or a narrowly scoped correction action. A current profile edit must not reattribute earlier attendance or marks.

**Recommended approach:** Treat dated centre-tab cells as candidates and master/helper as reconciliation evidence until source owner confirms precedence. Keep unresolved placements as observations; never default start to grid start or assign an exit date from Remove. Propose half-open dated intervals for approved future episodes.

**Risks and consequences:** The apparently more detailed source may still be stale; owner confirmation is necessary. Unknown intervals limit as-of reports. Overlap rules imposed too early may reject legitimate participation.

**Must implementation wait?:** YES for source precedence, accepted interval creation, overlap constraints and historical reports. Undated observations can be designed independently; no real loading is authorized now.


## D03 — Attendance statuses and metrics (P0)

**Phase 2D approval status:** Partial

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Preserve original attendance codes without reinterpretation; do not calculate final metrics from unconfirmed statuses.

**Remaining pending decision:** Meanings of P, A, WO, MM, L and other observed codes; holidays/non-scheduled days; denominator/exclusions/aggregation; calendar and correction rules; dropout/engagement semantics.

**Required evidence / proposed owner group:** MASS attendance/programme staff and data owners; literal code glossary, calendar evidence and signed-off calculation/correction rules.

**Current implementation gate:** No final attendance metric, code conversion, held-session inference or live entry/denominator policy until confirmed; even P/A semantics remain pending under this approval. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Provide an approved mapping for P/A/WO/MM/L and any H extension: exact meaning, calendar/child scope, attendance credit, denominator eligibility and missing treatment. Approve held-session evidence, attendance bands, CAC-dropout versus survey/school-dropout meaning, engagement rule and reporting as-of/time-zone behavior.

**Evidence already established:** ATT validations contain P/A/WO/MM/L; frontend uses P/A/H and explicit Held sessions. Historical slots are not cultural/sports events. Phase 2A documents different date selection for counts versus percentages and a fixed demo clock.

**Database impact:** attendance_codes can retain literals without semantics. Denominator/dropout/engagement views and canonical session relationships must wait for policy. Source blank marks remain unknown; no invented sessions.

**Existing frontend impact:** Current P/A/H controls cannot represent all source statuses faithfully. Preserve layout but require approved code display/options and clear unavailable/incomplete metric states; replace fixed demo date only under reviewed live-date rules.

**Recommended approach:** Preserve literals and withhold unsupported derived metrics until the mapping/calendar is approved. Do not map WO/MM/L to H or A by convenience. Do not use the baseline survey Dropout? response as derived CAC/school dropout without definition. Version approved calculations separately from raw facts.

**Risks and consequences:** Some dashboard cards cannot initially show a valid metric; showing a familiar but unsupported percentage is riskier. Overly broad code mappings can permanently distort history.

**Must implementation wait?:** YES for semantic constraints, real entry options, denominator/engagement/dropout publication and session inference. Literal-code/reference shapes and synthetic null-preservation tests can be prepared first.


## D04 — Calendar and malformed day cells (P1)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Preserve raw source information, quarantine unresolved date/header/formula anomalies, maintain transparent correction/exception records and never modify original workbooks.

**Remaining pending decision:** Actual anomaly resolutions, accepted header/date precedence, evidence of corrected values and authority to accept/reject affected source occurrences.

**Required evidence / proposed owner group:** Source data owners with programme review; cell/header-specific adjudication and immutable source references.

**Current implementation gate:** Quarantine/documentation handling is approved; do not correct/promote disputed values or treat a quarantine policy as permission to load raw data. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve treatment of ATT-06 extra day, ATT-18 duplicate date column, undated ATT-02 and ATT-04 calculated numeric day values. Identify authoritative date evidence and how conflicting copies are adjudicated.

**Evidence already established:** Phase 2B: ATT-06 extends to 1 July 2027; ATT-18 has 366 date-labelled columns but 365 distinct days; hidden helper lacks day headers; ATT-04 has 14 COUNTIF values in date-labelled CO.

**Database impact:** Quarantine source occurrences/cells with explicit reasons; do not create conflicting dated facts or let a source-date collision become last-write-wins.

**Existing frontend impact:** Normal dated attendance form can remain; legacy coverage must explain excluded/unresolved days instead of showing zero or guessed attendance.

**Recommended approach:** Keep original cells immutable and segregate date/header anomalies. Accept only individually resolved distinct dates; do not drop extra dates merely to match a filename or date helper marks by copying another tab calendar.

**Risks and consequences:** Partial coverage persists until review. Excluding a real extra day or treating a subtotal as a mark could bias counts; retain reconciliation evidence.

**Must implementation wait?:** YES for promotion of affected legacy cells and complete-period claims; unaffected schemas/synthetic tests may proceed after technical approval.


## D05 — Academic years, quarters and dates (P0)

**Phase 2D approval status:** Partial

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Preserve actual source academic-year/quarter information; keep missing values explicitly unknown; never infer year from a neighbouring row without an approved rule.

**Remaining pending decision:** Academic-year mapping, quarter definitions/bounds, any Q-to-F equivalence, locale/century and missing/inconsistent date treatment.

**Required evidence / proposed owner group:** MASS assessment/programme staff and source owners; approved period calendar and row/block/date interpretation evidence.

**Current implementation gate:** No year forward fill, Q-to-F alias, century/date coercion or canonical period-dependent result promotion until approved. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve evidence-backed year assignment per source block/row, date locale and two-digit-century parsing, whether Q1-Q4 correspond to F1-F4, and any actual quarter/year boundaries. Specify what remains unresolved.

**Evidence already established:** Phase 2B: 1,794/1,798 named assessment rows lack year; actual quarters Q1/Q2; 373 date texts use trailing punctuation or two-digit years; 948 dates are blank.

**Database impact:** Use year -> period -> definition -> result; retain unresolved source year/date in staging. Do not enforce guessed boundary checks or populate frontend alias fields before approval.

**Existing frontend impact:** Learning needs year/definition context and approved quarter labels; a small selector/label change is justified. The same round editor layout can remain; default year and student+round-only keys cannot.

**Recommended approach:** No blanket forward fill or automatic 20xx century inference. Accept a block-level year rule only with owner approval and provenance to the contextual source cells. Prefer actual Q labels until an F alias is confirmed; retain NULL boundaries if not known.

**Risks and consequences:** Many results remain quarantined and cross-year comparisons unavailable. A convenient fill rule can silently move outcomes to the wrong year.

**Must implementation wait?:** YES for real year/date transformations, Q-to-F aliases and period-dependent result promotion. Empty references and synthetic multi-year tests can be drafted independently.


## D06 — Assessment scales and result grain (P0)

**Phase 2D approval status:** Partial

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Preserve original numeric scores; do not rescale them or invent performance bands.

**Remaining pending decision:** Maximum by paper/type/shift, precision, attempts, assessment statuses, accepted dates and reporting/comparison rules.

**Required evidence / proposed owner group:** MASS assessment staff and data owners; paper/scale documentation, repeated-result interpretation and reporting rules.

**Current implementation gate:** No scale changes, inferred maximum, attempt defaults, status/NULL conversions, bands or comparisons until resolved. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve true maximum per paper/period/project/shift, allowed precision, paper identity/comparability, repeat attempts, missing/absent statuses, required result dates and duplicate-result policy.

**Evidence already established:** Phase 2B: morning maximum metadata 100 but all 802 numeric morning scores <=25; evening maximum 25; all 1,693 numeric scores <=25. Validation permits decimals; 105 named rows lack score; ASM-02 has two excess candidate keys.

**Database impact:** Keep numeric score type and immutable approved definition revisions. Cross-row maximum validation needs an RPC/trigger/transaction, not an impossible CHECK against another table. Nullable attempt uniqueness needs explicit NULL semantics; do not invent attempt=1.

**Existing frontend impact:** Keep marks grid, but max/precision/year/paper controls and comparisons must come from approved definitions. Integer-only checks, fixed 25 bands and raw mixed-paper comparisons cannot be assumed correct.

**Recommended approach:** Preserve scores exactly; neither rescale to 100 nor silently redefine maximum as 25. Leave definitions pending until owner confirms. Keep missing distinct from zero and Absent. Quarantine duplicate/attempt ambiguity rather than create a fake attempt number.

**Risks and consequences:** Pending scales limit charts; flexible numeric types need strict approved validators to avoid accepting arbitrary values. Same maximum still does not prove comparable papers.

**Must implementation wait?:** YES for canonical definition uniqueness, accepted scores/status rules and performance bands/comparisons. Storage-shape drafts and synthetic scale/null tests can be prepared first.


## D07 — Monthly activity versus events (P1)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Keep historical monthly activity responses separate from future dated events; infer neither dates nor categories from generic monthly Yes/No slots.

**Remaining pending decision:** Slot interpretation/event mapping, any bridge to real events, historical display and approved future-event/data-entry contract.

**Required evidence / proposed owner group:** MASS activity/programme staff and source owners; slot/event evidence and product owner approval of separate historical display.

**Current implementation gate:** No event synthesis, category/engagement attribution or blended historical/event aggregates; separation principle does not approve tables or module rollout. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve what each Activity 1-4 slot represents, eligibility, reporting interpretation and any verified link to actual event/date/category. Decide whether new dated event capture is an initial requirement.

**Evidence already established:** Phase 2B: ACT month context is October 2026; 2,557 named rows; 5,113 blank slot cells; no centre, shift, event date/category/title/status fields.

**Database impact:** Keep monthly_activity_returns/responses separate from activity_events/participation. Optional bridge FK stays NULL until verified. Source Yes/No/blank semantics do not create a Held event.

**Existing frontend impact:** New event-entry layout can remain after its contract is approved. Historical monthly responses need a clearly distinct read representation; they cannot masquerade as dated Saturday cards or cultural/sports engagement.

**Recommended approach:** Preserve month/slot and unknown values exactly; no fabricated dates/categories or bulk blank->No conversion. Approve future explicit event entry independently; require an approved minimal monthly-history display if integrating these historical sources.

**Risks and consequences:** Two grains increase adapter/report complexity. Blending them without provenance can double count participation or invent event-specific engagement.

**Must implementation wait?:** YES for slot interpretation, event bridges and engagement aggregation. The separate storage pattern and null/slot tests can be drafted after technical scope approval.


## D08 — Morarji cohorts and outcome semantics (P1)

**Phase 2D approval status:** Partial

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Preserve source-backed indicators and school names as observations; do not populate unsupported award or training fields. The observed columns are Applied, Attended, Passed and School Name; the file title does not prove training-day totals.

**Remaining pending decision:** Cohort definitions/periods, source Date/Attended meaning, outcome interpretation/conflicts, reporting classifications and optional extra fields.

**Required evidence / proposed owner group:** MASS Morarji/programme staff and source data owners; confirmed cohorts, field meanings and contradiction review.

**Current implementation gate:** No guessed cohort or conversion to training-day/exam/award classifications; unsupported counts/selection/admission/scholarship stay unpopulated. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve cohort identity/year, source Date meaning, person linkage, repeat-cohort/attempt rules, contradictions, and treatment of School Name if Passed. Separately approve any training-day/selection/admission/scholarship extension.

**Evidence already established:** Phase 2B: all 550 named rows lack ID and Date; no cohort-year field; 30 attendance/application and five pass/attendance conflicts. Source has Applied/Attended/Passed/School, not extra award fields.

**Database impact:** Use confirmed cohort membership with literal nullable source flags; leave unresolved cohort rows staged. No fabricated year or paper/award transition. One outcome per membership and repeat policy require approval.

**Existing frontend impact:** Keep cohort view structure; use confirmed cohort options and add the source-supported School Name field if needed for entry. Current Grade-5 eligibility and extra outcome options require approval; unknown is not No.

**Recommended approach:** Resolve cohort and flag conflicts with the programme owner; retain literal evidence until then. Treat Passed=No as the source flag, not automatically failed/absent/pending. Extra outcomes stay NULL/unpopulated unless newly and explicitly entered under an approved contract.

**Risks and consequences:** Historical cohort charts remain incomplete; stronger boolean constraints may reject legitimate source semantics unless clarified first.

**Must implementation wait?:** YES for historical membership/outcome promotion, cohort labels and consistency constraints. Empty cohort structures/synthetic repeat tests can be drafted after technical approval.


## D09 — Visit authenticity and dates (P1)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Do not treat undated/template-like rows as verified visits; preserve and flag source evidence; future entry contracts should require appropriate visit information.

**Remaining pending decision:** Historical authenticity/dates, officer identity/assignments, precise future required fields/statuses/targets and correction permissions.

**Required evidence / proposed owner group:** MASS programme/visit staff and data owners; authenticated dated evidence and approved new-visit requirements.

**Current implementation gate:** No historical Completed visit promotion or invented dates; general need for appropriate information is not approval of exact future fields/status rules. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Identify which legacy visit rows are real, supply verified dates if recoverable, approve officer/centre identity and assignment history, and confirm targets/status/correction rules.

**Evidence already established:** Phase 2B: all 200 non-example input rows lack date and have template-like remarks; seven explicit examples are excluded; summaries are partly hardcoded.

**Database impact:** Keep legacy candidates staged; centre_visits requires confirmed date and actor/centre. No summary count can manufacture transaction detail or Completed status.

**Existing frontend impact:** New-visit form layout can remain with authenticated scope and actual dates. An existing-visit Edit action is a small additional requirement only if correction through UI is approved; it is not already implemented.

**Recommended approach:** Do not import these rows as completed visits. Enable future explicitly dated entry separately after permissions and workflow approval; owner can classify templates/exclusions with evidence, preserving the original snapshot.

**Risks and consequences:** Past coverage may remain unknown. Incorrectly accepting template-like rows inflates delivery; indiscriminate exclusion can discard real undated history.

**Must implementation wait?:** YES for legacy visit promotion, statuses/targets and business constraints. Future new-entry table shape is separable from recovering past dates, but still needs D11-D13 approval.


## D10 — Sensitive-data purpose and retention (P0)

**Phase 2D approval status:** Pending

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** No final privacy approval. A minimal operational-data proposal may be documented only.

**Remaining pending decision:** Permitted identity/operational/sensitive fields; purpose/legal/privacy basis; retention/deletion; access/disclosure; region/storage; safeguarding.

**Required evidence / proposed owner group:** MASS management/designated privacy or data-controller authority with source owners and technical administrators; approved field-purpose-access-retention decisions.

**Current implementation gate:** No real-data staging/retention/exposure or expanded baseline capture; no retention duration, legal basis or user right may be selected by the agent. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve minimal operational identity fields, who may inspect sensitive baseline sections, purpose/legal basis/consent as applicable, retention/deletion, safeguarding access and hosting/storage requirements. Clarify meal-block and ROI meaning before typed interpretations.

**Evidence already established:** CHILD-01 has family contact, caste/religion, health/disability, finances and safeguarding responses across 55 columns. No source provides a permission or retention policy.

**Database impact:** Defer private_baseline_surveys/answers from the default build. Keep private identity/staging separated with minimal grants, payload minimization and retention design. No assumption of indefinite storage of source copies.

**Existing frontend impact:** Existing basic profile does not need to expose the full questionnaire. Authorized identity projection should return only necessary fields; no sensitive baseline additions to ordinary pages.

**Recommended approach:** Approve minimum necessary identity/operational retention first; defer expanded baseline database capture until separately justified. Keep restricted source handling under an owner-approved temporary retention plan; do not infer shared households or publish survey details.

**Risks and consequences:** Deferral can limit longitudinal baseline analysis; withholding a database feature is not a decision to destroy source records. Retaining everything by default creates privacy/safeguarding risk.

**Must implementation wait?:** YES before real personal data is staged, retained or exposed. Metadata-only/synthetic drafts do not require deciding every survey question, but applying them still requires an approved security/project boundary.


## D11 — Users, capabilities and historical scope (P0)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Use server-controlled scoped permissions and deny unless explicitly authorized; role-selection UI is not authentication; donor/programme labels imply no access rights.

**Remaining pending decision:** Actual role/capability/user mappings, centre/project/shift/history scope, exports/private fields, grant administration and allowed/denied operations.

**Required evidence / proposed owner group:** MASS management/programme/data owners and technical administrators; authorized capability matrix and staff-to-Auth identity confirmation.

**Current implementation gate:** No Auth/RLS modification or real grant provisioning; deny-by-default principle does not approve specific role permissions or permit this task to change policies. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve the actual user/role/capability matrix: centre/project/shift scope, current versus historical access, read/create/correct/export rights, private-baseline rights, grant administration and any donor aggregates. Identify authorized grant owners; do not provide credentials in chat.

**Evidence already established:** Frontend role switch is freely editable and scope uses sample constants. Officer names/project tabs are not identity/grants; actual funder identities/periods are absent.

**Database impact:** Server-owned grants/RLS and actor attribution are mandatory for real records. Staff business assignment does not implicitly grant access; NULL scope must not become global. No self-service privilege escalation.

**Existing frontend impact:** Retain core pages but add approved Auth/session/loading/denial behavior. Role preview remains demo-only; no client-side hidden row/filter is an access boundary.

**Recommended approach:** Deny anonymous and unapproved access by default; implement only explicit owner-approved capabilities and minimal projections. Defer external donor access. Test direct APIs/exports/storage and both allowed/denied paths; role labels alone do not authorize policies.

**Risks and consequences:** Overly broad grants leak data; overly narrow grants can block staff work. Historical access decisions need an explicit policy rather than inference from present assignment.

**Must implementation wait?:** YES for real RLS allowed paths, production credentials/session integration and user grants. Deny-by-default designs and synthetic denial scaffolding can be prepared without inventing roles.


## D12 — Initial scope and unsupported extensions (P1)

**Phase 2D approval status:** Pending

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** No final rollout approval. Retain six-foundation and gated core/history/security scopes as design candidates; verify names/purposes/dependencies before proposing implementation.

**Remaining pending decision:** Which first scope is approved; exact schema/constraints; 35-relation candidate backlog, optional extensions and sensitive-baseline deferral; authorized coding/test actions.

**Required evidence / proposed owner group:** MASS product/programme management and technical administrators; explicit first-scope selection and implementation authorization.

**Current implementation gate:** Neither six nor 35 nor the full 43 relations are approved to create; no SQL/table/test-resource work is authorized now. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve the 35-relation staged core/history/security backlog, including future-only contracts needed by current core forms; defer six guidance/funding relations and two expanded-baseline relations by default. Choose otherwise explicitly if all current modules must become live at once.

**Evidence already established:** Frontend has sessions/events, follow-ups, group comments and extra outcomes not supplied in source. Guidance is optional later-module preview; donor scope/funding history is not verified.

**Database impact:** Essential-to-core-form tables may be required without source-backed historical rows. Optional relations are not permission to seed mock data. A narrower first pilot can use profile/attendance/learning modules while other gates remain open.

**Existing frontend impact:** No current functionality changes now. A future mixed rollout must not quietly mix demo and real metrics. Any module availability messaging or separate historical display needs approval; preserving the present prototype does not require enabling every live backend module immediately.

**Recommended approach:** Build a small foundation first, then gated core modules. Retain the current prototype unchanged during development; validate new integration with synthetic Preview data in a later approved phase. Defer guidance/external donor live access unless explicitly selected.

**Risks and consequences:** Full live parity takes longer if all modules are required initially. Silent feature removal or silent synthetic/real blending is unacceptable; make rollout scope explicit.

**Must implementation wait?:** YES for any extension/real-module activation and initial release scope. This review does not authorize code, SQL or deployment work.


## D13 — Edits, audit, concurrency and destructive utilities (P0)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Use transactions where appropriate, prevent unintended duplicate writes, use revision-aware edits, preserve attributable history, append follow-ups and isolate demo reset from production data.

**Remaining pending decision:** Exact workflows/atomicity, conflict handling, correction permissions/reasons/approvals, audit payload/actor/retention and deletion/offline behavior.

**Required evidence / proposed owner group:** MASS operational/data owners with management and technical/security administrators; approved edit and audit contract.

**Current implementation gate:** No mutation API, audit trigger, corrective workflow, production reset or permissions implementation; final technical details still require review. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Approve record-version conflict behavior, correction reasons/approval windows, bulk atomicity, follow-up history, audit actor/payload/retention, deletion and offline expectations. Approve isolating demo reset from all real records.

**Evidence already established:** Prototype overwrites local objects/notes and whole localStorage; browser-generated IDs and free role switching are not concurrency/audit. Source data supplies no reliable edit-history policy.

**Database impact:** Server-owned row versions, transactional validation and append-only audit are needed. Same-snapshot import retry must not overwrite a later user correction. Clearing a mark must be distinguishable from deleting identity/history.

**Existing frontend impact:** Keep existing forms/buttons where safe, but require save/error/conflict handling. Present latest follow-up via existing view while appending history. Never execute real-data reset or store the whole personal dataset as authoritative localStorage.

**Recommended approach:** Use explicit transactions and optimistic version checks; reject stale writes with actionable recovery. Append follow-up episodes, audit scoped changes with minimized sensitive payloads, and keep demo reset only in isolated synthetic mode. No offline write-sync promise until designed.

**Risks and consequences:** Audit itself can duplicate sensitive data; retention/access must be controlled. Conflicts require user handling rather than silent success. Bulk failures need clear atomic outcome.

**Must implementation wait?:** YES for real mutation APIs, audit enforcement/payloads, concurrency and any deletion/reset semantics. Metadata schemas/synthetic conflict tests can be drafted after technical approval.


## D14 — Project, migrations and test boundary (P0)

**Phase 2D approval status:** Pending

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** No final environment approval. Identify an accessible intended existing project and prepare read-only checks only; no resource creation/modification/deletion.

**Remaining pending decision:** Project identity/region/version, production versus test boundaries, synthetic target, migration/RLS testing, least privilege, backups and rollback.

**Required evidence / proposed owner group:** Technical administrators authorized by MASS; non-secret project reference/dashboard URL and authorized read-only metadata plus documented test/recovery boundary.

**Current implementation gate:** No Supabase access/configuration change, SQL execution, migration or resource/test-project creation; intended project remains unverified here. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Identify the existing Supabase project/environment and approve region/schema/private storage, least-privilege access, canonical required fields, backup/recovery, isolated synthetic test target and migration/RLS deployment process.

**Evidence already established:** Phase 2B did not inspect an accessible Supabase project; all 114 workbook validations allow blank cells, which does not establish production requiredness.

**Database impact:** No production DDL until platform/security verification. Check PostgreSQL/Supabase versions, private schema exposure, view/RLS behavior and unique-NULL capabilities before final SQL.

**Existing frontend impact:** Browser config delivery and Auth/API adapter must be explicitly designed for static JS. Privileged credentials never enter frontend/Git/source ZIP; no deployment target is assumed safe by name.

**Recommended approach:** Approve a verified nonproduction/local test boundary first; use ordered reviewed migrations and synthetic fixtures. Validate fresh install and upgrade paths, deny defaults, supported constraints, recovery and source reconciliation before production use.

**Risks and consequences:** Testing against the wrong linked project can affect production; secrets/project targeting and CLI commands need explicit verification. Missing backups/recovery is a release blocker.

**Must implementation wait?:** YES before any database/test-resource creation or applying migrations. All such work is outside this design-review authorization.


## D15 — Guidelines and source snapshot authority (P2)

**Phase 2D approval status:** Conditional

**Approval/reference date:** 26 October 2026

**Approved technical principle / instruction:** Record completeness, exclusions and unresolved issues transparently; never claim coverage of missing metadata/guidelines; keep documentation consistent with verified facts.

**Remaining pending decision:** Original source/export authority/versions/IDs and any missing coverage; guidelines PDF and process conformance; snapshot acceptance for later import.

**Required evidence / proposed owner group:** Source data owners and MASS project management; guidelines and metadata where available, explicit snapshot/exclusion acceptance.

**Current implementation gate:** Documentation can record limits now; no unsupported completeness/conformance/import-authority claim or implied acceptance of unknown metadata. Global D10/D12/D14 prerequisites still apply.

The following is the preserved Phase 2C analysis; its recommendation is not automatically approved in full.

**Exact decision required:** Provide the missing guidelines and original source/export metadata if available; approve the six hashed XLSX copies and defined exclusions as the discovery/import snapshot scope. State any missing history/files.

**Evidence already established:** All six copies/53 tabs were audited in Phase 2B; original Drive IDs/version history and Pre-KC-2 guidelines remain unavailable. Shared Project Tasklist is excluded.

**Database impact:** Keep original IDs/version fields nullable when unknown; use exact snapshot hashes/locators without pretending they identify original Google versions. Process requirements may revise validation/gates.

**Existing frontend impact:** No necessary layout change; source completeness/coverage claims must reflect approved snapshot scope rather than inferred full historical coverage.

**Recommended approach:** Accept hashes as working-copy evidence, not as proof of original Drive lineage. Review guidelines when supplied. Do not restart the audit absent changed sources; inspect only new/different evidence and preserve prior findings.

**Risks and consequences:** Guidelines or additional history may require design changes; falsely claiming completeness can hide missing records. Original IDs may remain unavailable legitimately.

**Must implementation wait?:** YES for source-authority/completeness and process-conformance claims or real import from these copies. Missing metadata does not block drafting empty foundation shapes after separate approval.

## Approval recording

For each decision, record disposition (approved/rejected/revise), approver and authority, date, exact selected values, affected source scope, conditions and evidence. Do not turn the word Approved into a blanket acceptance of identities/years/status semantics that have not been supplied. Preserve D01-D15 IDs when revising the design; Phase 2A/2B documents remain unchanged historical baselines.
