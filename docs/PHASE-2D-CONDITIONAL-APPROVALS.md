# Phase 2D — conditional technical approvals

Approval/reference date: **26 October 2026**, from the user's Phase 2D instruction. This is a dated record of the user's disposition, not a new source audit or a claim that implementation occurred. For Pending entries, this date records the instruction/reference, not an approval grant.

Eight decisions are Conditional, four Partial and three Pending. **None is Fully Approved.** Approved technical handling principles do not resolve business values, real person matches, privacy, user rights, rollout scope or target environment. This task remains documentation/planning only: no SQL, resource, real-data, Auth/RLS, frontend or deployment action is authorized.

## Status meanings

- **Conditional:** the stated technical principles are accepted subject to outstanding evidence/authority/workflow and global implementation prerequisites.
- **Partial:** specified preservation/unknown-handling is accepted, while the domain interpretation, values or calculations remain unresolved.
- **Pending:** no final approval of the stated domain/scope/environment; proposals remain proposals.

The original Phase 2C evidence and recommendations are preserved. Existing Phase 2C approval files receive dated overlays; Phase 2A/2B records and other Phase 2C findings are not rewritten. Where earlier files say all decisions were Pending, that describes the earlier review; this dated register governs current approval status only, not changed source facts.

## Current summary

| Decision | Topic | Status | Reference date |
| --- | --- | --- | --- |
| D01 | Student identity | Conditional | 26 October 2026 |
| D02 | Historical assignments and source precedence | Conditional | 26 October 2026 |
| D03 | Attendance statuses and metrics | Partial | 26 October 2026 |
| D04 | Calendar and malformed day cells | Conditional | 26 October 2026 |
| D05 | Academic years, quarters and dates | Partial | 26 October 2026 |
| D06 | Assessment scales and result grain | Partial | 26 October 2026 |
| D07 | Monthly activity versus events | Conditional | 26 October 2026 |
| D08 | Morarji cohorts and outcome semantics | Partial | 26 October 2026 |
| D09 | Visit authenticity and dates | Conditional | 26 October 2026 |
| D10 | Sensitive-data purpose and retention | Pending | 26 October 2026 |
| D11 | Users, capabilities and historical scope | Conditional | 26 October 2026 |
| D12 | Initial scope and unsupported extensions | Pending | 26 October 2026 |
| D13 | Edits, audit, concurrency and destructive utilities | Conditional | 26 October 2026 |
| D14 | Project, migrations and test boundary | Pending | 26 October 2026 |
| D15 | Guidelines and source snapshot authority | Conditional | 26 October 2026 |

## Decision-by-decision approval record

Required owner groups below are proposed decision responsibilities, not appointments or evidence that any individual has authority. Real matching evidence, people, contacts and credentials must stay out of this public-safe document.

### D01 — Student identity

**Original Phase 2C recommendation:** Approve human-adjudicated, evidence-backed resolution with no name-only matching; create technical UUIDs only for confirmed people; leave absent external IDs NULL. Until issuer scope is approved, keep external source identifiers in provenance and do not enforce a guessed global external-ID unique rule.

**Approved technical principle / instruction:** Use internal UUIDs only for verified child identities; never manufacture external identifiers or merge by names alone; uncertain cross-source matches stay unresolved until authorized review.

**Remaining pending business or security decision:** Identity-matching authority, evidence standards, external-ID issuer/scope/display, actual matches and the accepted-current revision contract.

**Required evidence or decision owner:** MASS designated identity/data owners; documented matching authority and protected corroborating evidence. No individual is assigned here.

**Implementation gate:** No person matching, UUID allocation for uncertain people, canonical FK promotion or external-ID constraints until authority/evidence/scope are resolved.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026


### D02 — Historical assignments and source precedence

**Original Phase 2C recommendation:** Treat dated centre-tab cells as candidates and master/helper as reconciliation evidence until source owner confirms precedence. Keep unresolved placements as observations; never default start to grid start or assign an exit date from Remove. Propose half-open dated intervals for approved future episodes.

**Approved technical principle / instruction:** Preserve original centre/class/shift observations and historical assignments; do not overwrite past assignments with current values; never invent enrolment, transfer or exit dates.

**Remaining pending business or security decision:** Source precedence, centre aliases/residence distinctions, verified effective dates, multiple-shift/centre and overlap handling.

**Required evidence or decision owner:** MASS programme staff and source data owners; approved precedence/alias map and evidenced dated placement decisions.

**Implementation gate:** No guessed intervals, source-precedence merges or final overlap/attendance-grain constraints; unknown history remains observations.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026


### D03 — Attendance statuses and metrics

**Original Phase 2C recommendation:** Preserve literals and withhold unsupported derived metrics until the mapping/calendar is approved. Do not map WO/MM/L to H or A by convenience. Do not use the baseline survey Dropout? response as derived CAC/school dropout without definition. Version approved calculations separately from raw facts.

**Approved technical principle / instruction:** Preserve original attendance codes without reinterpretation; do not calculate final metrics from unconfirmed statuses.

**Remaining pending business or security decision:** Meanings of P, A, WO, MM, L and other observed codes; holidays/non-scheduled days; denominator/exclusions/aggregation; calendar and correction rules; dropout/engagement semantics.

**Required evidence or decision owner:** MASS attendance/programme staff and data owners; literal code glossary, calendar evidence and signed-off calculation/correction rules.

**Implementation gate:** No final attendance metric, code conversion, held-session inference or live entry/denominator policy until confirmed; even P/A semantics remain pending under this approval.

**Approval status:** Partial

**Approval/reference date:** 26 October 2026


### D04 — Calendar and malformed day cells

**Original Phase 2C recommendation:** Keep original cells immutable and segregate date/header anomalies. Accept only individually resolved distinct dates; do not drop extra dates merely to match a filename or date helper marks by copying another tab calendar.

**Approved technical principle / instruction:** Preserve raw source information, quarantine unresolved date/header/formula anomalies, maintain transparent correction/exception records and never modify original workbooks.

**Remaining pending business or security decision:** Actual anomaly resolutions, accepted header/date precedence, evidence of corrected values and authority to accept/reject affected source occurrences.

**Required evidence or decision owner:** Source data owners with programme review; cell/header-specific adjudication and immutable source references.

**Implementation gate:** Quarantine/documentation handling is approved; do not correct/promote disputed values or treat a quarantine policy as permission to load raw data.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026


### D05 — Academic years, quarters and dates

**Original Phase 2C recommendation:** No blanket forward fill or automatic 20xx century inference. Accept a block-level year rule only with owner approval and provenance to the contextual source cells. Prefer actual Q labels until an F alias is confirmed; retain NULL boundaries if not known.

**Approved technical principle / instruction:** Preserve actual source academic-year/quarter information; keep missing values explicitly unknown; never infer year from a neighbouring row without an approved rule.

**Remaining pending business or security decision:** Academic-year mapping, quarter definitions/bounds, any Q-to-F equivalence, locale/century and missing/inconsistent date treatment.

**Required evidence or decision owner:** MASS assessment/programme staff and source owners; approved period calendar and row/block/date interpretation evidence.

**Implementation gate:** No year forward fill, Q-to-F alias, century/date coercion or canonical period-dependent result promotion until approved.

**Approval status:** Partial

**Approval/reference date:** 26 October 2026


### D06 — Assessment scales and result grain

**Original Phase 2C recommendation:** Preserve scores exactly; neither rescale to 100 nor silently redefine maximum as 25. Leave definitions pending until owner confirms. Keep missing distinct from zero and Absent. Quarantine duplicate/attempt ambiguity rather than create a fake attempt number.

**Approved technical principle / instruction:** Preserve original numeric scores; do not rescale them or invent performance bands.

**Remaining pending business or security decision:** Maximum by paper/type/shift, precision, attempts, assessment statuses, accepted dates and reporting/comparison rules.

**Required evidence or decision owner:** MASS assessment staff and data owners; paper/scale documentation, repeated-result interpretation and reporting rules.

**Implementation gate:** No scale changes, inferred maximum, attempt defaults, status/NULL conversions, bands or comparisons until resolved.

**Approval status:** Partial

**Approval/reference date:** 26 October 2026


### D07 — Monthly activity versus events

**Original Phase 2C recommendation:** Preserve month/slot and unknown values exactly; no fabricated dates/categories or bulk blank->No conversion. Approve future explicit event entry independently; require an approved minimal monthly-history display if integrating these historical sources.

**Approved technical principle / instruction:** Keep historical monthly activity responses separate from future dated events; infer neither dates nor categories from generic monthly Yes/No slots.

**Remaining pending business or security decision:** Slot interpretation/event mapping, any bridge to real events, historical display and approved future-event/data-entry contract.

**Required evidence or decision owner:** MASS activity/programme staff and source owners; slot/event evidence and product owner approval of separate historical display.

**Implementation gate:** No event synthesis, category/engagement attribution or blended historical/event aggregates; separation principle does not approve tables or module rollout.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026


### D08 — Morarji cohorts and outcome semantics

**Original Phase 2C recommendation:** Resolve cohort and flag conflicts with the programme owner; retain literal evidence until then. Treat Passed=No as the source flag, not automatically failed/absent/pending. Extra outcomes stay NULL/unpopulated unless newly and explicitly entered under an approved contract.

**Approved technical principle / instruction:** Preserve source-backed indicators and school names as observations; do not populate unsupported award or training fields. The observed columns are Applied, Attended, Passed and School Name; the file title does not prove training-day totals.

**Remaining pending business or security decision:** Cohort definitions/periods, source Date/Attended meaning, outcome interpretation/conflicts, reporting classifications and optional extra fields.

**Required evidence or decision owner:** MASS Morarji/programme staff and source data owners; confirmed cohorts, field meanings and contradiction review.

**Implementation gate:** No guessed cohort or conversion to training-day/exam/award classifications; unsupported counts/selection/admission/scholarship stay unpopulated.

**Approval status:** Partial

**Approval/reference date:** 26 October 2026


### D09 — Visit authenticity and dates

**Original Phase 2C recommendation:** Do not import these rows as completed visits. Enable future explicitly dated entry separately after permissions and workflow approval; owner can classify templates/exclusions with evidence, preserving the original snapshot.

**Approved technical principle / instruction:** Do not treat undated/template-like rows as verified visits; preserve and flag source evidence; future entry contracts should require appropriate visit information.

**Remaining pending business or security decision:** Historical authenticity/dates, officer identity/assignments, precise future required fields/statuses/targets and correction permissions.

**Required evidence or decision owner:** MASS programme/visit staff and data owners; authenticated dated evidence and approved new-visit requirements.

**Implementation gate:** No historical Completed visit promotion or invented dates; general need for appropriate information is not approval of exact future fields/status rules.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026


### D10 — Sensitive-data purpose and retention

**Original Phase 2C recommendation:** Approve minimum necessary identity/operational retention first; defer expanded baseline database capture until separately justified. Keep restricted source handling under an owner-approved temporary retention plan; do not infer shared households or publish survey details.

**Approved technical principle / instruction:** No final privacy approval. A minimal operational-data proposal may be documented only.

**Remaining pending business or security decision:** Permitted identity/operational/sensitive fields; purpose/legal/privacy basis; retention/deletion; access/disclosure; region/storage; safeguarding.

**Required evidence or decision owner:** MASS management/designated privacy or data-controller authority with source owners and technical administrators; approved field-purpose-access-retention decisions.

**Implementation gate:** No real-data staging/retention/exposure or expanded baseline capture; no retention duration, legal basis or user right may be selected by the agent.

**Approval status:** Pending

**Approval/reference date:** 26 October 2026


### D11 — Users, capabilities and historical scope

**Original Phase 2C recommendation:** Deny anonymous and unapproved access by default; implement only explicit owner-approved capabilities and minimal projections. Defer external donor access. Test direct APIs/exports/storage and both allowed/denied paths; role labels alone do not authorize policies.

**Approved technical principle / instruction:** Use server-controlled scoped permissions and deny unless explicitly authorized; role-selection UI is not authentication; donor/programme labels imply no access rights.

**Remaining pending business or security decision:** Actual role/capability/user mappings, centre/project/shift/history scope, exports/private fields, grant administration and allowed/denied operations.

**Required evidence or decision owner:** MASS management/programme/data owners and technical administrators; authorized capability matrix and staff-to-Auth identity confirmation.

**Implementation gate:** No Auth/RLS modification or real grant provisioning; deny-by-default principle does not approve specific role permissions or permit this task to change policies.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026


### D12 — Initial scope and unsupported extensions

**Original Phase 2C recommendation:** Build a small foundation first, then gated core modules. Retain the current prototype unchanged during development; validate new integration with synthetic Preview data in a later approved phase. Defer guidance/external donor live access unless explicitly selected.

**Approved technical principle / instruction:** No final rollout approval. Retain six-foundation and gated core/history/security scopes as design candidates; verify names/purposes/dependencies before proposing implementation.

**Remaining pending business or security decision:** Which first scope is approved; exact schema/constraints; 35-relation candidate backlog, optional extensions and sensitive-baseline deferral; authorized coding/test actions.

**Required evidence or decision owner:** MASS product/programme management and technical administrators; explicit first-scope selection and implementation authorization.

**Implementation gate:** Neither six nor 35 nor the full 43 relations are approved to create; no SQL/table/test-resource work is authorized now.

**Approval status:** Pending

**Approval/reference date:** 26 October 2026


### D13 — Edits, audit, concurrency and destructive utilities

**Original Phase 2C recommendation:** Use explicit transactions and optimistic version checks; reject stale writes with actionable recovery. Append follow-up episodes, audit scoped changes with minimized sensitive payloads, and keep demo reset only in isolated synthetic mode. No offline write-sync promise until designed.

**Approved technical principle / instruction:** Use transactions where appropriate, prevent unintended duplicate writes, use revision-aware edits, preserve attributable history, append follow-ups and isolate demo reset from production data.

**Remaining pending business or security decision:** Exact workflows/atomicity, conflict handling, correction permissions/reasons/approvals, audit payload/actor/retention and deletion/offline behavior.

**Required evidence or decision owner:** MASS operational/data owners with management and technical/security administrators; approved edit and audit contract.

**Implementation gate:** No mutation API, audit trigger, corrective workflow, production reset or permissions implementation; final technical details still require review.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026


### D14 — Project, migrations and test boundary

**Original Phase 2C recommendation:** Approve a verified nonproduction/local test boundary first; use ordered reviewed migrations and synthetic fixtures. Validate fresh install and upgrade paths, deny defaults, supported constraints, recovery and source reconciliation before production use.

**Approved technical principle / instruction:** No final environment approval. Identify an accessible intended existing project and prepare read-only checks only; no resource creation/modification/deletion.

**Remaining pending business or security decision:** Project identity/region/version, production versus test boundaries, synthetic target, migration/RLS testing, least privilege, backups and rollback.

**Required evidence or decision owner:** Technical administrators authorized by MASS; non-secret project reference/dashboard URL and authorized read-only metadata plus documented test/recovery boundary.

**Implementation gate:** No Supabase access/configuration change, SQL execution, migration or resource/test-project creation; intended project remains unverified here.

**Approval status:** Pending

**Approval/reference date:** 26 October 2026


### D15 — Guidelines and source snapshot authority

**Original Phase 2C recommendation:** Accept hashes as working-copy evidence, not as proof of original Drive lineage. Review guidelines when supplied. Do not restart the audit absent changed sources; inspect only new/different evidence and preserve prior findings.

**Approved technical principle / instruction:** Record completeness, exclusions and unresolved issues transparently; never claim coverage of missing metadata/guidelines; keep documentation consistent with verified facts.

**Remaining pending business or security decision:** Original source/export authority/versions/IDs and any missing coverage; guidelines PDF and process conformance; snapshot acceptance for later import.

**Required evidence or decision owner:** Source data owners and MASS project management; guidelines and metadata where available, explicit snapshot/exclusion acceptance.

**Implementation gate:** Documentation can record limits now; no unsupported completeness/conformance/import-authority claim or implied acceptance of unknown metadata.

**Approval status:** Conditional

**Approval/reference date:** 26 October 2026

## Common gate and approval boundaries

D10 privacy, D12 first-scope selection and D14 target/test safety remain Pending. D11's exact grants and D13's operational/audit details also remain unresolved. No approval here authorizes resolving private matches, creating surrogate IDs for uncertain people, transforming source values, applying database constraints or granting staff access.

Principle approval can be applied to documentation now; it is not permission to create the proposed six foundation tables, the 35-relation candidate backlog, or all 43 relations. Missing business values stay explicitly unknown. Do not treat stored source snapshots or this approval record as proof of a historical transaction or user permission.

The phrase source-backed training indicators in D08 is recorded conservatively: preserve the actual available flags/school observation; it does not establish a training-day count or resolve whether Attended is a training/exam concept. Original field evidence remains authoritative, and interpretation remains pending.
