# Proposed database data dictionary — review draft, not SQL

Status: source-informed design for review; not approved for implementation. All table/field names, UUID choices, nullability, keys, indexes and access boundaries below are proposals. Source observations are cited independently. No SQL or Supabase resource has been created.

## Phase 2E revision — 27 October 2026

Current confirmed business scope and unresolved gates: [PHASE-2E-RULE-RECONCILIATION.md](PHASE-2E-RULE-RECONCILIATION.md). Earlier dictionary version is preserved in Git at `9a2190c8a1c6a020a5024e94ff6b7445a212382e`. Only confirmed-rule-driven changes are made below; no new tables or SQL. Foundation fields remain proposals. Mumbai/project reference is user-identified, not independently verified platform or privacy approval.

## Design contract

- Use internal UUID primary keys only for confirmed entities. A UUID is a database surrogate, not an invented source student ID. Keep missing external identifiers NULL, and never seed frontend CAC IDs or use name/DOB/phone as an automatic identity key.
- Every relation below has `id uuid PRIMARY KEY`. Mutable relations additionally have `created_at timestamptz NOT NULL`, `created_by uuid NULL REFERENCES auth.users(id)`, `updated_at timestamptz NOT NULL`, `updated_by uuid NULL REFERENCES auth.users(id)`, and `row_version bigint NOT NULL`. These are system transaction metadata, never fabricated source authors or event dates. Use server-managed optimistic revisions, not client timestamps as concurrency guarantees.
- Source-backed records additionally carry `origin_row_id uuid NULL REFERENCES source_rows(id)` and `origin_cells jsonb NULL` containing column/range locators only, plus `origin_fact_key text NULL` for a stable extracted field/section identity within a source row. Imported records require non-null origin; new operational records use an actual creator/audit event. One wide source row can produce many dated facts, each with distinct source-cell locators. Require a per-table uniqueness/idempotency guard on origin_row_id + origin_fact_key for imported observations after the extraction grain is approved. Additional source duplicates remain in source_rows with reviewed canonical-source links; identity_resolutions preserve corroborating person evidence. No polymorphic provenance link is claimed to be a real FK.
- Frozen source metadata/rows, approved definitions and audit events are immutable/append-only under their reviewed service interface. Later import batches can reference the same frozen source_rows; the first extraction batch is not rewritten. Tables that reference source_rows are promoted only after staging exists, avoiding bootstrapping issues in a future migration order.
- `?` in the source design metadata becomes Nullable=yes below. Null never means false, absent, zero, no scholarship or not contacted. Business dates use date; system timestamps use timestamptz in UTC. Dated assignments use proposed half-open intervals [start,end). Academic year is confirmed April 1–March 31 with four quarters; historical row-year attribution and cohort boundaries remain unresolved.
- Raw observations stay distinct from accepted canonical facts. Unverifiable records must not be imported into final operational tables; preserve restricted exceptions and aggregate reconciliation under an approved privacy boundary. Incomplete source dates/years/identities can be retained in protected staging/observations without being fabricated to satisfy canonical constraints.
- Reference values require explicit review except the Phase 2E confirmed rules and existing controlled registration options. Source Morning/Evening, Q1-Q4 and Yes/No are evidence; other frontend statuses/catalogues remain proposals. Leadership is read-only; teacher/officer writes require verified assigned scope. Do not equate source sex labels with gender identity or Q1 with F1 without approval.
- Normalized operational identities, enrolments, assessments, monthly responses, events and programme memberships prevent year/round/assignment overwrites. Private baseline answers are an intentional immutable questionnaire archive: source-column/version keys preserve ambiguous repeated labels. Do not use generic answer JSON/EAV as the operational student/attendance/assessment model. Sensitive baseline retention requires purpose/retention approval.
- General audit target locators are intentionally not polymorphic business FKs; they retain history. All modeled business FKs below are explicit. Audit payload minimization and non-client access are mandatory design requirements pending security review.
- Foreign-key indexes are not created automatically by PostgreSQL; add only reviewed FK/scope/time indexes and verify plans with synthetic data. Do not turn every field into an index. No indexes are created now.

## Scope and justification

The dictionary includes source-backed relations, migration/security infrastructure, and clearly marked frontend-only/future extensions. This is not a requirement to implement every proposed extension in the first release. In particular guidance/funding, new follow-ups, explicit events/sessions, and unsupported Morarji outcome fields require approval; they are not historical source facts. No data is invented to populate them.

## Relations

### 1. `projects` — Reference

Evidence/justification: ATT workbook/project context; VISIT/MOR/ACT/ASM project-labelled tabs. These labels are not verified donor or funding contracts.

Grain: One confirmed programme project.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `label` | `text` | no | Owner-approved project label; preserve source aliases in provenance |
| `code` | `text` | yes | Existing approved external project code only; never synthesized as source identity |

Keys/constraints: PK id; label/code normalization and uniqueness require owner review; no automatic project-name typo merge.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 2. `centres` — Reference

Evidence/justification: ATT centre tabs and Village Name context; VISIT Center Name and dropdowns; ASM Village Name.

Grain: One confirmed centre.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `name` | `text` | no | Approved programme centre name, not a person residence inferred automatically |
| `external_code` | `text` | yes | Verified existing centre identifier if provided |

Keys/constraints: PK id; names alone are not globally unique identity; centre aliases require review.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 3. `centre_aliases` — Reference

Evidence/justification: Spelling/whitespace variation across ATT tabs and VISIT controlled centre lists.

Grain: One reviewed source-label/context mapping.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `centre_id` | `uuid` | no | `centres.id`; Confirmed centre |
| `project_id` | `uuid` | yes | `projects.id`; Disambiguating source project context |
| `source_family` | `text` | no | ATT/VISIT/etc context for alias scope |
| `raw_label` | `text` | no | Exact source label |
| `approved_by` | `uuid` | yes | `auth.users.id`; Reviewer accepting the alias |

Keys/constraints: PK id; unique source_family + project context + raw_label with explicit NULL handling; never fuzzy-map automatically.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 4. `academic_years` — Reference

Evidence/justification: ASM A dropdown and sparse populated A values; ATT annual grid does not itself establish school-year boundaries.

Grain: One defined academic year.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `label` | `text` | no | Verified academic-year label, e.g. source year label format |
| `starts_on` | `date` | yes | April 1 for a verified year; NULL only for unresolved draft definitions |
| `ends_on` | `date` | yes | Proposed exclusive April 1 of next year; inclusive business end March 31 |
| `approval_state` | `text` | no | Proposed pending/approved state |

Keys/constraints: PK id; unique label; if both dates known ends_on > starts_on; no automatic year fill.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 5. `assessment_periods` — Reference

Evidence/justification: ASM B Quarter: Q1-Q4; actual named data Q1/Q2.

Grain: One quarter within an academic year.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `academic_year_id` | `uuid` | no | `academic_years.id`; Confirmed year |
| `code` | `text` | no | Source Q1-Q4 code |
| `starts_on` | `date` | yes | Owner-approved date bounds |
| `ends_on` | `date` | yes | Owner-approved date bounds |
| `frontend_round_code` | `text` | yes | F1-F4 mapping only if separately approved |

Keys/constraints: PK id; unique(year,code); confirmed Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar; Q-to-F equivalence remains unapproved. Use reviewed consistent date-boundary encoding.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 6. `children` — Identity

Evidence/justification: Name-bearing ATT/CHILD/ACT/MOR/ASM records require reviewed resolution; no reliable shared child ID is supplied.

Grain: One adjudicated person, identified internally by UUID.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `generated_student_id` | `text` | no (new student) | Permanent unique human-readable application ID; server-issued; format/allocation and legacy backfill remain approval gates |
| `external_student_id` | `text` | yes | Existing verified business ID only; remains NULL when missing |
| `lifecycle_state` | `text` | no | Proposed active/archived identity lifecycle, not CAC dropout status |

Keys/constraints: PK id is an internal technical surrogate; generated_student_id is a distinct permanent application identity with confirmed permanent uniqueness; implementation pending and collision-safe server allocation required. It is never passed off as a historical source ID. No browser max+1; never regenerate on transfer. Legacy allocation policy remains pending. No unique name/DOB/phone constraints. External ID uniqueness only within verified issuing scope; not assumed global.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 7. `private_child_profiles` — Restricted identity

Evidence/justification: CHILD-01 B/D/F and names/gender context from CHILD-02/ATT/ASM; frontend Student Profile.

Grain: One current private identity projection per child; old observations remain in source/baseline history.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Resolved child |
| `full_name` | `text` | no | Approved current display identity, not a uniqueness key |
| `birth_date` | `date` | yes | Only unambiguous/approved DOB |
| `gender_code` | `text` | yes | Confirmed registration controlled values Girl/Boy; required for new form entry, unknown historical values stay NULL pending review |
| `class10_board_passed` | `boolean` | yes | Existing Yes/No/unknown profile projection; only Grade 10 form entry; exam-year/history semantics remain pending |
| `source_sex_label` | `text` | yes | Retain source wording; sex/gender vocabulary mapping requires review |
| `preferred_language` | `text` | yes | Approved interpretation of baseline Mother Tongue, if needed |

Keys/constraints: PK id; unique child_id; private schema/no anonymous grants; do not overwrite identity on a name-only match.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 8. `placement_observations` — History

Evidence/justification: ATT A:E; ASM C:E/H and shift context; CHILD-01 village/class and CHILD-02 current class.

Grain: One sourced placement/class observation.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Reviewed person |
| `centre_id` | `uuid` | yes | `centres.id`; Confirmed programme centre, not automatically residence |
| `project_id` | `uuid` | yes | `projects.id`; Observed project context |
| `shift_code` | `text` | yes | Source Morning/Evening if known |
| `academic_year_id` | `uuid` | yes | `academic_years.id`; Only when source year resolved |
| `grade_label` | `text` | yes | Source grade/class value |
| `residence_label` | `text` | yes | Private source village context, separated from programme centre |
| `observed_on` | `date` | yes | Known observation date only |
| `certainty` | `text` | no | Proposed observed/confirmed status |

Keys/constraints: PK id; provenance identity prevents repeated extraction; observations do not assert an enrolment start or transfer date.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 9. `enrolments` — History / frontend proposal

Evidence/justification: Frontend enrolment/exit form and historical retrieval requirement; CHILD-02 retain/remove is evidence to investigate, not dated enrolment history.

Grain: One confirmed dated placement/enrolment episode.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Child |
| `centre_id` | `uuid` | no | `centres.id`; Centre |
| `project_id` | `uuid` | yes | `projects.id`; Programme project |
| `shift_code` | `text` | no | Approved shift |
| `academic_year_id` | `uuid` | yes | `academic_years.id`; Approved year if applicable |
| `grade_label` | `text` | yes | Grade for this episode; confirmed new registration options 1–10 |
| `starts_on` | `date` | no | Confirmed effective start, never defaulted to grid start |
| `ends_on` | `date` | yes | Exclusive effective end under proposed interval convention |
| `exit_reason` | `text` | yes | Approved reason, not inferred dropout |
| `status_code` | `text` | no | Existing controlled registration values Active / CAC dropout / Left programme; no automatic dropout classification |

Keys/constraints: PK id; end > start; overlap and exclusive-end versus frontend exit-date semantics require approval. New-entry controls preserve Morning/Evening, grades 1–10 and confirmed status values; source anomalies remain exceptions, not invented options. Historical rows without dates remain observations/staging, not fabricated episodes.

Index plan: (child_id,starts_on); (centre_id,shift_code,starts_on); reviewed range exclusion only after overlap policy approval.

### 10. `roster_reviews` — Source-backed history

Evidence/justification: CHILD-02 A:G, including Remove/Retain?, Current Class and removal reasons.

Grain: One source roster-review observation or later reviewed decision.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Resolved person |
| `project_id` | `uuid` | yes | `projects.id`; Confirmed context |
| `reviewed_on` | `date` | yes | Actual review date if established |
| `source_action` | `text` | no | Exact observed action; not auto-normalized to enrolment closure |
| `current_class` | `text` | yes | Recorded retained class |
| `reason` | `text` | yes | Restricted free-text reason |
| `review_state` | `text` | no | Proposed pending/approved/rejected interpretation |

Keys/constraints: PK id; no automatic exit-date creation; 82 noncanonical labels need review.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 11. `private_baseline_surveys` — Restricted source-backed survey

Evidence/justification: CHILD-01 complete 55-column questionnaire, including family, economic and safeguarding information not needed for normal operational charts.

Grain: One captured baseline survey per child/source occurrence.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Resolved child |
| `survey_version` | `text` | no | Version of the captured questionnaire/header structure |
| `observed_on` | `date` | yes | Known survey date only |
| `purpose_approval_ref` | `text` | yes | Secure owner approval to retain these sensitive responses |
| `retention_review_on` | `date` | yes | Proposed retention review date |

Keys/constraints: PK id; no inferred survey date or shared household identity. Import/retention of sensitive sections remains gated by D10.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 12. `private_baseline_answers` — Restricted source-backed survey

Evidence/justification: CHILD-01 A:BC field map in SOURCE-INVENTORY; repeated occupation/meal headers must not be collapsed.

Grain: One answer per versioned source question within a survey.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `survey_id` | `uuid` | no | `private_baseline_surveys.id`; Survey |
| `question_key` | `text` | no | Versioned column-position key, not label alone |
| `source_column` | `text` | no | Exact source column coordinate |
| `response_text` | `text` | yes | Literal response after approved safe extraction; NULL remains unknown |
| `observed_value_type` | `text` | yes | Source number/text/date classification |
| `approved_typed_value` | `jsonb` | yes | Optional reviewed interpretation; not an automatic coercion |

Keys/constraints: PK id; unique(survey_id,question_key). Intentional questionnaire archive exception: generic answers only for sensitive evolving baseline, not operational relationships/metrics. No household merges, meal-block semantics or ROI-scale assumptions.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 13. `staff` — Identity / security proposal

Evidence/justification: VISIT officer context in B2; frontend officer scope. Source officer names are not accounts.

Grain: One confirmed staff person.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `user_id` | `uuid` | yes | `auth.users.id`; Auth account only after explicit identity confirmation |
| `private_name` | `text` | no | Restricted staff display identity |
| `external_staff_id` | `text` | yes | Verified existing staff ID |

Keys/constraints: PK id; no name-only account linking; unique non-null user_id if one-person/account policy approved.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 14. `staff_assignments` — History / approval required

Evidence/justification: VISIT officer-centre dropdown/context and frontend scope; effective dates are not supplied.

Grain: One dated business responsibility assignment.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `staff_id` | `uuid` | no | `staff.id`; Confirmed staff |
| `centre_id` | `uuid` | no | `centres.id`; Centre |
| `shift_code` | `text` | yes | Optional confirmed shift scope |
| `role_code` | `text` | no | Approved business responsibility, not a browser role |
| `starts_on` | `date` | no | Confirmed effective start |
| `ends_on` | `date` | yes | Exclusive end |

Keys/constraints: PK id; reviewed interval/overlap rules; source tab ownership alone cannot grant database rights.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 15. `user_scope_grants` — Security infrastructure proposal

Evidence/justification: Frontend role/scope requirements and absence of real authorization; Phase 2E confirms read-only Leadership and assigned-scope teacher/officer writes; no actual assignments are granted.

Grain: One explicit approved capability/scope grant.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `user_id` | `uuid` | no | `auth.users.id`; Authenticated principal |
| `centre_id` | `uuid` | yes | `centres.id`; Scoped centre, if approved |
| `project_id` | `uuid` | yes | `projects.id`; Scoped project, if approved |
| `capability_code` | `text` | no | Explicit reviewed capability |
| `starts_at` | `timestamptz` | no | Grant validity start |
| `ends_at` | `timestamptz` | yes | Grant validity end |
| `approved_by` | `uuid` | no | `auth.users.id`; Authorized granting actor |

Keys/constraints: PK id; empty scope must not silently mean global access; deny by default. Phase 2E role write boundaries apply; actual assignments, read/private/export/import/admin capabilities and granting authority still require D11. Check old/new record scope and all related FKs; null scope never implies global. No policies/grants are implemented.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 16. `attendance_codes` — Source-backed lookup

Evidence/justification: ATT list validations and observed P/A/WO/MM/L; frontend H is not present in source validations.

Grain: One status vocabulary entry.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `code` | `text` | no | Exact source status code |
| `meaning` | `text` | yes | Owner-approved definition |
| `approved` | `boolean` | no | Whether semantics are accepted for operational use |

Keys/constraints: PK id; unique code; P=Present, A=Absent, L=Leave, WO=Sunday, MM=Monthly Meeting (Phase 2E user confirmation). Rate is 100*P/(P+A+L), excluding WO/MM/confirmed holidays; non-scheduled days are holidays only under an authoritative calendar. Missing remains unknown. H representation, conflict adjudication, zero-denominator display/rounding and calendar authority remain pending. Preserve distinct literal reasons; do not collapse into H.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 17. `cac_sessions` — Frontend-only operational extension

Evidence/justification: Frontend sessionEntry; ATT day grids are not proof of explicitly Held/Cancelled sessions.

Grain: One explicit centre/shift/day session under current frontend assumption.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `centre_id` | `uuid` | no | `centres.id`; Centre |
| `shift_code` | `text` | no | Approved shift |
| `session_date` | `date` | no | Actual session date |
| `status_code` | `text` | no | Proposed Planned/Held/Cancelled |
| `correction_reason` | `text` | yes | If required by approved editing policy |

Keys/constraints: PK id; proposed unique(centre,shift,date) requires D03/D13. Do not infer Held from P or Planned from calendar/date.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 18. `attendance_records` — Source-backed operational fact

Evidence/justification: ATT dated cell grid; frontend single/bulk attendance.

Grain: One child/centre/shift/date observation after reconciliation.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Resolved child |
| `centre_id` | `uuid` | no | `centres.id`; Confirmed source centre |
| `shift_code` | `text` | no | Confirmed source shift |
| `attendance_date` | `date` | no | Resolved distinct day header |
| `code_id` | `uuid` | no | `attendance_codes.id`; Literal approved/mapped code |
| `enrolment_id` | `uuid` | yes | `enrolments.id`; Confirmed historical episode, if available |
| `session_id` | `uuid` | yes | `cac_sessions.id`; Explicit session, not inferred |
| `correction_reason` | `text` | yes | Approved correction context |

Keys/constraints: PK id; proposed unique(child,centre,shift,date), subject to multi-shift policy. No blank -> A/H coercion; unknown is no accepted observation. Cross-FK centre/date/shift consistency must be validated transactionally.

Index plan: (centre_id,shift_code,attendance_date); (child_id,attendance_date); provenance-cell idempotency guard.

### 19. `assessment_definitions` — Source-backed reference

Evidence/justification: ASM B3 maximum, project/shift tab context, Academic Year and Quarter; paper identity unresolved.

Grain: One approved paper/scale definition per period/project/shift/revision.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `project_id` | `uuid` | no | `projects.id`; Project |
| `period_id` | `uuid` | no | `assessment_periods.id`; Verified year/quarter |
| `shift_code` | `text` | no | Source shift |
| `paper_label` | `text` | yes | Only if verified; no invented paper name |
| `max_score` | `numeric` | no | 25 for the confirmed process; conflicted historical max100 metadata requires reviewed applicability, not rescaling |
| `revision` | `integer` | no | Immutable approved definition revision |
| `approval_state` | `text` | no | Pending/approved definition |

Keys/constraints: PK id; max_score > 0; approved definition immutable once results reference it. Definition uniqueness depends on paper identity D06. Preserve raw max100 metadata in restricted provenance; pending definitions/results are not accepted operational facts. No automatic scale conversion.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 20. `assessment_batches` — Frontend-only extension

Evidence/justification: Frontend group exam date/comment form; ASM does not provide a stable batch ID or overall comment field.

Grain: One explicit entry batch, not a filter-string identity.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `definition_id` | `uuid` | no | `assessment_definitions.id`; Paper definition |
| `centre_id` | `uuid` | yes | `centres.id`; Explicit reviewed scope |
| `shift_code` | `text` | yes | Scope |
| `assessment_date` | `date` | yes | Shared date only if applicable |
| `comment` | `text` | yes | Restricted overall assessment comment |

Keys/constraints: PK id; changing UI filters must not redefine a historical batch. Results retain individual dates and membership through batch FK.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 21. `assessment_results` — Source-backed operational fact

Evidence/justification: ASM A:H; frontend marks and correction forms.

Grain: One accepted current result per child and approved paper definition; routine repeat attempts are outside the confirmed process. Corrections retain audit/revision history.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Resolved child |
| `definition_id` | `uuid` | no | `assessment_definitions.id`; Approved year/quarter/paper/scale |
| `centre_id` | `uuid` | no | `centres.id`; Confirmed assessment centre |
| `batch_id` | `uuid` | yes | `assessment_batches.id`; Optional entry batch |
| `assessed_on` | `date` | yes | Reviewed source date; future canonical recorded results require date per approved policy |
| `score` | `numeric` | yes | Literal numeric score; zero is a score |
| `status_code` | `text` | no | Proposed Recorded/Absent/Not entered; unresolved source rows stay outside final operational tables |
| `teacher_remark` | `text` | yes | Frontend requirement, not an existing ASM column |

Keys/constraints: PK id; proposed unique(child,definition) for confirmed non-repeat process; exceptional evidenced repeats need separate approval, never a fabricated attempt 1. Plain CHECK cannot read definition maximum: use reviewed transaction/RPC/trigger validation. Source missing score is not Absent; retain unresolved rows in staging. Decimal policy must follow D06.

Index plan: (child_id,definition_id); (definition_id,centre_id); unresolved/status coverage queries.

### 22. `monthly_activity_returns` — Source-backed historical fact

Evidence/justification: ACT B2 month and A:C child/name/class context under project-labelled tabs.

Grain: One reviewed monthly source return per child/project/month.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Resolved child |
| `project_id` | `uuid` | no | `projects.id`; Verified project |
| `month` | `date` | no | First day of the source month as period key, not an event date |
| `source_class` | `text` | yes | Observed class snapshot |
| `centre_id` | `uuid` | yes | `centres.id`; Only with independently confirmed mapping |

Keys/constraints: PK id; proposed unique child/project/month only after duplicate review; no source centre or shift is invented.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 23. `monthly_activity_responses` — Source-backed historical fact

Evidence/justification: ACT D:G Activity 1-4 Yes/No/blank.

Grain: One response per return/slot.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `return_id` | `uuid` | no | `monthly_activity_returns.id`; Monthly return |
| `slot_number` | `smallint` | no | Source ordinal 1..4 |
| `participated` | `boolean` | yes | Yes=true; No=false; blank=NULL |
| `activity_event_id` | `uuid` | yes | `activity_events.id`; Only an explicitly approved later mapping |

Keys/constraints: PK id; unique(return,slot); slot between 1 and 4; never synthesize dates/categories/Held from slot or Yes.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 24. `activity_events` — Frontend-only operational extension

Evidence/justification: Frontend two-stage activity entry; source ACT lacks event identity/date/category/status.

Grain: One explicitly recorded activity session.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `project_id` | `uuid` | yes | `projects.id`; Approved project |
| `centre_id` | `uuid` | no | `centres.id`; Centre |
| `shift_code` | `text` | yes | Explicit applicability; Both shifts semantics require review |
| `activity_date` | `date` | no | Entered actual/planned date |
| `name` | `text` | no | Staff-entered named activity; no confirmed catalogue supplied |
| `category_code` | `text` | yes | Approved category; no sample catalogue seeded as MASS policy |
| `status_code` | `text` | no | Proposed Planned/Held/Cancelled |

Keys/constraints: PK id; duplicate rule centre/date/shift/name is proposed, not a verified universal business key. Do not auto-generate events from historical monthly slots. Four Saturday activities is a general monthly pattern, not a required exact count or inferred dates/categories.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 25. `activity_participation` — Frontend-only operational extension

Evidence/justification: Frontend per-event participation editor, distinct from historical ACT slots.

Grain: One child response per event.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `event_id` | `uuid` | no | `activity_events.id`; Explicit event |
| `child_id` | `uuid` | no | `children.id`; Child |
| `participated` | `boolean` | yes | Attended/Not attended/unknown |
| `eligibility_enrolment_id` | `uuid` | yes | `enrolments.id`; If verified for event date |

Keys/constraints: PK id; unique(event,child); transactionally validate eligibility, Held/all-marked rule if approved, non-Held constraints and changes of event scope. Preserve audit on clears.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 26. `centre_visits` — Source-backed operational fact

Evidence/justification: VISIT log A:D and officer B2; summary counts are derived.

Grain: One verified visit occurrence.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `staff_id` | `uuid` | no | `staff.id`; Confirmed officer |
| `centre_id` | `uuid` | no | `centres.id`; Approved centre alias |
| `shift_code` | `text` | no | Morning/Evening source label |
| `visited_on` | `date` | no | Actual confirmed date; all current non-example rows are unresolved |
| `remarks` | `text` | yes | Source remarks, restricted free text |
| `next_action` | `text` | yes | Frontend extension, not separate source field |
| `status_code` | `text` | yes | Frontend Planned/Completed only when explicitly entered or approved |

Keys/constraints: PK id; no unique centre/day rule: multiple visits may be legitimate. Do not infer Completed or dates from summaries, row order or example.

Index plan: (centre_id,visited_on,shift_code); (staff_id,visited_on).

### 27. `programme_cohorts` — History / conditional source mapping

Evidence/justification: MOR programme/project context; frontend cohort-year comparison. No source cohort year is supplied.

Grain: One confirmed programme cohort.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `programme_code` | `text` | no | Approved Morarji/guidance programme identity |
| `label` | `text` | no | Confirmed cohort label, not fabricated from example date |
| `academic_year_id` | `uuid` | yes | `academic_years.id`; Only if equivalent and confirmed |
| `starts_on` | `date` | yes | Confirmed period boundary |
| `ends_on` | `date` | yes | Confirmed period boundary |

Keys/constraints: PK id; cohort identity and repeated participation require D08; no automatic mapping from file year or grade progression.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 28. `cohort_memberships` — History / conditional source mapping

Evidence/justification: MOR named rows and frontend add-to-cohort requirement; source person/cohort must be resolved first.

Grain: One child membership in one cohort; multiple cohorts per child are allowed.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `cohort_id` | `uuid` | no | `programme_cohorts.id`; Confirmed cohort |
| `child_id` | `uuid` | no | `children.id`; Resolved child |
| `project_id` | `uuid` | yes | `projects.id`; Source project context |
| `centre_id` | `uuid` | yes | `centres.id`; Confirmed historical centre |
| `source_observed_on` | `date` | yes | Source Date only after meaning is agreed |

Keys/constraints: PK id; proposed unique(cohort,child); duplicates/attempts may require further distinction before implementation.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 29. `morarji_outcomes` — Source-backed + explicitly optional frontend fields

Evidence/justification: MOR D:G Applied/Attended/Passed/School; frontend training days/selection/admission/scholarship are unsupported extensions.

Grain: One outcome set per membership, with audited corrections.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `membership_id` | `uuid` | no | `cohort_memberships.id`; Cohort member |
| `applied` | `boolean` | yes | Literal source Yes/No or unknown |
| `attended` | `boolean` | yes | Literal applied/attended/passed workflow flag; exact attended context still unresolved, never a derived training-day count |
| `passed` | `boolean` | yes | Literal source flag; No not automatically failed/absent/pending |
| `passed_school_name` | `text` | yes | Source School Name (if Passed) |
| `reported_training_days` | `integer` | yes | Optional frontend-only reported count; no source derivation |
| `selected` | `boolean` | yes | Optional extension, no source backfill |
| `admitted` | `boolean` | yes | Optional extension, no source backfill |
| `scholarship_state` | `text` | yes | Optional extension, no source backfill |

Keys/constraints: PK id; unique membership; boolean consistency rules require approval because source has 35 flag conflicts. Optional training days >=0 if used. No pass -> admission/scholarship inference.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 30. `followup_actions` — Frontend-only extension

Evidence/justification: Existing follow-up modal and overwrite-history risk; no matching standalone source in six workbooks.

Grain: One follow-up episode/action; append new episodes rather than replacing the child latest note.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `child_id` | `uuid` | no | `children.id`; Child |
| `centre_id` | `uuid` | yes | `centres.id`; Confirmed scope at action time |
| `membership_id` | `uuid` | yes | `cohort_memberships.id`; Optional programme link |
| `status_code` | `text` | no | Proposed To follow up/In progress/Completed |
| `note` | `text` | no | Restricted action/observation |
| `next_contact_on` | `date` | yes | Explicit next date |
| `occurred_at` | `timestamptz` | no | Actual action creation time, not invented source history |

Keys/constraints: PK id; nonblank note; status/history/retention require D12/D13. No invented historical follow-ups.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 31. `guidance_sessions` — Unapproved future extension

Evidence/justification: Frontend optional Career Guidance; none of six source workbooks supplies this dataset.

Grain: One explicit career-guidance session.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `cohort_id` | `uuid` | yes | `programme_cohorts.id`; Approved cohort if applicable |
| `centre_id` | `uuid` | yes | `centres.id`; Session scope |
| `session_date` | `date` | no | Explicit session date |
| `title` | `text` | yes | Approved programme/session label |

Keys/constraints: PK id; extension only after D12, not part of historical source import.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 32. `guidance_participants` — Unapproved future extension

Evidence/justification: Frontend newGuidance standalone person; no source-backed guidance dataset.

Grain: One participant in one session.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `session_id` | `uuid` | no | `guidance_sessions.id`; Session |
| `child_id` | `uuid` | yes | `children.id`; Only confirmed linkage to shared person registry |
| `private_participant_name` | `text` | yes | Restricted temporary identity if non-roster participation is approved |
| `centre_id` | `uuid` | yes | `centres.id`; Confirmed centre |
| `grade_label` | `text` | yes | Recorded class |

Keys/constraints: PK id; require approved identity model before accepting unmatched participants; do not copy frontend free-standing names into children automatically.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 33. `guidance_followups` — Unapproved future extension

Evidence/justification: Frontend follow-up date/contact/destination/evidence; no source worksheet.

Grain: One dated guidance follow-up, not an overwrite of the only history row.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `participant_id` | `uuid` | no | `guidance_participants.id`; Participant |
| `followed_up_on` | `date` | no | Actual contact/review date |
| `contact_state` | `text` | no | Approved contact vocabulary |
| `destination_label` | `text` | yes | Owner-approved destinations, not sample enums |
| `verification_state` | `text` | yes | Approved evidence vocabulary |

Keys/constraints: PK id; contact/destination consistency and evidence policy require D12.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 34. `guidance_feedback` — Unapproved future extension

Evidence/justification: Frontend single guidanceFeedback value; no source supports its original global scope.

Grain: One authored session feedback record.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `session_id` | `uuid` | no | `guidance_sessions.id`; Explicit session scope |
| `staff_id` | `uuid` | yes | `staff.id`; Confirmed author when applicable |
| `feedback` | `text` | no | Restricted qualitative response |

Keys/constraints: PK id; no source migration; replace global context with explicit session/author only after review.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 35. `funders` — Unapproved reporting extension

Evidence/justification: Frontend donor filter; workbook project labels are not verified funder identities/contracts.

Grain: One verified funder.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `name` | `text` | no | Confirmed funder identity |
| `external_code` | `text` | yes | Existing verified code only |

Keys/constraints: PK id; no automatic mapping project -> funder; external donor accounts not authorized.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 36. `centre_funding_periods` — Unapproved reporting extension

Evidence/justification: Frontend donor aggregate requirement and absence of source funding history.

Grain: One verified funding relationship/period.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `funder_id` | `uuid` | no | `funders.id`; Funder |
| `centre_id` | `uuid` | no | `centres.id`; Centre |
| `project_id` | `uuid` | yes | `projects.id`; Confirmed project link |
| `starts_on` | `date` | no | Confirmed funding start |
| `ends_on` | `date` | yes | Confirmed exclusive end |
| `attribution_rule` | `text` | yes | Approved overlapping-funding allocation |

Keys/constraints: PK id; overlap may be legitimate; do not duplicate child counts across funders without approved attribution. No source import until D11/D12.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 37. `source_files` — Migration infrastructure

Evidence/justification: All six exact XLSX copies, hashes in SOURCE-INVENTORY.

Grain: One immutable source snapshot.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `original_file_id` | `text` | yes | Original Drive ID only when supplied |
| `filename` | `text` | no | Exact input filename |
| `sha256` | `text` | no | Exact immutable file fingerprint |
| `source_version` | `text` | yes | Known original version, never invented |
| `storage_ref` | `text` | no | Restricted immutable artifact reference |
| `exported_at` | `timestamptz` | yes | Known export timestamp |
| `received_at` | `timestamptz` | no | System receipt time, not a record event date |

Keys/constraints: PK id; unique SHA-256 under reviewed storage rules; changed snapshots never overwrite prior provenance.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 38. `source_sheets` — Migration infrastructure

Evidence/justification: All 53 audited worksheets, including hidden/report/example-only tabs.

Grain: One sheet within one immutable workbook snapshot.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `file_id` | `uuid` | no | `source_files.id`; Immutable snapshot |
| `native_sheet_id` | `text` | yes | XLSX sheet identifier; not falsely called a Google sheet ID |
| `ordinal` | `integer` | no | Workbook tab ordinal |
| `name` | `text` | no | Exact tab name, retaining whitespace |
| `classification` | `text` | no | Input/master/helper/report/template pending owner approval |
| `header_spec` | `jsonb` | no | Versioned header/column/date/validation metadata, no personal records |

Keys/constraints: PK id; unique(file,ordinal), native ID where trustworthy. Hidden sheets must be explicitly classified, not skipped.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 39. `import_batches` — Migration infrastructure

Evidence/justification: Requested safe retries/reconciliation and all source families.

Grain: One import execution/retry context.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `mapping_version` | `text` | no | Reviewed transformation version |
| `extractor_version` | `text` | no | Reproducible extraction code version |
| `state` | `text` | no | Proposed staged/validated/approved/running/complete/failed |
| `started_at` | `timestamptz` | no | Actual run time |
| `completed_at` | `timestamptz` | yes | Actual completion |
| `checkpoint` | `jsonb` | yes | Non-PII retry state |
| `counts` | `jsonb` | yes | Extracted/accepted/quarantined/excluded/reconciled counts |

Keys/constraints: PK id; state transitions restricted to import service; no import performed by this design.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 40. `source_rows` — Migration infrastructure

Evidence/justification: Every real/partial/example/report row must be accounted for with file/tab/row provenance.

Grain: One row occurrence in a frozen source snapshot.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `sheet_id` | `uuid` | no | `source_sheets.id`; Exact snapshot/tab |
| `first_batch_id` | `uuid` | no | `import_batches.id`; First extraction context |
| `row_locator` | `text` | no | Physical row/range in immutable snapshot |
| `source_record_identifier` | `text` | yes | Literal source record identifier/local serial if present; not a canonical person ID |
| `content_hash` | `text` | no | Private row fingerprint, not a child ID |
| `payload_ref` | `text` | yes | Restricted/encrypted raw payload reference, not a public URL |
| `classification` | `text` | no | Candidate/example/scaffold/summary/rejected etc |
| `canonical_source_row_id` | `uuid` | yes | `source_rows.id`; Reviewed duplicate-source equivalence only; not automatic person merge |

Keys/constraints: PK id; unique(sheet,row_locator); changed file -> new source snapshot. Fingerprint alone does not identify legitimate identical rows.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 41. `identity_resolutions` — Migration infrastructure / restricted

Evidence/justification: Absent person IDs and ambiguous links across ATT/CHILD/ACT/MOR/ASM; staff context also needs explicit linkage.

Grain: One versioned resolution decision for a source person observation.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `source_row_id` | `uuid` | no | `source_rows.id`; Source person observation |
| `child_id` | `uuid` | yes | `children.id`; Confirmed child if accepted |
| `staff_id` | `uuid` | yes | `staff.id`; Confirmed staff if accepted |
| `decision` | `text` | no | Proposed unresolved/accepted/rejected/ambiguous |
| `method` | `text` | yes | Verified-ID/manual-evidence method; no name-only auto matching |
| `reviewed_by` | `uuid` | yes | `auth.users.id`; Authorized reviewer |
| `evidence_ref` | `text` | yes | Restricted evidence reference |

Keys/constraints: PK id; accepted decisions require exactly one child/staff target and reviewer; only one current accepted decision per observation. Internal child UUID is created only for an adjudicated person, not guessed duplicates.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 42. `import_exceptions` — Migration infrastructure / restricted

Evidence/justification: Private audit exception register and requested failed-record logging.

Grain: One issue for one source row/field/run; reasons can overlap.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `batch_id` | `uuid` | no | `import_batches.id`; Run context |
| `source_row_id` | `uuid` | no | `source_rows.id`; File/tab/row locator |
| `field_locator` | `text` | yes | Source field/cell |
| `reason_code` | `text` | no | Non-PII category |
| `review_state` | `text` | no | Open/assigned/resolved/rejected proposal |
| `resolution_note` | `text` | yes | Restricted review detail; no raw values in general logs |
| `resolved_by` | `uuid` | yes | `auth.users.id`; Authorized reviewer |
| `resolved_at` | `timestamptz` | yes | Actual resolution time |

Keys/constraints: PK id; deduplicate repeated issue generation by batch,row,field,reason with explicit NULL handling. Audit flags are not imported records or proven failures.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

### 43. `audit_events` — Security / migration infrastructure

Evidence/justification: Frontend overwrite/edit workflows and required actor/record history; no source audit history is invented.

Grain: One append-only audited operation.

| Field | Type | Nullable | FK / definition |
| --- | --- | --- | --- |
| `actor_user_id` | `uuid` | yes | `auth.users.id`; Actual actor/service identity |
| `entity_type` | `text` | no | Allowlisted target type |
| `entity_id` | `uuid` | no | Audit locator, intentionally not a polymorphic business FK |
| `operation` | `text` | no | Create/update/clear/approve/import etc |
| `changed_at` | `timestamptz` | no | Actual transaction time |
| `change_metadata` | `jsonb` | no | Minimized field/revision metadata; sensitive values protected separately |
| `batch_id` | `uuid` | yes | `import_batches.id`; Import context when applicable |

Keys/constraints: PK id; no client writes/edits; entity locator intentionally survives archival without FK cascade. Canonical business FKs are enforced separately; validate target allowlist and audit completeness. No PII-rich generic before/after dumps.

Index plan: Foreign-key lookup indexes plus workload-specific indexes after query-plan review.

## Acceptance gates and normalization decisions

Before DDL, resolve relevant remaining gates in PHASE-2E-RULE-RECONCILIATION and PHASE-2E-IMPLEMENTATION-READINESS. Confirmed policy does not approve historical row attribution, privacy, audit, foundation scope or execution. The audit does not establish an import-ready person registry, calendar policy, result scale, donor grant or cohort year. Nullability here supports truthful observations; accepted operational writes still require approved completeness rules. Do not load unresolved results as Recorded or visit rows as Completed.

Source surveys deliberately retain question responses before field-by-field canonicalization because the two meal blocks and financial/health questions have ambiguous semantics. This is a source-backed private archive, not a decision that every sensitive field must be retained indefinitely. Current profile projections are not a replacement for snapshots or identity adjudication. Do not infer shared households from parent names or shared phone numbers.

Quantitative dashboard outputs should be derived from approved source-grain facts through reviewed SQL views/RPCs. Preserve raw inputs, calculation version and reconciliation evidence. Do not store mutable copies of aggregate charts as the authoritative data model. Materialized views are optional only after measured performance need and disclosure review.
