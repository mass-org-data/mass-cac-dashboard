# Implemented database data dictionary

Phase 3C, 27 October 2026. **23 locally implemented relations: six foundation and 17 core; 15 migrations. Not hosted or approved for production execution.**

This dictionary is generated from PostgreSQL catalog metadata after all 15 committed migrations are applied to an isolated empty database. SQL is authoritative. The machine-readable [inventory](DATABASE-SCHEMA-INVENTORY.json) includes migration SHA-256 checksums, exact columns/defaults/constraints, indexes, policies, triggers, functions and ACL metadata. Reproduce with `bash tests/schema/run-local.sh`.

The earlier **43-relation proposal** is preserved byte-for-byte in [the Phase 2E dictionary snapshot](DATABASE-PROPOSED-DATA-DICTIONARY-PHASE-2E.md); see [deferred relations](DATABASE-DEFERRED-RELATIONS.md). Historical decision documents retain their original context. This current dictionary makes no claim that every proposal is implemented.

`auth.users` is an existing managed dependency, not a 24th relation created by these migrations. All 23 local relations enable and force RLS. NULL means unknown/optional, not absent/false/zero. Business dates are explicit dates; timestamptz operation metadata is not a fabricated source date. `PK/FK/UK` below describe exact keys; a composite FK must be read as a whole in its constraint definition. Nullable reports the catalog NOT NULL declaration; generated student_id/year-end values are nevertheless non-null under the current strict expressions over required inputs. No generic shared timestamp/origin columns are implied.

## Inventory

| Relation | Columns | PK | Creation migration |
| --- | --- | --- | --- |
| `mass_core.academic_years` | 4 | `id` | `202610270009_academic_periods.sql` |
| `mass_core.activity_events` | 6 | `id` | `202610270012_named_activities.sql` |
| `mass_core.activity_participation` | 8 | `id` | `202610270012_named_activities.sql` |
| `mass_core.assessment_definitions` | 4 | `id` | `202610270011_assessments.sql` |
| `mass_core.assessment_periods` | 4 | `id` | `202610270009_academic_periods.sql` |
| `mass_core.assessment_results` | 9 | `id` | `202610270011_assessments.sql` |
| `mass_core.attendance_codes` | 3 | `code` | `202610270010_attendance.sql` |
| `mass_core.attendance_records` | 8 | `id` | `202610270010_attendance.sql` |
| `mass_core.cac_sessions` | 7 | `id` | `202610270010_attendance.sql` |
| `mass_core.centres` | 3 | `id` | `202610270007_auth_scope.sql` |
| `mass_core.children` | 3 | `id` | `202610270008_identity_history.sql` |
| `mass_core.cohort_memberships` | 7 | `id` | `202610270013_morarji.sql` |
| `mass_core.enrolments` | 9 | `id` | `202610270008_identity_history.sql` |
| `mass_core.morarji_outcomes` | 8 | `id` | `202610270013_morarji.sql` |
| `mass_core.private_child_profiles` | 6 | `id` | `202610270008_identity_history.sql` |
| `mass_core.programme_cohorts` | 4 | `id` | `202610270013_morarji.sql` |
| `mass_core.user_scope_grants` | 10 | `id` | `202610270007_auth_scope.sql` |
| `mass_foundation.audit_events` | 10 | `id` | `202610270006_audit_events.sql` |
| `mass_foundation.import_batches` | 13 | `id` | `202610270003_import_batches.sql` |
| `mass_foundation.import_exceptions` | 10 | `id` | `202610270005_import_exceptions.sql` |
| `mass_foundation.source_files` | 7 | `id` | `202610270001_source_files.sql` |
| `mass_foundation.source_rows` | 6 | `id` | `202610270004_source_rows.sql` |
| `mass_foundation.source_sheets` | 6 | `id` | `202610270002_source_sheets.sql` |

## mass_core.academic_years

April 1 academic-year start and generated next-April-1 exclusive end.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `starts_on` | `date` | no | UK | `none` | Explicit April 1 for a verified academic year. |
| `ends_before` | `date` | yes | — | `GENERATED ALWAYS STORED: ((starts_on + '1 year'::interval))::date` | Generated next April 1; inclusive business end is March 31. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
academic_years_pkey: PRIMARY KEY (id)
academic_years_starts_on_check: CHECK (((EXTRACT(month FROM starts_on) = (4)::numeric) AND (EXTRACT(day FROM starts_on) = (1)::numeric)))
academic_years_starts_on_key: UNIQUE (starts_on)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.activity_events

Explicit named, dated single-shift event; no invented catalogue/category or historical slot bridge.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | composite UK, PK | `gen_random_uuid()` | Stable technical UUID. |
| `centre_id` | `uuid` | no | FK, composite UK | `none` | Verified centre scope; not inferred residence. |
| `shift_code` | `text` | no | composite UK | `none` | Morning/Evening controlled applicability. |
| `activity_date` | `date` | no | — | `none` | Explicit event date; no generated Saturday or historical slot date. |
| `name` | `text` | no | — | `none` | Explicit non-personal activity name. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
activity_events_centre_id_fkey: FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT
activity_events_id_centre_id_shift_code_key: UNIQUE (id, centre_id, shift_code)
activity_events_name_check: CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 160)))
activity_events_pkey: PRIMARY KEY (id)
activity_events_shift_code_check: CHECK ((shift_code = ANY (ARRAY['Morning'::text, 'Evening'::text])))
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.activity_participation

One child response per event, including unknown NULL, with matching episode/context.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `event_id` | `uuid` | no | FK, composite UK | `none` | Explicit event FK; scope/date checked against enrolment. |
| `child_id` | `uuid` | no | FK, composite UK | `none` | Registered child reference; never a name-derived identity. |
| `centre_id` | `uuid` | no | FK | `none` | Verified centre scope; not inferred residence. |
| `shift_code` | `text` | no | FK | `none` | Morning/Evening controlled applicability. |
| `enrolment_id` | `uuid` | no | FK | `none` | Verified historical episode; composite FK preserves child/centre/shift context. |
| `participated` | `boolean` | yes | — | `none` | True/false/NULL; unknown is never automatically false. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
activity_participation_enrolment_id_child_id_centre_id_shi_fkey: FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT
activity_participation_event_id_centre_id_shift_code_fkey: FOREIGN KEY (event_id, centre_id, shift_code) REFERENCES mass_core.activity_events(id, centre_id, shift_code) ON DELETE RESTRICT
activity_participation_event_id_child_id_key: UNIQUE (event_id, child_id)
activity_participation_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.assessment_definitions

Current-process 25-mark quarter definition; conflicted historical maxima are not accepted here.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `period_id` | `uuid` | no | FK, UK | `none` | Approved quarter/year definition FK. |
| `max_score` | `numeric` | no | — | `25` | Exactly 25 for current confirmed process; never historical rescaling. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
assessment_definitions_max_score_check: CHECK ((max_score = (25)::numeric))
assessment_definitions_period_id_fkey: FOREIGN KEY (period_id) REFERENCES mass_core.assessment_periods(id) ON DELETE RESTRICT
assessment_definitions_period_id_key: UNIQUE (period_id)
assessment_definitions_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.assessment_periods

Quarter 1–4 within an explicit academic year; Q/F alias is not inferred.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `academic_year_id` | `uuid` | no | FK, composite UK | `none` | Explicit academic-year FK; unknown historical years are not inferred. |
| `quarter` | `smallint` | no | composite UK | `none` | Quarter 1–4; Apr–Jun/Jul–Sep/Oct–Dec/Jan–Mar. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
assessment_periods_academic_year_id_fkey: FOREIGN KEY (academic_year_id) REFERENCES mass_core.academic_years(id) ON DELETE RESTRICT
assessment_periods_academic_year_id_quarter_key: UNIQUE (academic_year_id, quarter)
assessment_periods_pkey: PRIMARY KEY (id)
assessment_periods_quarter_check: CHECK (((quarter >= 1) AND (quarter <= 4)))
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.assessment_results

One recorded result per child/definition with verified date/context; no routine repeat attempts.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `child_id` | `uuid` | no | composite UK, FK | `none` | Registered child reference; never a name-derived identity. |
| `centre_id` | `uuid` | no | FK | `none` | Verified centre scope; not inferred residence. |
| `shift_code` | `text` | no | FK | `none` | Morning/Evening controlled applicability. |
| `enrolment_id` | `uuid` | no | FK | `none` | Verified historical episode; composite FK preserves child/centre/shift context. |
| `definition_id` | `uuid` | no | composite UK, FK | `none` | Approved current quarter/scale definition FK. |
| `assessed_on` | `date` | no | — | `none` | Actual verified date within quarter and episode. |
| `score` | `numeric` | no | — | `none` | Recorded numeric 0..25; zero valid, missing is no accepted result row. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
assessment_results_child_id_definition_id_key: UNIQUE (child_id, definition_id)
assessment_results_definition_id_fkey: FOREIGN KEY (definition_id) REFERENCES mass_core.assessment_definitions(id) ON DELETE RESTRICT
assessment_results_enrolment_id_child_id_centre_id_shift_c_fkey: FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT
assessment_results_pkey: PRIMARY KEY (id)
assessment_results_score_check: CHECK (((score >= (0)::numeric) AND (score <= (25)::numeric)))
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.attendance_codes

Confirmed P/A/L/WO/MM reference definitions; no unapproved H code.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `code` | `text` | no | PK | `none` | Exact P/A/L/WO/MM status reference. |
| `meaning` | `text` | no | — | `none` | Confirmed status meaning. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
attendance_codes_code_check: CHECK ((code = ANY (ARRAY['P'::text, 'A'::text, 'L'::text, 'WO'::text, 'MM'::text])))
attendance_codes_pkey: PRIMARY KEY (code)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.attendance_records

One accepted child/centre/shift/day mark tied to a verified episode; no automatic absence.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `child_id` | `uuid` | no | composite UK, FK | `none` | Registered child reference; never a name-derived identity. |
| `centre_id` | `uuid` | no | composite UK, FK | `none` | Verified centre scope; not inferred residence. |
| `shift_code` | `text` | no | composite UK, FK | `none` | Morning/Evening controlled applicability. |
| `enrolment_id` | `uuid` | no | FK | `none` | Verified historical episode; composite FK preserves child/centre/shift context. |
| `attendance_date` | `date` | no | composite UK | `none` | Explicit distinct, verified day. |
| `code` | `text` | no | FK | `none` | Exact P/A/L/WO/MM status reference. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
attendance_records_child_id_centre_id_shift_code_attendance_key: UNIQUE (child_id, centre_id, shift_code, attendance_date)
attendance_records_code_fkey: FOREIGN KEY (code) REFERENCES mass_core.attendance_codes(code) ON DELETE RESTRICT
attendance_records_enrolment_id_child_id_centre_id_shift_c_fkey: FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT
attendance_records_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.cac_sessions

Explicit confirmed scheduled/non-scheduled calendar entry, not frontend Held/Cancelled delivery status.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `centre_id` | `uuid` | no | FK, composite UK | `none` | Verified centre scope; not inferred residence. |
| `shift_code` | `text` | no | composite UK | `none` | Morning/Evening controlled applicability. |
| `session_date` | `date` | no | composite UK | `none` | Explicit confirmed calendar date. |
| `is_scheduled` | `boolean` | no | — | `none` | Confirmed calendar fact; missing row never proves holiday. |
| `confirmation_ref` | `uuid` | no | — | `none` | Opaque reference to verification evidence; no evidence payload or authority invented. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
cac_sessions_centre_id_fkey: FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT
cac_sessions_centre_id_shift_code_session_date_key: UNIQUE (centre_id, shift_code, session_date)
cac_sessions_pkey: PRIMARY KEY (id)
cac_sessions_shift_code_check: CHECK ((shift_code = ANY (ARRAY['Morning'::text, 'Evening'::text])))
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.centres

Confirmed centre identity/reference; labels are not automatically merged or globally unique.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `label` | `text` | no | — | `none` | Explicit supplied non-personal reference label; no automatic fuzzy identity. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
centres_label_check: CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120)))
centres_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.children

One explicitly registered person, internal UUID and immutable generated display ID; no name-only matching.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `student_id` | `text` | yes | UK | `GENERATED ALWAYS STORED: upper((id)::text)` | Permanent generated uppercase UUID display representation; not a fabricated source/student numbering scheme. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
children_pkey: PRIMARY KEY (id)
children_student_id_key: UNIQUE (student_id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.cohort_memberships

Unique cohort/child membership with verified centre/shift/episode linkage.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | composite UK, PK | `gen_random_uuid()` | Stable technical UUID. |
| `cohort_id` | `uuid` | no | composite UK, FK | `none` | Explicit Morarji cohort FK. |
| `child_id` | `uuid` | no | composite UK, FK | `none` | Registered child reference; never a name-derived identity. |
| `centre_id` | `uuid` | no | FK, composite UK | `none` | Verified centre scope; not inferred residence. |
| `shift_code` | `text` | no | FK | `none` | Morning/Evening controlled applicability. |
| `enrolment_id` | `uuid` | no | FK | `none` | Verified historical episode; composite FK preserves child/centre/shift context. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
cohort_memberships_cohort_id_child_id_key: UNIQUE (cohort_id, child_id)
cohort_memberships_cohort_id_fkey: FOREIGN KEY (cohort_id) REFERENCES mass_core.programme_cohorts(id) ON DELETE RESTRICT
cohort_memberships_enrolment_id_child_id_centre_id_shift_c_fkey: FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT
cohort_memberships_id_centre_id_key: UNIQUE (id, centre_id)
cohort_memberships_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.enrolments

Explicit dated child/centre/grade/shift episode; historical context cannot be overwritten.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | composite UK, PK | `gen_random_uuid()` | Stable technical UUID. |
| `child_id` | `uuid` | no | composite UK, FK | `none` | Registered child reference; never a name-derived identity. |
| `centre_id` | `uuid` | no | FK, composite UK | `none` | Verified centre scope; not inferred residence. |
| `grade_label` | `text` | no | — | `none` | Controlled grade 1–10 for this episode. |
| `shift_code` | `text` | no | composite UK | `none` | Morning/Evening controlled applicability. |
| `starts_on` | `date` | no | composite UK | `none` | Explicit verified business start date; no source year/date fill. |
| `ends_before` | `date` | yes | — | `none` | Exclusive interval end; do not assume frontend exit-date equivalence. |
| `status_code` | `text` | no | — | `none` | Active/CAC dropout/Left programme vocabulary; no automatic dropout classification. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
enrolments_centre_id_fkey: FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT
enrolments_check: CHECK ((ends_before > starts_on))
enrolments_check1: CHECK (((status_code = 'Active'::text) OR (ends_before IS NOT NULL)))
enrolments_child_id_centre_id_shift_code_starts_on_key: UNIQUE (child_id, centre_id, shift_code, starts_on)
enrolments_child_id_fkey: FOREIGN KEY (child_id) REFERENCES mass_core.children(id) ON DELETE RESTRICT
enrolments_grade_label_check: CHECK ((grade_label = ANY (ARRAY['1'::text, '2'::text, '3'::text, '4'::text, '5'::text, '6'::text, '7'::text, '8'::text, '9'::text, '10'::text])))
enrolments_id_child_id_centre_id_shift_code_key: UNIQUE (id, child_id, centre_id, shift_code)
enrolments_pkey: PRIMARY KEY (id)
enrolments_shift_code_check: CHECK ((shift_code = ANY (ARRAY['Morning'::text, 'Evening'::text])))
enrolments_status_code_check: CHECK ((status_code = ANY (ARRAY['Active'::text, 'CAC dropout'::text, 'Left programme'::text])))
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.morarji_outcomes

Nullable applied/attended/passed and supplied school text only; no additional outcomes inferred.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `membership_id` | `uuid` | no | FK, UK | `none` | Verified cohort membership FK. |
| `centre_id` | `uuid` | no | FK | `none` | Verified centre scope; not inferred residence. |
| `applied` | `boolean` | yes | — | `none` | Nullable supplied indicator; NULL remains unknown. |
| `attended` | `boolean` | yes | — | `none` | Nullable supplied indicator; training/exam context is not inferred. |
| `passed` | `boolean` | yes | — | `none` | Nullable supplied indicator; no extra outcome/status inferred. |
| `school_name` | `text` | yes | — | `none` | Supplied school observation only; not inferred admission or award. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
morarji_outcomes_membership_id_centre_id_fkey: FOREIGN KEY (membership_id, centre_id) REFERENCES mass_core.cohort_memberships(id, centre_id) ON DELETE RESTRICT
morarji_outcomes_membership_id_key: UNIQUE (membership_id)
morarji_outcomes_pkey: PRIMARY KEY (id)
morarji_outcomes_school_name_check: CHECK ((length(school_name) <= 160))
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.private_child_profiles

Minimal restricted name, controlled gender and nullable Class-10 result projection; no household/contact data.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `child_id` | `uuid` | no | FK, UK | `none` | Registered child reference; never a name-derived identity. |
| `full_name` | `text` | no | — | `none` | Minimal private display identity, not an automatic identity key. |
| `gender_code` | `text` | yes | — | `none` | Girl/Boy/unknown; no invented controlled options. |
| `class10_board_passed` | `boolean` | yes | — | `none` | Private Yes/No/unknown projection; live correction/year/history contract still pending. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
private_child_profiles_child_id_fkey: FOREIGN KEY (child_id) REFERENCES mass_core.children(id) ON DELETE RESTRICT
private_child_profiles_child_id_key: UNIQUE (child_id)
private_child_profiles_full_name_check: CHECK (((length(btrim(full_name)) >= 1) AND (length(btrim(full_name)) <= 160)))
private_child_profiles_gender_code_check: CHECK ((gender_code = ANY (ARRAY['Girl'::text, 'Boy'::text])))
private_child_profiles_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.programme_cohorts

Explicit Morarji cohort reference in the current scope; no inferred year or other programme activation.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `label` | `text` | no | — | `none` | Explicit supplied non-personal reference label; no automatic fuzzy identity. |
| `academic_year_id` | `uuid` | yes | FK | `none` | Explicit academic-year FK; unknown historical years are not inferred. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
programme_cohorts_academic_year_id_fkey: FOREIGN KEY (academic_year_id) REFERENCES mass_core.academic_years(id) ON DELETE RESTRICT
programme_cohorts_label_check: CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120)))
programme_cohorts_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_core.user_scope_grants

Verified, server-controlled, time-bounded per-centre business role/private-profile grant; no real grants seeded.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `user_id` | `uuid` | no | composite UK, FK | `none` | Verified managed Auth principal; role labels alone never establish this link. |
| `centre_id` | `uuid` | no | FK, composite UK | `none` | Verified centre scope; not inferred residence. |
| `role_code` | `text` | no | composite UK | `none` | Leadership/Teacher/Cluster Officer; server-controlled grant only. |
| `starts_at` | `timestamp with time zone` | no | composite UK | `none` | Explicit grant validity start. |
| `ends_at` | `timestamp with time zone` | yes | — | `none` | Optional exclusive grant end; no null/global centre scope. |
| `verified_by` | `uuid` | no | FK | `none` | Authorized verifier Auth principal reference; no actual person inferred. |
| `verified_at` | `timestamp with time zone` | no | — | `none` | Explicit verification timestamp; actual evidence/authority required before real use. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |
| `can_read_profiles` | `boolean` | no | — | `false` | Explicit additional profile-read capability; Leadership still cannot read profiles. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
user_scope_grants_centre_id_fkey: FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT
user_scope_grants_check: CHECK ((ends_at > starts_at))
user_scope_grants_pkey: PRIMARY KEY (id)
user_scope_grants_role_code_check: CHECK ((role_code = ANY (ARRAY['Leadership'::text, 'Teacher'::text, 'Cluster Officer'::text])))
user_scope_grants_user_id_centre_id_role_code_starts_at_key: UNIQUE (user_id, centre_id, role_code, starts_at)
user_scope_grants_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT
user_scope_grants_verified_by_fkey: FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE RESTRICT
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_foundation.audit_events

Append-only minimized operation/revision history; core Auth subject is optional and separately attributed.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `actor_database_principal` | `name` | no | — | `none` | Actual database login/session principal. |
| `actor_database_role` | `name` | no | — | `none` | Actual active database role. |
| `entity_type` | `text` | no | — | `none` | Allowlisted durable audit target type. |
| `entity_id` | `uuid` | no | — | `none` | Durable audit UUID locator; intentionally not a polymorphic business FK. |
| `operation` | `text` | no | — | `none` | INSERT/UPDATE only in current audit scope. |
| `changed_at` | `timestamp with time zone` | no | — | `clock_timestamp()` | Actual operation time. |
| `change_metadata` | `jsonb` | no | — | `none` | Revision-only JSON object; no personal values, free-text notes or before/after dump. |
| `batch_id` | `uuid` | yes | FK | `none` | Technical batch association; optional for non-import audit events. |
| `actor_user_id` | `uuid` | yes | FK | `none` | Optional trusted core request Auth UID; no fabricated historical actor. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
audit_events_actor_user_id_fkey: FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT
audit_events_batch_id_fkey: FOREIGN KEY (batch_id) REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT
audit_events_change_metadata_check: CHECK (((jsonb_typeof(change_metadata) = 'object'::text) AND (change_metadata ? 'revision'::text) AND ((change_metadata - 'revision'::text) = '{}'::jsonb) AND (jsonb_typeof((change_metadata -> 'revision'::text)) = 'number'::text) AND ((change_metadata ->> 'revision'::text) ~ '^[1-9][0-9]*$'::text)))
audit_events_entity_type_check: CHECK ((entity_type = ANY (ARRAY['source_files'::text, 'source_sheets'::text, 'import_batches'::text, 'source_rows'::text, 'import_exceptions'::text, 'core.centres'::text, 'core.user_scope_grants'::text, 'core.children'::text, 'core.private_child_profiles'::text, 'core.enrolments'::text, 'core.academic_years'::text, 'core.assessment_periods'::text, 'core.cac_sessions'::text, 'core.attendance_records'::text, 'core.assessment_definitions'::text, 'core.assessment_results'::text, 'core.activity_events'::text, 'core.activity_participation'::text, 'core.programme_cohorts'::text, 'core.cohort_memberships'::text, 'core.morarji_outcomes'::text])))
audit_events_operation_check: CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text])))
audit_events_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_foundation.import_batches

Technical execution state, progress, counts and optimistic revision; not a business-data approval.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `mapping_version` | `text` | no | — | `none` | Reviewed mapping token. |
| `extractor_version` | `text` | no | — | `none` | Extractor implementation token. |
| `state` | `text` | no | — | `'staged'::text` | Technical execution state; see exact transition trigger in migration 3. |
| `created_at` | `timestamp with time zone` | no | — | `clock_timestamp()` | Actual server creation time. |
| `started_at` | `timestamp with time zone` | yes | — | `none` | Server time when run enters running; NULL until then. |
| `completed_at` | `timestamp with time zone` | yes | — | `none` | Server terminal-state time. |
| `checkpoint_position` | `bigint` | yes | — | `none` | Nonnegative monotonic numeric checkpoint, not arbitrary personal JSON. |
| `extracted_count` | `bigint` | no | — | `0` | Extracted source-occurrence count. |
| `accepted_count` | `bigint` | no | — | `0` | Accepted occurrence category, not a unique-child count or import permission. |
| `quarantined_count` | `bigint` | no | — | `0` | Held occurrence category. |
| `excluded_count` | `bigint` | no | — | `0` | Excluded occurrence category; issue flags may overlap and are separate. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
import_batches_accepted_count_check: CHECK ((accepted_count >= 0))
import_batches_check: CHECK ((((accepted_count + quarantined_count) + excluded_count) <= extracted_count))
import_batches_check1: CHECK (((state <> 'complete'::text) OR (((accepted_count + quarantined_count) + excluded_count) = extracted_count)))
import_batches_checkpoint_position_check: CHECK ((checkpoint_position >= 0))
import_batches_excluded_count_check: CHECK ((excluded_count >= 0))
import_batches_extracted_count_check: CHECK ((extracted_count >= 0))
import_batches_extractor_version_check: CHECK ((extractor_version ~ '^[A-Za-z0-9_.-]{1,64}$'::text))
import_batches_mapping_version_check: CHECK ((mapping_version ~ '^[A-Za-z0-9_.-]{1,64}$'::text))
import_batches_pkey: PRIMARY KEY (id)
import_batches_quarantined_count_check: CHECK ((quarantined_count >= 0))
import_batches_row_version_check: CHECK ((row_version > 0))
import_batches_state_check: CHECK ((state = ANY (ARRAY['staged'::text, 'validated'::text, 'approved'::text, 'running'::text, 'complete'::text, 'failed'::text])))
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_foundation.import_exceptions

Restricted, allowlisted issue/review metadata; no copied invalid values or free-text personal detail.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `batch_id` | `uuid` | no | FK, composite UK | `none` | Technical batch association; optional for non-import audit events. |
| `source_row_id` | `uuid` | no | composite UK, FK | `none` | Frozen row occurrence FK, not raw record contents. |
| `field_ordinal` | `integer` | yes | composite UK | `none` | Optional positive physical field ordinal; NULL-aware issue uniqueness applies. |
| `reason_code` | `text` | no | composite UK | `none` | Allowlisted non-personal issue category. |
| `review_state` | `text` | no | — | `'open'::text` | Technical open/resolved/rejected state; terminal closure is guarded. |
| `resolution_code` | `text` | yes | — | `none` | Allowlisted resolution category; no free-text rationale. |
| `resolved_by` | `name` | yes | — | `none` | Actual database principal (PostgreSQL name), not an asserted Auth user. |
| `resolved_at` | `timestamp with time zone` | yes | — | `none` | Actual server review time. |
| `row_version` | `bigint` | no | — | `1` | Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
import_exceptions_batch_id_fkey: FOREIGN KEY (batch_id) REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT
import_exceptions_batch_id_source_row_id_field_ordinal_reas_key: UNIQUE NULLS NOT DISTINCT (batch_id, source_row_id, field_ordinal, reason_code)
import_exceptions_check: CHECK ((((review_state = 'open'::text) AND (resolution_code IS NULL) AND (resolved_by IS NULL) AND (resolved_at IS NULL)) OR ((review_state <> 'open'::text) AND (resolution_code IS NOT NULL) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL))))
import_exceptions_field_ordinal_check: CHECK ((field_ordinal > 0))
import_exceptions_pkey: PRIMARY KEY (id)
import_exceptions_reason_code_check: CHECK ((reason_code = ANY (ARRAY['missing_reference'::text, 'invalid_format'::text, 'conflicting_metadata'::text, 'duplicate_occurrence'::text, 'unverified_record'::text])))
import_exceptions_resolution_code_check: CHECK ((resolution_code = ANY (ARRAY['verified_correction'::text, 'excluded'::text, 'not_an_issue'::text])))
import_exceptions_review_state_check: CHECK ((review_state = ANY (ARRAY['open'::text, 'resolved'::text, 'rejected'::text])))
import_exceptions_row_version_check: CHECK ((row_version > 0))
import_exceptions_source_row_id_fkey: FOREIGN KEY (source_row_id) REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_foundation.source_files

Immutable source snapshot fingerprint and opaque artifact reference; no filename or source contents.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `original_file_id` | `text` | yes | — | `none` | Known opaque original identifier only; no invented Drive ID. |
| `sha256` | `text` | no | UK | `none` | Private immutable file fingerprint, not an identity key. |
| `storage_ref` | `uuid` | no | UK | `none` | Opaque artifact UUID; no public/signed URL or embedded credential. |
| `source_version` | `text` | yes | — | `none` | Known technical source version token. |
| `exported_at` | `timestamp with time zone` | yes | — | `none` | Known source export time only. |
| `received_at` | `timestamp with time zone` | no | — | `clock_timestamp()` | Actual server receipt time, not a fabricated source event. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
source_files_original_file_id_check: CHECK ((original_file_id ~ '^[A-Za-z0-9_-]{1,128}$'::text))
source_files_pkey: PRIMARY KEY (id)
source_files_sha256_check: CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))
source_files_sha256_key: UNIQUE (sha256)
source_files_source_version_check: CHECK ((source_version ~ '^[A-Za-z0-9_.-]{1,64}$'::text))
source_files_storage_ref_key: UNIQUE (storage_ref)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_foundation.source_rows

Immutable physical row occurrence and private fingerprint; not a person identity or raw payload.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `sheet_id` | `uuid` | no | FK, composite UK | `none` | Immutable source sheet occurrence FK. |
| `first_batch_id` | `uuid` | no | FK | `none` | First extraction context, not rewritten on retries. |
| `row_number` | `integer` | no | composite UK | `none` | Positive physical row number in frozen source sheet. |
| `content_hash` | `text` | no | — | `none` | Private row fingerprint; equal hashes do not merge people/occurrences. |
| `classification` | `text` | no | — | `'candidate'::text` | Technical source classification from the exact CHECK below. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
source_rows_classification_check: CHECK ((classification = ANY (ARRAY['candidate'::text, 'example'::text, 'scaffold'::text, 'summary'::text, 'rejected'::text])))
source_rows_content_hash_check: CHECK ((content_hash ~ '^[0-9a-f]{64}$'::text))
source_rows_first_batch_id_fkey: FOREIGN KEY (first_batch_id) REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT
source_rows_pkey: PRIMARY KEY (id)
source_rows_row_number_check: CHECK ((row_number > 0))
source_rows_sheet_id_fkey: FOREIGN KEY (sheet_id) REFERENCES mass_foundation.source_sheets(id) ON DELETE RESTRICT
source_rows_sheet_id_row_number_key: UNIQUE (sheet_id, row_number)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## mass_foundation.source_sheets

Immutable sheet occurrence/ordinal and versioned header reference; no raw header JSON or sheet display name.

| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | PK | `gen_random_uuid()` | Stable technical UUID. |
| `file_id` | `uuid` | no | FK, composite UK | `none` | Immutable source snapshot FK. |
| `native_sheet_id` | `text` | yes | composite UK | `none` | Known native sheet token, not automatically a Google ID. |
| `ordinal` | `integer` | no | composite UK | `none` | Positive physical sheet ordinal. |
| `classification` | `text` | no | — | `'unclassified'::text` | Technical source classification from the exact CHECK below. |
| `header_version` | `integer` | no | — | `none` | Positive mapping/header definition version; no raw content. |

Exact final constraints (including composite FK columns/actions and CHECKs):

```sql
source_sheets_classification_check: CHECK ((classification = ANY (ARRAY['unclassified'::text, 'input'::text, 'master'::text, 'helper'::text, 'report'::text, 'template'::text])))
source_sheets_file_id_fkey: FOREIGN KEY (file_id) REFERENCES mass_foundation.source_files(id) ON DELETE RESTRICT
source_sheets_file_id_native_sheet_id_key: UNIQUE (file_id, native_sheet_id)
source_sheets_file_id_ordinal_key: UNIQUE (file_id, ordinal)
source_sheets_header_version_check: CHECK ((header_version > 0))
source_sheets_native_sheet_id_check: CHECK ((native_sheet_id ~ '^[A-Za-z0-9_-]{1,64}$'::text))
source_sheets_ordinal_check: CHECK ((ordinal > 0))
source_sheets_pkey: PRIMARY KEY (id)
```

RLS enabled: **True**; forced: **True**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md).

## Important implementation boundaries

Current-process scalar corrections retain attributable revision metadata, not a recoverable business-value archive. Profile corrections, general clears/deletes, bulk/offline workflows, historical provenance promotion, friendly-ID aliases and deferred modules require follow-up contracts. Exit-date mapping, calendar authority/H, Q/F aliases, assessment precision and historical ambiguities remain unresolved to their recorded extent. See [Phase 3C deployment gates](PHASE-3C-DEPLOYMENT-READINESS.md). No personal record, retention duration, real grant or historical source correction is approved by this catalog.
