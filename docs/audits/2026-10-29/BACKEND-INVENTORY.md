# Actual backend inventory (read-only catalogue)

These are observed hosted definitions, not proposed migrations. No identifiers for real children or staff accounts are included. Runtime authorization remains RLS and approved scoped RPCs; schema visibility is not permission to expose private records. For individual frontend contracts use the workbook.

## `mass_core.academic_years`

RLS enabled: True; FORCE RLS: True. Policies: 5.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`starts_on`|`date`|False|`` / |
|`ends_before`|`date`|True|`((starts_on + '1 year'::interval))::date` / s|
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `academic_years_pkey`: `PRIMARY KEY (id)`
- `academic_years_starts_on_check`: `CHECK (((EXTRACT(month FROM starts_on) = (4)::numeric) AND (EXTRACT(day FROM starts_on) = (1)::numeric)))`
- `academic_years_starts_on_key`: `UNIQUE (starts_on)`

Policy definitions:

- `admin_access` (*; mass_core_admin): USING `true`; CHECK `true`.
- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `(mass_core.request_user_id() IS NOT NULL)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.academic_years FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.academic_years FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.academic_years FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.activity_events`

RLS enabled: True; FORCE RLS: True. Policies: 4.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`centre_id`|`uuid`|False|`` / |
|`shift_code`|`text`|False|`` / |
|`activity_date`|`date`|False|`` / |
|`name`|`text`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `activity_events_centre_id_fkey`: `FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT`
- `activity_events_id_centre_id_shift_code_key`: `UNIQUE (id, centre_id, shift_code)`
- `activity_events_name_check`: `CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 160)))`
- `activity_events_pkey`: `PRIMARY KEY (id)`
- `activity_events_shift_code_check`: `CHECK ((shift_code = ANY (ARRAY['Morning'::text, 'Evening'::text])))`

Policy definitions:

- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.activity_events FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.activity_events FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.activity_events FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.activity_participation`

RLS enabled: True; FORCE RLS: True. Policies: 4.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`event_id`|`uuid`|False|`` / |
|`child_id`|`uuid`|False|`` / |
|`centre_id`|`uuid`|False|`` / |
|`shift_code`|`text`|False|`` / |
|`enrolment_id`|`uuid`|False|`` / |
|`participated`|`boolean`|True|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `activity_participation_enrolment_id_child_id_centre_id_shi_fkey`: `FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT`
- `activity_participation_event_id_centre_id_shift_code_fkey`: `FOREIGN KEY (event_id, centre_id, shift_code) REFERENCES mass_core.activity_events(id, centre_id, shift_code) ON DELETE RESTRICT`
- `activity_participation_event_id_child_id_key`: `UNIQUE (event_id, child_id)`
- `activity_participation_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.activity_participation FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.activity_participation FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.activity_participation FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.assessment_definitions`

RLS enabled: True; FORCE RLS: True. Policies: 5.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`period_id`|`uuid`|False|`` / |
|`max_score`|`numeric`|False|`25` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `assessment_definitions_max_score_check`: `CHECK ((max_score = (25)::numeric))`
- `assessment_definitions_period_id_fkey`: `FOREIGN KEY (period_id) REFERENCES mass_core.assessment_periods(id) ON DELETE RESTRICT`
- `assessment_definitions_period_id_key`: `UNIQUE (period_id)`
- `assessment_definitions_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `admin_access` (*; mass_core_admin): USING `true`; CHECK `true`.
- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `(mass_core.request_user_id() IS NOT NULL)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.assessment_definitions FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.assessment_definitions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.assessment_definitions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.assessment_periods`

RLS enabled: True; FORCE RLS: True. Policies: 5.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`academic_year_id`|`uuid`|False|`` / |
|`quarter`|`smallint`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `assessment_periods_academic_year_id_fkey`: `FOREIGN KEY (academic_year_id) REFERENCES mass_core.academic_years(id) ON DELETE RESTRICT`
- `assessment_periods_academic_year_id_quarter_key`: `UNIQUE (academic_year_id, quarter)`
- `assessment_periods_pkey`: `PRIMARY KEY (id)`
- `assessment_periods_quarter_check`: `CHECK (((quarter >= 1) AND (quarter <= 4)))`

Policy definitions:

- `admin_access` (*; mass_core_admin): USING `true`; CHECK `true`.
- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `(mass_core.request_user_id() IS NOT NULL)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.assessment_periods FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.assessment_periods FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.assessment_periods FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.assessment_results`

RLS enabled: True; FORCE RLS: True. Policies: 6.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`child_id`|`uuid`|False|`` / |
|`centre_id`|`uuid`|False|`` / |
|`shift_code`|`text`|False|`` / |
|`enrolment_id`|`uuid`|False|`` / |
|`definition_id`|`uuid`|False|`` / |
|`assessed_on`|`date`|True|`` / |
|`score`|`numeric`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `assessment_results_child_id_definition_id_key`: `UNIQUE (child_id, definition_id)`
- `assessment_results_definition_id_fkey`: `FOREIGN KEY (definition_id) REFERENCES mass_core.assessment_definitions(id) ON DELETE RESTRICT`
- `assessment_results_enrolment_id_child_id_centre_id_shift_c_fkey`: `FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT`
- `assessment_results_pkey`: `PRIMARY KEY (id)`
- `assessment_results_score_check`: `CHECK (((score >= (0)::numeric) AND (score <= (25)::numeric)))`

Policy definitions:

- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.assessment_results FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.assessment_results FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.assessment_results FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.attendance_codes`

RLS enabled: True; FORCE RLS: True. Policies: 2.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`code`|`text`|False|`` / |
|`meaning`|`text`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `attendance_codes_code_check`: `CHECK ((code = ANY (ARRAY['P'::text, 'A'::text, 'L'::text, 'WO'::text, 'MM'::text])))`
- `attendance_codes_pkey`: `PRIMARY KEY (code)`

Policy definitions:

- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `(mass_core.request_user_id() IS NOT NULL)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.attendance_codes FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.attendance_codes FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.attendance_records`

RLS enabled: True; FORCE RLS: True. Policies: 6.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`child_id`|`uuid`|False|`` / |
|`centre_id`|`uuid`|False|`` / |
|`shift_code`|`text`|False|`` / |
|`enrolment_id`|`uuid`|False|`` / |
|`attendance_date`|`date`|False|`` / |
|`code`|`text`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `attendance_records_child_id_centre_id_shift_code_attendance_key`: `UNIQUE (child_id, centre_id, shift_code, attendance_date)`
- `attendance_records_code_fkey`: `FOREIGN KEY (code) REFERENCES mass_core.attendance_codes(code) ON DELETE RESTRICT`
- `attendance_records_enrolment_id_child_id_centre_id_shift_c_fkey`: `FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT`
- `attendance_records_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.attendance_records FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.attendance_records FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.attendance_records FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.cac_sessions`

RLS enabled: True; FORCE RLS: True. Policies: 5.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`centre_id`|`uuid`|False|`` / |
|`shift_code`|`text`|False|`` / |
|`session_date`|`date`|False|`` / |
|`is_scheduled`|`boolean`|False|`` / |
|`confirmation_ref`|`uuid`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `cac_sessions_centre_id_fkey`: `FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT`
- `cac_sessions_centre_id_shift_code_session_date_key`: `UNIQUE (centre_id, shift_code, session_date)`
- `cac_sessions_pkey`: `PRIMARY KEY (id)`
- `cac_sessions_shift_code_check`: `CHECK ((shift_code = ANY (ARRAY['Morning'::text, 'Evening'::text])))`

Policy definitions:

- `admin_access` (*; mass_core_admin): USING `true`; CHECK `true`.
- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.cac_sessions FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.cac_sessions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.cac_sessions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.centre_staff_assignments`

RLS enabled: True; FORCE RLS: True. Policies: 2.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`centre_id`|`uuid`|False|`` / |
|`staff_member_id`|`uuid`|False|`` / |
|`role_code`|`text`|False|`` / |
|`shift_code`|`text`|True|`` / |
|`source_row_id`|`uuid`|False|`` / |
|`source_slot`|`integer`|False|`` / |

Constraints:

- `centre_staff_assignments_centre_id_fkey`: `FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT`
- `centre_staff_assignments_centre_id_staff_member_id_role_cod_key`: `UNIQUE NULLS NOT DISTINCT (centre_id, staff_member_id, role_code, shift_code)`
- `centre_staff_assignments_pkey`: `PRIMARY KEY (id)`
- `centre_staff_assignments_role_code_check`: `CHECK ((role_code = ANY (ARRAY['Teacher'::text, 'Cluster Officer'::text])))`
- `centre_staff_assignments_shift_code_check`: `CHECK ((shift_code = ANY (ARRAY['Morning'::text, 'Evening'::text])))`
- `centre_staff_assignments_source_row_id_fkey`: `FOREIGN KEY (source_row_id) REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT`
- `centre_staff_assignments_source_row_id_source_slot_role_cod_key`: `UNIQUE NULLS NOT DISTINCT (source_row_id, source_slot, role_code, shift_code)`
- `centre_staff_assignments_source_slot_check`: `CHECK ((source_slot > 0))`
- `centre_staff_assignments_staff_member_id_fkey`: `FOREIGN KEY (staff_member_id) REFERENCES mass_core.staff_members(id) ON DELETE RESTRICT`

Policy definitions:

- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER directory_immutable BEFORE DELETE OR UPDATE ON mass_core.centre_staff_assignments FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable()`
- `CREATE TRIGGER directory_no_truncate BEFORE TRUNCATE ON mass_core.centre_staff_assignments FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable()`

## `mass_core.centres`

RLS enabled: True; FORCE RLS: True. Policies: 4.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`label`|`text`|False|`` / |
|`row_version`|`bigint`|False|`1` / |
|`donor_id`|`uuid`|True|`` / |
|`donor_source_row_id`|`uuid`|True|`` / |

Constraints:

- `centre_donor_provenance`: `CHECK (((donor_id IS NULL) = (donor_source_row_id IS NULL)))`
- `centres_donor_id_fkey`: `FOREIGN KEY (donor_id) REFERENCES mass_core.donors(id) ON DELETE RESTRICT`
- `centres_donor_source_row_id_fkey`: `FOREIGN KEY (donor_source_row_id) REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT`
- `centres_label_check`: `CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120)))`
- `centres_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `admin_access` (*; mass_core_admin): USING `true`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.centres FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.centres FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.centres FOR EACH ROW EXECUTE FUNCTION mass_core.guard_centre_directory()`

## `mass_core.children`

RLS enabled: True; FORCE RLS: True. Policies: 4.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`student_id`|`text`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `children_pkey`: `PRIMARY KEY (id)`
- `children_student_id_key`: `UNIQUE (student_id)`

Policy definitions:

- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read_child(id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.children FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.children FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.children FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.cohort_memberships`

RLS enabled: True; FORCE RLS: True. Policies: 6.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`cohort_id`|`uuid`|False|`` / |
|`child_id`|`uuid`|False|`` / |
|`centre_id`|`uuid`|False|`` / |
|`shift_code`|`text`|False|`` / |
|`enrolment_id`|`uuid`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `cohort_memberships_cohort_id_child_id_key`: `UNIQUE (cohort_id, child_id)`
- `cohort_memberships_cohort_id_fkey`: `FOREIGN KEY (cohort_id) REFERENCES mass_core.programme_cohorts(id) ON DELETE RESTRICT`
- `cohort_memberships_enrolment_id_child_id_centre_id_shift_c_fkey`: `FOREIGN KEY (enrolment_id, child_id, centre_id, shift_code) REFERENCES mass_core.enrolments(id, child_id, centre_id, shift_code) ON DELETE RESTRICT`
- `cohort_memberships_id_centre_id_key`: `UNIQUE (id, centre_id)`
- `cohort_memberships_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.cohort_memberships FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.cohort_memberships FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.cohort_memberships FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.donors`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`label`|`text`|False|`` / |
|`source_label`|`text`|False|`` / |
|`source_row_id`|`uuid`|False|`` / |
|`source_slot`|`integer`|False|`` / |

Constraints:

- `donors_label_check`: `CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 160)))`
- `donors_pkey`: `PRIMARY KEY (id)`
- `donors_source_label_check`: `CHECK (((length(btrim(source_label)) >= 1) AND (length(btrim(source_label)) <= 200)))`
- `donors_source_row_id_fkey`: `FOREIGN KEY (source_row_id) REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT`
- `donors_source_row_id_source_slot_key`: `UNIQUE (source_row_id, source_slot)`
- `donors_source_slot_check`: `CHECK ((source_slot > 0))`

Policy definitions:

- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `(EXISTS ( SELECT 1
   FROM mass_core.centres c
  WHERE ((c.donor_id = donors.id) AND mass_core.can_read(c.id))))`; CHECK `None`.

Triggers:

- `CREATE TRIGGER directory_immutable BEFORE DELETE OR UPDATE ON mass_core.donors FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable()`
- `CREATE TRIGGER directory_no_truncate BEFORE TRUNCATE ON mass_core.donors FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable()`

## `mass_core.enrolments`

RLS enabled: True; FORCE RLS: True. Policies: 6.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`child_id`|`uuid`|False|`` / |
|`centre_id`|`uuid`|False|`` / |
|`grade_label`|`text`|False|`` / |
|`shift_code`|`text`|False|`` / |
|`starts_on`|`date`|False|`` / |
|`ends_before`|`date`|True|`` / |
|`status_code`|`text`|False|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `enrolments_centre_id_fkey`: `FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT`
- `enrolments_check`: `CHECK ((ends_before > starts_on))`
- `enrolments_check1`: `CHECK (((status_code = 'Active'::text) OR (ends_before IS NOT NULL)))`
- `enrolments_child_id_centre_id_shift_code_starts_on_key`: `UNIQUE (child_id, centre_id, shift_code, starts_on)`
- `enrolments_child_id_fkey`: `FOREIGN KEY (child_id) REFERENCES mass_core.children(id) ON DELETE RESTRICT`
- `enrolments_grade_label_check`: `CHECK ((grade_label = ANY (ARRAY['1'::text, '2'::text, '3'::text, '4'::text, '5'::text, '6'::text, '7'::text, '8'::text, '9'::text, '10'::text])))`
- `enrolments_id_child_id_centre_id_shift_code_key`: `UNIQUE (id, child_id, centre_id, shift_code)`
- `enrolments_pkey`: `PRIMARY KEY (id)`
- `enrolments_shift_code_check`: `CHECK ((shift_code = ANY (ARRAY['Morning'::text, 'Evening'::text])))`
- `enrolments_status_code_check`: `CHECK ((status_code = ANY (ARRAY['Active'::text, 'CAC dropout'::text, 'Left programme'::text])))`

Policy definitions:

- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.enrolments FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.enrolments FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.enrolments FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.morarji_outcomes`

RLS enabled: True; FORCE RLS: True. Policies: 6.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`membership_id`|`uuid`|False|`` / |
|`centre_id`|`uuid`|False|`` / |
|`applied`|`boolean`|True|`` / |
|`attended`|`boolean`|True|`` / |
|`passed`|`boolean`|True|`` / |
|`school_name`|`text`|True|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `morarji_outcomes_membership_id_centre_id_fkey`: `FOREIGN KEY (membership_id, centre_id) REFERENCES mass_core.cohort_memberships(id, centre_id) ON DELETE RESTRICT`
- `morarji_outcomes_membership_id_key`: `UNIQUE (membership_id)`
- `morarji_outcomes_pkey`: `PRIMARY KEY (id)`
- `morarji_outcomes_school_name_check`: `CHECK ((length(school_name) <= 160))`

Policy definitions:

- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_insert` (a; mass_core_owner): USING `None`; CHECK `mass_core.can_write(centre_id)`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.
- `owner_update` (w; mass_core_owner): USING `mass_core.can_write(centre_id)`; CHECK `mass_core.can_write(centre_id)`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read(centre_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.morarji_outcomes FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.morarji_outcomes FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.morarji_outcomes FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.private_child_profiles`

RLS enabled: True; FORCE RLS: True. Policies: 4.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`child_id`|`uuid`|False|`` / |
|`full_name`|`text`|False|`` / |
|`gender_code`|`text`|True|`` / |
|`class10_board_passed`|`boolean`|True|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `private_child_profiles_child_id_fkey`: `FOREIGN KEY (child_id) REFERENCES mass_core.children(id) ON DELETE RESTRICT`
- `private_child_profiles_child_id_key`: `UNIQUE (child_id)`
- `private_child_profiles_full_name_check`: `CHECK (((length(btrim(full_name)) >= 1) AND (length(btrim(full_name)) <= 160)))`
- `private_child_profiles_gender_code_check`: `CHECK ((gender_code = ANY (ARRAY['Girl'::text, 'Boy'::text])))`
- `private_child_profiles_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `mass_core.can_read_profile(child_id)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.private_child_profiles FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.private_child_profiles FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.private_child_profiles FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.programme_cohorts`

RLS enabled: True; FORCE RLS: True. Policies: 5.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`label`|`text`|False|`` / |
|`academic_year_id`|`uuid`|True|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `programme_cohorts_academic_year_id_fkey`: `FOREIGN KEY (academic_year_id) REFERENCES mass_core.academic_years(id) ON DELETE RESTRICT`
- `programme_cohorts_label_check`: `CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120)))`
- `programme_cohorts_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `admin_access` (*; mass_core_admin): USING `true`; CHECK `true`.
- `admin_import_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `admin_import_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `(mass_core.request_user_id() IS NOT NULL)`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.programme_cohorts FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.programme_cohorts FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.programme_cohorts FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_core.staff_members`

RLS enabled: True; FORCE RLS: True. Policies: 2.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`display_name`|`text`|False|`` / |
|`source_name`|`text`|False|`` / |
|`source_row_id`|`uuid`|False|`` / |
|`source_slot`|`integer`|False|`` / |

Constraints:

- `staff_members_display_name_check`: `CHECK (((length(btrim(display_name)) >= 1) AND (length(btrim(display_name)) <= 160)))`
- `staff_members_pkey`: `PRIMARY KEY (id)`
- `staff_members_source_name_check`: `CHECK (((length(btrim(source_name)) >= 1) AND (length(btrim(source_name)) <= 200)))`
- `staff_members_source_row_id_fkey`: `FOREIGN KEY (source_row_id) REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT`
- `staff_members_source_row_id_source_slot_key`: `UNIQUE (source_row_id, source_slot)`
- `staff_members_source_slot_check`: `CHECK ((source_slot > 0))`

Policy definitions:

- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `scoped_read` (r; authenticated): USING `(EXISTS ( SELECT 1
   FROM mass_core.centre_staff_assignments a
  WHERE ((a.staff_member_id = staff_members.id) AND mass_core.can_read(a.centre_id))))`; CHECK `None`.

Triggers:

- `CREATE TRIGGER directory_immutable BEFORE DELETE OR UPDATE ON mass_core.staff_members FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable()`
- `CREATE TRIGGER directory_no_truncate BEFORE TRUNCATE ON mass_core.staff_members FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable()`

## `mass_core.user_scope_grants`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`user_id`|`uuid`|False|`` / |
|`centre_id`|`uuid`|False|`` / |
|`role_code`|`text`|False|`` / |
|`starts_at`|`timestamp with time zone`|False|`` / |
|`ends_at`|`timestamp with time zone`|True|`` / |
|`verified_by`|`uuid`|False|`` / |
|`verified_at`|`timestamp with time zone`|False|`` / |
|`row_version`|`bigint`|False|`1` / |
|`can_read_profiles`|`boolean`|False|`false` / |

Constraints:

- `user_scope_grants_centre_id_fkey`: `FOREIGN KEY (centre_id) REFERENCES mass_core.centres(id) ON DELETE RESTRICT`
- `user_scope_grants_check`: `CHECK ((ends_at > starts_at))`
- `user_scope_grants_pkey`: `PRIMARY KEY (id)`
- `user_scope_grants_role_code_check`: `CHECK ((role_code = ANY (ARRAY['Leadership'::text, 'Teacher'::text, 'Cluster Officer'::text])))`
- `user_scope_grants_user_id_centre_id_role_code_starts_at_key`: `UNIQUE (user_id, centre_id, role_code, starts_at)`
- `user_scope_grants_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `user_scope_grants_verified_by_fkey`: `FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE RESTRICT`

Policy definitions:

- `admin_access` (*; mass_core_admin): USING `true`; CHECK `true`.
- `owner_access` (*; mass_core_owner): USING `true`; CHECK `true`.
- `self_scope_discovery` (r; authenticated): USING `((CURRENT_USER = 'authenticated'::name) AND (user_id = mass_core.request_user_id()) AND (starts_at <= statement_timestamp()) AND ((ends_at IS NULL) OR (statement_timestamp() < ends_at)))`; CHECK `None`.

Triggers:

- `CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.user_scope_grants FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit()`
- `CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.user_scope_grants FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record()`
- `CREATE TRIGGER guard_write BEFORE INSERT OR DELETE OR UPDATE ON mass_core.user_scope_grants FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record()`

## `mass_foundation.audit_events`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`actor_database_principal`|`name`|False|`` / |
|`actor_database_role`|`name`|False|`` / |
|`entity_type`|`text`|False|`` / |
|`entity_id`|`uuid`|False|`` / |
|`operation`|`text`|False|`` / |
|`changed_at`|`timestamp with time zone`|False|`clock_timestamp()` / |
|`change_metadata`|`jsonb`|False|`` / |
|`batch_id`|`uuid`|True|`` / |
|`actor_user_id`|`uuid`|True|`` / |

Constraints:

- `audit_events_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `audit_events_batch_id_fkey`: `FOREIGN KEY (batch_id) REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT`
- `audit_events_change_metadata_check`: `CHECK (((jsonb_typeof(change_metadata) = 'object'::text) AND (change_metadata ? 'revision'::text) AND ((change_metadata - 'revision'::text) = '{}'::jsonb) AND (jsonb_typeof((change_metadata -> 'revision'::text)) = 'number'::text) AND ((change_metadata ->> 'revision'::text) ~ '^[1-9][0-9]*$'::text)))`
- `audit_events_entity_type_check`: `CHECK ((entity_type = ANY (ARRAY['source_files'::text, 'source_sheets'::text, 'import_batches'::text, 'source_rows'::text, 'import_exceptions'::text, 'core.centres'::text, 'core.user_scope_grants'::text, 'core.children'::text, 'core.private_child_profiles'::text, 'core.enrolments'::text, 'core.academic_years'::text, 'core.assessment_periods'::text, 'core.cac_sessions'::text, 'core.attendance_records'::text, 'core.assessment_definitions'::text, 'core.assessment_results'::text, 'core.activity_events'::text, 'core.activity_participation'::text, 'core.programme_cohorts'::text, 'core.cohort_memberships'::text, 'core.morarji_outcomes'::text])))`
- `audit_events_operation_check`: `CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text])))`
- `audit_events_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `audit_events_append` (a; mass_foundation_owner): USING `None`; CHECK `true`.
- `audit_events_read` (r; mass_foundation_auditor): USING `true`; CHECK `None`.
- `core_audit_append` (a; mass_core_owner): USING `None`; CHECK `true`.

Triggers:

- `CREATE TRIGGER audit_events_immutable BEFORE DELETE OR UPDATE ON mass_foundation.audit_events FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation()`
- `CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON mass_foundation.audit_events FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation()`

## `mass_foundation.import_batches`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`mapping_version`|`text`|False|`` / |
|`extractor_version`|`text`|False|`` / |
|`state`|`text`|False|`'staged'::text` / |
|`created_at`|`timestamp with time zone`|False|`clock_timestamp()` / |
|`started_at`|`timestamp with time zone`|True|`` / |
|`completed_at`|`timestamp with time zone`|True|`` / |
|`checkpoint_position`|`bigint`|True|`` / |
|`extracted_count`|`bigint`|False|`0` / |
|`accepted_count`|`bigint`|False|`0` / |
|`quarantined_count`|`bigint`|False|`0` / |
|`excluded_count`|`bigint`|False|`0` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `import_batches_accepted_count_check`: `CHECK ((accepted_count >= 0))`
- `import_batches_check`: `CHECK ((((accepted_count + quarantined_count) + excluded_count) <= extracted_count))`
- `import_batches_check1`: `CHECK (((state <> 'complete'::text) OR (((accepted_count + quarantined_count) + excluded_count) = extracted_count)))`
- `import_batches_checkpoint_position_check`: `CHECK ((checkpoint_position >= 0))`
- `import_batches_excluded_count_check`: `CHECK ((excluded_count >= 0))`
- `import_batches_extracted_count_check`: `CHECK ((extracted_count >= 0))`
- `import_batches_extractor_version_check`: `CHECK ((extractor_version ~ '^[A-Za-z0-9_.-]{1,64}$'::text))`
- `import_batches_mapping_version_check`: `CHECK ((mapping_version ~ '^[A-Za-z0-9_.-]{1,64}$'::text))`
- `import_batches_pkey`: `PRIMARY KEY (id)`
- `import_batches_quarantined_count_check`: `CHECK ((quarantined_count >= 0))`
- `import_batches_row_version_check`: `CHECK ((row_version > 0))`
- `import_batches_state_check`: `CHECK ((state = ANY (ARRAY['staged'::text, 'validated'::text, 'approved'::text, 'running'::text, 'complete'::text, 'failed'::text])))`

Policy definitions:

- `import_batches_insert` (a; mass_foundation_ingestor): USING `None`; CHECK `true`.
- `import_batches_read` (r; mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor): USING `true`; CHECK `None`.
- `import_batches_update` (w; mass_foundation_ingestor): USING `true`; CHECK `true`.

Triggers:

- `CREATE TRIGGER import_batches_audit AFTER INSERT OR UPDATE ON mass_foundation.import_batches FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit()`
- `CREATE TRIGGER import_batches_guard BEFORE INSERT OR UPDATE ON mass_foundation.import_batches FOR EACH ROW EXECUTE FUNCTION mass_foundation.guard_batch()`
- `CREATE TRIGGER import_batches_no_delete BEFORE DELETE ON mass_foundation.import_batches FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation()`
- `CREATE TRIGGER import_batches_no_truncate BEFORE TRUNCATE ON mass_foundation.import_batches FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation()`

## `mass_foundation.import_exceptions`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`batch_id`|`uuid`|False|`` / |
|`source_row_id`|`uuid`|False|`` / |
|`field_ordinal`|`integer`|True|`` / |
|`reason_code`|`text`|False|`` / |
|`review_state`|`text`|False|`'open'::text` / |
|`resolution_code`|`text`|True|`` / |
|`resolved_by`|`name`|True|`` / |
|`resolved_at`|`timestamp with time zone`|True|`` / |
|`row_version`|`bigint`|False|`1` / |

Constraints:

- `import_exceptions_batch_id_fkey`: `FOREIGN KEY (batch_id) REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT`
- `import_exceptions_batch_id_source_row_id_field_ordinal_reas_key`: `UNIQUE NULLS NOT DISTINCT (batch_id, source_row_id, field_ordinal, reason_code)`
- `import_exceptions_check`: `CHECK ((((review_state = 'open'::text) AND (resolution_code IS NULL) AND (resolved_by IS NULL) AND (resolved_at IS NULL)) OR ((review_state <> 'open'::text) AND (resolution_code IS NOT NULL) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL))))`
- `import_exceptions_field_ordinal_check`: `CHECK ((field_ordinal > 0))`
- `import_exceptions_pkey`: `PRIMARY KEY (id)`
- `import_exceptions_reason_code_check`: `CHECK ((reason_code = ANY (ARRAY['missing_reference'::text, 'invalid_format'::text, 'conflicting_metadata'::text, 'duplicate_occurrence'::text, 'unverified_record'::text])))`
- `import_exceptions_resolution_code_check`: `CHECK ((resolution_code = ANY (ARRAY['verified_correction'::text, 'excluded'::text, 'not_an_issue'::text])))`
- `import_exceptions_review_state_check`: `CHECK ((review_state = ANY (ARRAY['open'::text, 'resolved'::text, 'rejected'::text])))`
- `import_exceptions_row_version_check`: `CHECK ((row_version > 0))`
- `import_exceptions_source_row_id_fkey`: `FOREIGN KEY (source_row_id) REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT`

Policy definitions:

- `import_exceptions_insert` (a; mass_foundation_ingestor): USING `None`; CHECK `true`.
- `import_exceptions_read` (r; mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor): USING `true`; CHECK `None`.
- `import_exceptions_review` (w; mass_foundation_reviewer): USING `true`; CHECK `true`.

Triggers:

- `CREATE TRIGGER import_exceptions_audit AFTER INSERT OR UPDATE ON mass_foundation.import_exceptions FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit()`
- `CREATE TRIGGER import_exceptions_guard BEFORE INSERT OR UPDATE ON mass_foundation.import_exceptions FOR EACH ROW EXECUTE FUNCTION mass_foundation.guard_exception()`
- `CREATE TRIGGER import_exceptions_no_delete BEFORE DELETE ON mass_foundation.import_exceptions FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation()`
- `CREATE TRIGGER import_exceptions_no_truncate BEFORE TRUNCATE ON mass_foundation.import_exceptions FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation()`

## `mass_foundation.source_files`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`original_file_id`|`text`|True|`` / |
|`sha256`|`text`|False|`` / |
|`storage_ref`|`uuid`|False|`` / |
|`source_version`|`text`|True|`` / |
|`exported_at`|`timestamp with time zone`|True|`` / |
|`received_at`|`timestamp with time zone`|False|`clock_timestamp()` / |

Constraints:

- `source_files_original_file_id_check`: `CHECK ((original_file_id ~ '^[A-Za-z0-9_-]{1,128}$'::text))`
- `source_files_pkey`: `PRIMARY KEY (id)`
- `source_files_sha256_check`: `CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))`
- `source_files_sha256_key`: `UNIQUE (sha256)`
- `source_files_source_version_check`: `CHECK ((source_version ~ '^[A-Za-z0-9_.-]{1,64}$'::text))`
- `source_files_storage_ref_key`: `UNIQUE (storage_ref)`

Policy definitions:

- `admin_import_reference_files` (r; mass_data_importer): USING `true`; CHECK `None`.
- `source_files_insert` (a; mass_foundation_ingestor): USING `None`; CHECK `true`.
- `source_files_read` (r; mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor): USING `true`; CHECK `None`.

Triggers:

- `CREATE TRIGGER source_files_audit AFTER INSERT ON mass_foundation.source_files FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit()`
- `CREATE TRIGGER source_files_immutable BEFORE DELETE OR UPDATE ON mass_foundation.source_files FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation()`
- `CREATE TRIGGER source_files_no_truncate BEFORE TRUNCATE ON mass_foundation.source_files FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation()`

## `mass_foundation.source_rows`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`sheet_id`|`uuid`|False|`` / |
|`first_batch_id`|`uuid`|False|`` / |
|`row_number`|`integer`|False|`` / |
|`content_hash`|`text`|False|`` / |
|`classification`|`text`|False|`'candidate'::text` / |

Constraints:

- `source_rows_classification_check`: `CHECK ((classification = ANY (ARRAY['candidate'::text, 'example'::text, 'scaffold'::text, 'summary'::text, 'rejected'::text])))`
- `source_rows_content_hash_check`: `CHECK ((content_hash ~ '^[0-9a-f]{64}$'::text))`
- `source_rows_first_batch_id_fkey`: `FOREIGN KEY (first_batch_id) REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT`
- `source_rows_pkey`: `PRIMARY KEY (id)`
- `source_rows_row_number_check`: `CHECK ((row_number > 0))`
- `source_rows_sheet_id_fkey`: `FOREIGN KEY (sheet_id) REFERENCES mass_foundation.source_sheets(id) ON DELETE RESTRICT`
- `source_rows_sheet_id_row_number_key`: `UNIQUE (sheet_id, row_number)`

Policy definitions:

- `admin_import_reference_rows` (r; mass_data_importer): USING `true`; CHECK `None`.
- `source_rows_insert` (a; mass_foundation_ingestor): USING `None`; CHECK `true`.
- `source_rows_read` (r; mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor): USING `true`; CHECK `None`.

Triggers:

- `CREATE TRIGGER source_rows_audit AFTER INSERT ON mass_foundation.source_rows FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit()`
- `CREATE TRIGGER source_rows_immutable BEFORE DELETE OR UPDATE ON mass_foundation.source_rows FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation()`
- `CREATE TRIGGER source_rows_no_truncate BEFORE TRUNCATE ON mass_foundation.source_rows FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation()`

## `mass_foundation.source_sheets`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`id`|`uuid`|False|`gen_random_uuid()` / |
|`file_id`|`uuid`|False|`` / |
|`native_sheet_id`|`text`|True|`` / |
|`ordinal`|`integer`|False|`` / |
|`classification`|`text`|False|`'unclassified'::text` / |
|`header_version`|`integer`|False|`` / |

Constraints:

- `source_sheets_classification_check`: `CHECK ((classification = ANY (ARRAY['unclassified'::text, 'input'::text, 'master'::text, 'helper'::text, 'report'::text, 'template'::text])))`
- `source_sheets_file_id_fkey`: `FOREIGN KEY (file_id) REFERENCES mass_foundation.source_files(id) ON DELETE RESTRICT`
- `source_sheets_file_id_native_sheet_id_key`: `UNIQUE (file_id, native_sheet_id)`
- `source_sheets_file_id_ordinal_key`: `UNIQUE (file_id, ordinal)`
- `source_sheets_header_version_check`: `CHECK ((header_version > 0))`
- `source_sheets_native_sheet_id_check`: `CHECK ((native_sheet_id ~ '^[A-Za-z0-9_-]{1,64}$'::text))`
- `source_sheets_ordinal_check`: `CHECK ((ordinal > 0))`
- `source_sheets_pkey`: `PRIMARY KEY (id)`

Policy definitions:

- `admin_import_reference_sheets` (r; mass_data_importer): USING `true`; CHECK `None`.
- `source_sheets_insert` (a; mass_foundation_ingestor): USING `None`; CHECK `true`.
- `source_sheets_read` (r; mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor): USING `true`; CHECK `None`.

Triggers:

- `CREATE TRIGGER source_sheets_audit AFTER INSERT ON mass_foundation.source_sheets FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit()`
- `CREATE TRIGGER source_sheets_immutable BEFORE DELETE OR UPDATE ON mass_foundation.source_sheets FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation()`
- `CREATE TRIGGER source_sheets_no_truncate BEFORE TRUNCATE ON mass_foundation.source_sheets FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation()`

## `mass_import.receipts`

RLS enabled: True; FORCE RLS: True. Policies: 3.

|Column|Type|Nullable|Default/generated|
|---|---|---|---|
|`source_row_id`|`uuid`|False|`` / |
|`source_slot`|`integer`|False|`` / |
|`target_table`|`text`|False|`` / |
|`target_id`|`uuid`|False|`` / |
|`payload_hmac`|`text`|False|`` / |
|`staging_sha256`|`text`|False|`` / |
|`assumed_enrolment_dates`|`boolean`|False|`false` / |
|`imported_at`|`timestamp with time zone`|False|`clock_timestamp()` / |
|`imported_by`|`name`|False|`SESSION_USER` / |

Constraints:

- `receipts_payload_hmac_check`: `CHECK ((payload_hmac ~ '^[0-9a-f]{64}$'::text))`
- `receipts_pkey`: `PRIMARY KEY (source_row_id, source_slot, target_table)`
- `receipts_source_row_id_fkey`: `FOREIGN KEY (source_row_id) REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT`
- `receipts_source_slot_check`: `CHECK ((source_slot > 0))`
- `receipts_staging_sha256_check`: `CHECK ((staging_sha256 ~ '^[0-9a-f]{64}$'::text))`
- `receipts_target_table_check`: `CHECK ((target_table = ANY (ARRAY['children'::text, 'private_child_profiles'::text, 'enrolments'::text, 'attendance_records'::text, 'assessment_results'::text, 'cohort_memberships'::text, 'morarji_outcomes'::text])))`
- `receipts_target_table_target_id_key`: `UNIQUE (target_table, target_id)`

Policy definitions:

- `importer_append` (a; mass_data_importer): USING `None`; CHECK `true`.
- `importer_read` (r; mass_data_importer): USING `true`; CHECK `None`.
- `owner_read` (r; mass_core_owner): USING `true`; CHECK `None`.

Triggers:

- `CREATE TRIGGER receipts_immutable BEFORE DELETE OR UPDATE ON mass_import.receipts FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable()`
- `CREATE TRIGGER receipts_no_truncate BEFORE TRUNCATE ON mass_import.receipts FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable()`

## Observed function signatures

- `mass_core.can_read(c uuid)`
- `mass_core.can_write(c uuid)`
- `mass_api.add_enrolment(p_child uuid, p_centre uuid, p_grade text, p_shift text, p_start date, p_status text)`
- `mass_foundation.reject_mutation()`
- `mass_foundation.guard_batch()`
- `mass_foundation.guard_exception()`
- `mass_api.close_enrolment(p_id uuid, p_expected bigint, p_ends_before date, p_status text)`
- `mass_api.create_activity(p_id uuid, p_centre uuid, p_shift text, p_date date, p_name text)`
- `mass_api.record_attendance(p_enrolment uuid, p_date date, p_code text, p_expected bigint)`
- `mass_foundation.record_audit()`
- `mass_core.request_user_id()`
- `mass_core.can_read_child(c uuid)`
- `mass_core.can_write_child(c uuid)`
- `mass_core.period_contains(p uuid, d date)`
- `mass_core.can_read_profile(c uuid)`
- `mass_core.expected_version(actual bigint, expected bigint)`
- `mass_core.writable_enrolment(e uuid)`
- `mass_core.record_audit()`
- `mass_core.guard_record()`
- `mass_api.record_assessment(p_enrolment uuid, p_definition uuid, p_date date, p_score numeric, p_expected bigint)`
- `mass_api.add_morarji_member(p_enrolment uuid, p_cohort uuid)`
- `mass_api.register_student(p_centre uuid, p_grade text, p_shift text, p_start date, p_name text, p_gender text)`
- `mass_api.record_participation(p_enrolment uuid, p_event uuid, p_participated boolean, p_expected bigint)`
- `mass_api.record_morarji(p_member uuid, p_applied boolean, p_attended boolean, p_passed boolean, p_school text, p_expected bigint)`
- `mass_api.attendance_summary(p_centre uuid, p_from date, p_until date)`
- `mass_api.list_students(p_centre uuid, p_on date)`
- `mass_core.guard_directory_immutable()`
- `mass_core.require_read_scope(p_centre uuid, p_limit integer, p_offset integer, p_from date, p_until date)`
- `mass_api.get_context()`
- `mass_api.get_references()`
- `mass_api.read_students(p_centre uuid, p_on date, p_limit integer, p_offset integer)`
- `mass_api.read_attendance(p_centre uuid, p_from date, p_until date, p_child uuid, p_limit integer, p_offset integer)`
- `mass_api.read_calendar(p_centre uuid, p_from date, p_until date, p_limit integer, p_offset integer)`
- `mass_api.read_assessments(p_centre uuid, p_from date, p_until date, p_child uuid, p_limit integer, p_offset integer)`
- `mass_api.read_activities(p_centre uuid, p_from date, p_until date, p_limit integer, p_offset integer)`
- `mass_api.read_participation(p_centre uuid, p_from date, p_until date, p_event uuid, p_child uuid, p_limit integer, p_offset integer)`
- `mass_api.read_morarji(p_centre uuid, p_cohort uuid, p_limit integer, p_offset integer)`
- `mass_core.guard_centre_directory()`
- `mass_api.get_centre_directory(p_centre uuid, p_donor uuid, p_limit integer, p_offset integer)`
- `mass_api.get_centre_staff(p_centre uuid, p_shift text, p_limit integer, p_offset integer)`
- `mass_core.next_student_id(p_centre uuid, p_grade text)`

Auth enforcement must be tested using actual isolated Auth sessions. Catalogue and administrative SELECTs do not impersonate staff, prove their write paths, or approve broad operational assignments. No grants were changed.
