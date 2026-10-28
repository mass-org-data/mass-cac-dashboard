# Implemented entity–relationship diagrams

Phase 4 migration 016, 28 October 2026. **23 local relations, 16 migrations, 016 not hosted-applied.** Generated from the same isolated PostgreSQL catalog as the [dictionary](DATABASE-DATA-DICTIONARY.md) and [machine inventory](DATABASE-SCHEMA-INVENTORY.json). Earlier proposed ERDs remain in [the preserved Phase 2E snapshot](DATABASE-PROPOSED-ERD-PHASE-2E.md).

Entity IDs use `mass_core_` / `mass_foundation_` instead of schema dots for Mermaid compatibility. Every column of each owning-domain relation is shown once; referenced parents repeat as key-only stubs. `auth_users` is the existing managed `auth.users` dependency, not a created table. Optional parent associations reflect FK nullability; child zero-or-one reflects FK columns containing a UNIQUE/PK. Composite keys/NULL behavior and runtime temporal checks are specified by the dictionary and migrations.

## Foundation and managed Auth

```mermaid
erDiagram
    mass_foundation_audit_events {
        uuid id PK
        name actor_database_principal
        name actor_database_role
        text entity_type
        uuid entity_id
        text operation
        timestamp_with_time_zone changed_at
        jsonb change_metadata
        uuid batch_id FK
        uuid actor_user_id FK
    }
    mass_foundation_import_batches {
        uuid id PK
        text mapping_version
        text extractor_version
        text state
        timestamp_with_time_zone created_at
        timestamp_with_time_zone started_at
        timestamp_with_time_zone completed_at
        bigint checkpoint_position
        bigint extracted_count
        bigint accepted_count
        bigint quarantined_count
        bigint excluded_count
        bigint row_version
    }
    mass_foundation_import_exceptions {
        uuid id PK
        uuid batch_id FK
        uuid source_row_id FK
        integer field_ordinal
        text reason_code
        text review_state
        text resolution_code
        name resolved_by
        timestamp_with_time_zone resolved_at
        bigint row_version
    }
    mass_foundation_source_files {
        uuid id PK
        text original_file_id
        text sha256 UK
        uuid storage_ref UK
        text source_version
        timestamp_with_time_zone exported_at
        timestamp_with_time_zone received_at
    }
    mass_foundation_source_rows {
        uuid id PK
        uuid sheet_id FK
        uuid first_batch_id FK
        integer row_number
        text content_hash
        text classification
    }
    mass_foundation_source_sheets {
        uuid id PK
        uuid file_id FK
        text native_sheet_id
        integer ordinal
        text classification
        integer header_version
    }
    auth_users {
        uuid id
    }
    auth_users |o--o{ mass_foundation_audit_events : "actor_user_id"
    mass_foundation_import_batches |o--o{ mass_foundation_audit_events : "batch_id"
    mass_foundation_import_batches ||--o{ mass_foundation_import_exceptions : "batch_id"
    mass_foundation_source_rows ||--o{ mass_foundation_import_exceptions : "source_row_id"
    mass_foundation_import_batches ||--o{ mass_foundation_source_rows : "first_batch_id"
    mass_foundation_source_sheets ||--o{ mass_foundation_source_rows : "sheet_id"
    mass_foundation_source_files ||--o{ mass_foundation_source_sheets : "file_id"
```

## Core identity, access and academic references

```mermaid
erDiagram
    mass_core_centres {
        uuid id PK
        text label
        bigint row_version
    }
    mass_core_user_scope_grants {
        uuid id PK
        uuid user_id FK
        uuid centre_id FK
        text role_code
        timestamp_with_time_zone starts_at
        timestamp_with_time_zone ends_at
        uuid verified_by FK
        timestamp_with_time_zone verified_at
        bigint row_version
        boolean can_read_profiles
    }
    mass_core_children {
        uuid id PK
        text student_id UK
        bigint row_version
    }
    mass_core_private_child_profiles {
        uuid id PK
        uuid child_id FK,UK
        text full_name
        text gender_code
        boolean class10_board_passed
        bigint row_version
    }
    mass_core_enrolments {
        uuid id PK
        uuid child_id FK
        uuid centre_id FK
        text grade_label
        text shift_code
        date starts_on
        date ends_before
        text status_code
        bigint row_version
    }
    mass_core_academic_years {
        uuid id PK
        date starts_on UK
        date ends_before
        bigint row_version
    }
    mass_core_assessment_periods {
        uuid id PK
        uuid academic_year_id FK
        smallint quarter
        bigint row_version
    }
    auth_users {
        uuid id
    }
    mass_core_centres ||--o{ mass_core_user_scope_grants : "centre_id"
    auth_users ||--o{ mass_core_user_scope_grants : "user_id"
    auth_users ||--o{ mass_core_user_scope_grants : "verified_by"
    mass_core_children ||--o| mass_core_private_child_profiles : "child_id"
    mass_core_centres ||--o{ mass_core_enrolments : "centre_id"
    mass_core_children ||--o{ mass_core_enrolments : "child_id"
    mass_core_academic_years ||--o{ mass_core_assessment_periods : "academic_year_id"
```

## Attendance, assessments, activities and Morarji

```mermaid
erDiagram
    mass_core_activity_events {
        uuid id PK
        uuid centre_id FK
        text shift_code
        date activity_date
        text name
        bigint row_version
    }
    mass_core_activity_participation {
        uuid id PK
        uuid event_id FK
        uuid child_id FK
        uuid centre_id FK
        text shift_code FK
        uuid enrolment_id FK
        boolean participated
        bigint row_version
    }
    mass_core_assessment_definitions {
        uuid id PK
        uuid period_id FK,UK
        numeric max_score
        bigint row_version
    }
    mass_core_assessment_results {
        uuid id PK
        uuid child_id FK
        uuid centre_id FK
        text shift_code FK
        uuid enrolment_id FK
        uuid definition_id FK
        date assessed_on
        numeric score
        bigint row_version
    }
    mass_core_attendance_codes {
        text code PK
        text meaning
        bigint row_version
    }
    mass_core_attendance_records {
        uuid id PK
        uuid child_id FK
        uuid centre_id FK
        text shift_code FK
        uuid enrolment_id FK
        date attendance_date
        text code FK
        bigint row_version
    }
    mass_core_cac_sessions {
        uuid id PK
        uuid centre_id FK
        text shift_code
        date session_date
        boolean is_scheduled
        uuid confirmation_ref
        bigint row_version
    }
    mass_core_cohort_memberships {
        uuid id PK
        uuid cohort_id FK
        uuid child_id FK
        uuid centre_id FK
        text shift_code FK
        uuid enrolment_id FK
        bigint row_version
    }
    mass_core_morarji_outcomes {
        uuid id PK
        uuid membership_id FK,UK
        uuid centre_id FK
        boolean applied
        boolean attended
        boolean passed
        text school_name
        bigint row_version
    }
    mass_core_programme_cohorts {
        uuid id PK
        text label
        uuid academic_year_id FK
        bigint row_version
    }
    mass_core_academic_years {
        uuid id
    }
    mass_core_assessment_periods {
        uuid id
    }
    mass_core_centres {
        uuid id
    }
    mass_core_enrolments {
        uuid id
        uuid child_id
        uuid centre_id
        text shift_code
    }
    mass_core_centres ||--o{ mass_core_activity_events : "centre_id"
    mass_core_enrolments ||--o{ mass_core_activity_participation : "enrolment_id, child_id, centre_id, shift_code"
    mass_core_activity_events ||--o{ mass_core_activity_participation : "event_id, centre_id, shift_code"
    mass_core_assessment_periods ||--o| mass_core_assessment_definitions : "period_id"
    mass_core_assessment_definitions ||--o{ mass_core_assessment_results : "definition_id"
    mass_core_enrolments ||--o{ mass_core_assessment_results : "enrolment_id, child_id, centre_id, shift_code"
    mass_core_attendance_codes ||--o{ mass_core_attendance_records : "code"
    mass_core_enrolments ||--o{ mass_core_attendance_records : "enrolment_id, child_id, centre_id, shift_code"
    mass_core_centres ||--o{ mass_core_cac_sessions : "centre_id"
    mass_core_programme_cohorts ||--o{ mass_core_cohort_memberships : "cohort_id"
    mass_core_enrolments ||--o{ mass_core_cohort_memberships : "enrolment_id, child_id, centre_id, shift_code"
    mass_core_cohort_memberships ||--o| mass_core_morarji_outcomes : "membership_id, centre_id"
    mass_core_academic_years |o--o{ mass_core_programme_cohorts : "academic_year_id"
```

## Relationships that are deliberately absent

No person/name join, polymorphic audit business FK, historical source-slot/event bridge, automatic year/quarter alias or derived staff/funder relationship is implied. Audit entity_id is a durable locator, while actor_user_id and batch_id are real FKs. No unimplemented proposed relation is drawn as deployed. All actual FK edges, including Auth and composite contextual keys, appear above.
