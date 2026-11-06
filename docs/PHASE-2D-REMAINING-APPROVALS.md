# Phase 2D — remaining approval questions

Reference date: 26 October 2026. The approved preservation/security principles are recorded in PHASE-2D-CONDITIONAL-APPROVALS.md. The questions below remain unanswered; do not infer answers from filenames, a role selector, prior recommendations or conditional approval.

Owner groups are suggestions for who should decide; no named individual is assigned and no actual permission is granted. Use protected channels for real matching evidence. Do not paste private records, contacts or credentials into this checklist.

## Identity and student matching (D01)

- [ ] **Question:** Who is authorized to confirm that two source records belong to the same child, and what evidence must they use?

  **Proposed decision group:** MASS identity/data owners with programme staff; management confirms the authority.

- [ ] **Question:** Who issues any external student ID, within what scope is it unique, and how should an internal record reference be labelled when that ID is missing?

  **Proposed decision group:** MASS data owners and technical administrators.

- [ ] **Question:** How should a match be accepted, rejected, reversed or left uncertain while keeping reviewer/evidence history?

  **Proposed decision group:** Authorized data owners with technical administrators; no actual matches are approved here.


## Historical centre/class/shift assignments (D02,D04,D15)

- [ ] **Question:** When centre tabs, the master and the hidden helper disagree, which source is authoritative for each period? Which centre-name spellings refer to the same confirmed centre rather than a residence?

  **Proposed decision group:** MASS programme staff and source data owners.

- [ ] **Question:** Can a child legitimately attend multiple shifts or centres, and what evidence establishes transfer, enrolment, class-change and exit dates?

  **Proposed decision group:** MASS programme staff and data owners.

- [ ] **Question:** How should the extra/repeated attendance day headers, undated helper and calculated day cells be resolved? Which source corrections may be accepted, by whom?

  **Proposed decision group:** Source data owners with programme review.

- [ ] **Question:** Are the six hashed working copies the accepted source scope; what history/metadata is missing, and can the guidelines be provided?

  **Proposed decision group:** Source data owners and project management. Transparency is approved; source authority/completeness is not inferred.


## Attendance statuses and calculations (D03,D04,D13)

- [ ] **Question:** What does each literal code, including P, A, WO, MM, L and any additional observed value, actually mean? Is it a child mark or calendar status?

  **Proposed decision group:** MASS attendance/programme staff and source data owners.

- [ ] **Question:** Which days, statuses, holidays, non-scheduled days and missing entries enter each numerator and denominator? What are the actual dropout and engagement rules?

  **Proposed decision group:** MASS programme staff and data owners.

- [ ] **Question:** Which calendar is authoritative, what date/time-zone/as-of rules apply, and who may correct individual or bulk entries?

  **Proposed decision group:** MASS programme staff and management set policy; technical administrators implement only approved rules.


## Academic years and quarters (D05,D15)

- [ ] **Question:** What proves the academic year for each missing source row/block, and what must remain unknown?

  **Proposed decision group:** MASS assessment staff and source data owners.

- [ ] **Question:** What are the actual quarters and boundaries, and is any Q-to-F alias genuinely equivalent?

  **Proposed decision group:** MASS assessment/programme staff.

- [ ] **Question:** How should ambiguous/two-digit or inconsistent assessment dates be interpreted, and who may approve that interpretation?

  **Proposed decision group:** Source data owners with assessment staff. No neighbour-fill or century assumption is approved.


## Assessment scales and attempts (D06)

- [ ] **Question:** What is the true maximum and permitted precision for each paper/type/shift/period, given 25 versus 100 metadata?

  **Proposed decision group:** MASS assessment staff with authoritative paper/source documentation.

- [ ] **Question:** Are multiple attempts allowed, how are they identified, and how should repeated/missing/absent results be distinguished?

  **Proposed decision group:** MASS assessment staff and data owners.

- [ ] **Question:** Which groups may be compared or banded, and what reporting/round rules apply?

  **Proposed decision group:** MASS assessment/programme owners. Score preservation is approved; bands/rescaling are not.


## Activities, training and visits (D07,D08,D09,D12)

- [ ] **Question:** What do Activity 1-4 slots mean, is there evidence linking any to a real event/date/category, and how should monthly history be displayed separately?

  **Proposed decision group:** MASS activity/programme staff and source data owners; product management approves display requirements.

- [ ] **Question:** What defines each Morarji cohort and source Date/Attended indicator, how should conflicting outcomes be resolved, and are any extra training/award fields truly required?

  **Proposed decision group:** MASS Morarji/programme staff and data owners. School names remain observations; no awards/day totals are inferred.

- [ ] **Question:** Which undated/template-like visit rows are authentic, can actual dates/officers be verified, and what information/status/targets must new visits require?

  **Proposed decision group:** MASS visit/programme staff and data owners.

- [ ] **Question:** Which source-absent future-entry contracts are included initially: explicit sessions/events, follow-ups, batch comments or extended outcomes?

  **Proposed decision group:** MASS product/programme management with technical administrators; none is approved by scope inference.


## Sensitive information and retention (D10,D13)

- [ ] **Question:** What is the minimum child identity/operational information needed for the selected workflow, and why is each field necessary?

  **Proposed decision group:** MASS management/designated privacy or data-controller authority with programme/data owners.

- [ ] **Question:** Is there a justified purpose for DOB, guardian/contact, health/disability, caste/religion, financial or safeguarding fields; who may read them?

  **Proposed decision group:** The responsible MASS privacy/data-controller authority and management; no individual appointment is assumed.

- [ ] **Question:** What authorized purpose/legal/privacy basis, retention/deletion plan, region/storage protection and safeguarding process apply to records, source snapshots, matching evidence, exceptions and audit details?

  **Proposed decision group:** MASS management/privacy authority and technical administrators. No duration or legal basis is selected here.


## Authentication, roles and permissions (D11,D13)

- [ ] **Question:** Who are the actual users and which approved capabilities allow read, create, correct, approve or export for each centre/project/shift and historical period?

  **Proposed decision group:** MASS management/programme/data owners define rights; technical administrators verify the account/scope mapping.

- [ ] **Question:** Who may grant/revoke access, inspect sensitive source/matching/audit records, and approve corrections? Is donor access needed at all?

  **Proposed decision group:** MASS management/data owners with technical security administrators. Labels do not confer rights.

- [ ] **Question:** What correction/conflict/approval windows, bulk atomicity, follow-up history and audit payload rules should staff experience?

  **Proposed decision group:** MASS operational/data owners with technical administrators. Transaction/revision principles do not resolve exact workflows.


## Initial database scope (D12,D13,D15)

- [ ] **Question:** Are the exact six foundation candidates in PHASE-2D-IMPLEMENTATION-READINESS.md the approved first SQL-drafting scope, or should it be smaller?

  **Proposed decision group:** MASS project/product management and technical administrators.

- [ ] **Question:** Which core workflow follows first, and which of the proposed 35/43 relations and optional live modules are actually selected?

  **Proposed decision group:** MASS programme/product management. The existing backlog remains a design candidate, not approved DDL scope.

- [ ] **Question:** What concrete audit/retry/current-resolution constraints and synthetic-only tests are included in the next task?

  **Proposed decision group:** Technical administrators with data/security owners; scope and execution require separate authorization.


## Supabase project and deployment safety (D14)

- [ ] **Question:** Which existing Supabase project reference/dashboard URL is intended for MASS, what is its region, and which environment is production?

  **Proposed decision group:** Authorized technical administrators; provide non-secret identity/metadata, not credentials in chat.

- [ ] **Question:** Which separate local/nonproduction target is approved for synthetic-only tests, and how will accidental production access be prevented?

  **Proposed decision group:** Technical administrators authorized by MASS management.

- [ ] **Question:** What migration review, RLS/storage tests, backup/recovery and rollback procedures are verified on the actual platform/version?

  **Proposed decision group:** Technical administrators and the responsible security/data owners.

- [ ] **Question:** How can a documentation PR be published without any Vercel deployment under this task?

  **Proposed decision group:** Technical administrators must verify existing deployment-free publication behavior. Do not pause/disconnect or change deployment settings as a workaround.

## What an approval response should contain

Reference the D-ID, exact selected rule/value/scope, authorized owner/approver, reference date, evidence location and any unresolved exceptions. An interim decision to preserve/quarantine is valid and does not fill missing years, dates, IDs or permissions. Do not put confidential evidence in the Git documentation itself.

D10 privacy, D12 first scope and D14 target remain the primary implementation prerequisites. Actual D11 allowed-role mappings and D13 operating/audit contracts also need approval. Existing conditional principles do not waive these gates. This checklist is not authorization to begin SQL, create test resources or deploy a PR.
