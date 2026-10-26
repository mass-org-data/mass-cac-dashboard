# Proposed ER diagrams

Read with DATABASE-DATA-DICTIONARY.md. These are proposed relationships, not deployed tables or approved policies. Source-backed observations, future frontend extensions and migration infrastructure have different approval gates. An FK permits many referencing records unless a unique constraint in the dictionary makes it one-to-one. Nullable FK means optional parent association. auth.users is managed by Supabase, not created by this design.

## Identity, references and historical placement

```mermaid
erDiagram
    projects {
        uuid id PK
    }
    centres {
        uuid id PK
    }
    centre_aliases {
        uuid id PK
        uuid centre_id FK
        uuid project_id FK
        uuid approved_by FK
    }
    academic_years {
        uuid id PK
    }
    assessment_periods {
        uuid id PK
        uuid academic_year_id FK
    }
    children {
        uuid id PK
    }
    private_child_profiles {
        uuid id PK
        uuid child_id FK
    }
    placement_observations {
        uuid id PK
        uuid child_id FK
        uuid centre_id FK
        uuid project_id FK
        uuid academic_year_id FK
    }
    enrolments {
        uuid id PK
        uuid child_id FK
        uuid centre_id FK
        uuid project_id FK
        uuid academic_year_id FK
    }
    roster_reviews {
        uuid id PK
        uuid child_id FK
        uuid project_id FK
    }
    private_baseline_surveys {
        uuid id PK
        uuid child_id FK
    }
    private_baseline_answers {
        uuid id PK
        uuid survey_id FK
    }
    academic_years |o--o{ enrolments : "academic_year_id"
    academic_years |o--o{ placement_observations : "academic_year_id"
    academic_years ||--o{ assessment_periods : "academic_year_id"
    auth_users |o--o{ centre_aliases : "approved_by"
    centres |o--o{ placement_observations : "centre_id"
    centres ||--o{ centre_aliases : "centre_id"
    centres ||--o{ enrolments : "centre_id"
    children ||--o{ enrolments : "child_id"
    children ||--o{ placement_observations : "child_id"
    children ||--o{ private_baseline_surveys : "child_id"
    children ||--o{ private_child_profiles : "child_id"
    children ||--o{ roster_reviews : "child_id"
    private_baseline_surveys ||--o{ private_baseline_answers : "survey_id"
    projects |o--o{ centre_aliases : "project_id"
    projects |o--o{ enrolments : "project_id"
    projects |o--o{ placement_observations : "project_id"
    projects |o--o{ roster_reviews : "project_id"
```

## Attendance, learning and programme operations

```mermaid
erDiagram
    attendance_codes {
        uuid id PK
    }
    cac_sessions {
        uuid id PK
        uuid centre_id FK
    }
    attendance_records {
        uuid id PK
        uuid child_id FK
        uuid centre_id FK
        uuid code_id FK
        uuid enrolment_id FK
        uuid session_id FK
    }
    assessment_definitions {
        uuid id PK
        uuid project_id FK
        uuid period_id FK
    }
    assessment_batches {
        uuid id PK
        uuid definition_id FK
        uuid centre_id FK
    }
    assessment_results {
        uuid id PK
        uuid child_id FK
        uuid definition_id FK
        uuid centre_id FK
        uuid batch_id FK
    }
    monthly_activity_returns {
        uuid id PK
        uuid child_id FK
        uuid project_id FK
        uuid centre_id FK
    }
    monthly_activity_responses {
        uuid id PK
        uuid return_id FK
        uuid activity_event_id FK
    }
    activity_events {
        uuid id PK
        uuid project_id FK
        uuid centre_id FK
    }
    activity_participation {
        uuid id PK
        uuid event_id FK
        uuid child_id FK
        uuid eligibility_enrolment_id FK
    }
    centre_visits {
        uuid id PK
        uuid staff_id FK
        uuid centre_id FK
    }
    programme_cohorts {
        uuid id PK
        uuid academic_year_id FK
    }
    cohort_memberships {
        uuid id PK
        uuid cohort_id FK
        uuid child_id FK
        uuid project_id FK
        uuid centre_id FK
    }
    morarji_outcomes {
        uuid id PK
        uuid membership_id FK
    }
    followup_actions {
        uuid id PK
        uuid child_id FK
        uuid centre_id FK
        uuid membership_id FK
    }
    academic_years |o--o{ programme_cohorts : "academic_year_id"
    activity_events |o--o{ monthly_activity_responses : "activity_event_id"
    activity_events ||--o{ activity_participation : "event_id"
    assessment_batches |o--o{ assessment_results : "batch_id"
    assessment_definitions ||--o{ assessment_batches : "definition_id"
    assessment_definitions ||--o{ assessment_results : "definition_id"
    assessment_periods ||--o{ assessment_definitions : "period_id"
    attendance_codes ||--o{ attendance_records : "code_id"
    cac_sessions |o--o{ attendance_records : "session_id"
    centres |o--o{ assessment_batches : "centre_id"
    centres |o--o{ cohort_memberships : "centre_id"
    centres |o--o{ followup_actions : "centre_id"
    centres |o--o{ monthly_activity_returns : "centre_id"
    centres ||--o{ activity_events : "centre_id"
    centres ||--o{ assessment_results : "centre_id"
    centres ||--o{ attendance_records : "centre_id"
    centres ||--o{ cac_sessions : "centre_id"
    centres ||--o{ centre_visits : "centre_id"
    children ||--o{ activity_participation : "child_id"
    children ||--o{ assessment_results : "child_id"
    children ||--o{ attendance_records : "child_id"
    children ||--o{ cohort_memberships : "child_id"
    children ||--o{ followup_actions : "child_id"
    children ||--o{ monthly_activity_returns : "child_id"
    cohort_memberships |o--o{ followup_actions : "membership_id"
    cohort_memberships ||--o{ morarji_outcomes : "membership_id"
    enrolments |o--o{ activity_participation : "eligibility_enrolment_id"
    enrolments |o--o{ attendance_records : "enrolment_id"
    monthly_activity_returns ||--o{ monthly_activity_responses : "return_id"
    programme_cohorts ||--o{ cohort_memberships : "cohort_id"
    projects |o--o{ activity_events : "project_id"
    projects |o--o{ cohort_memberships : "project_id"
    projects ||--o{ assessment_definitions : "project_id"
    projects ||--o{ monthly_activity_returns : "project_id"
    staff ||--o{ centre_visits : "staff_id"
```

## Future guidance/funding and staff access

```mermaid
erDiagram
    staff {
        uuid id PK
        uuid user_id FK
    }
    staff_assignments {
        uuid id PK
        uuid staff_id FK
        uuid centre_id FK
    }
    user_scope_grants {
        uuid id PK
        uuid user_id FK
        uuid centre_id FK
        uuid project_id FK
        uuid approved_by FK
    }
    guidance_sessions {
        uuid id PK
        uuid cohort_id FK
        uuid centre_id FK
    }
    guidance_participants {
        uuid id PK
        uuid session_id FK
        uuid child_id FK
        uuid centre_id FK
    }
    guidance_followups {
        uuid id PK
        uuid participant_id FK
    }
    guidance_feedback {
        uuid id PK
        uuid session_id FK
        uuid staff_id FK
    }
    funders {
        uuid id PK
    }
    centre_funding_periods {
        uuid id PK
        uuid funder_id FK
        uuid centre_id FK
        uuid project_id FK
    }
    auth_users |o--o{ staff : "user_id"
    auth_users ||--o{ user_scope_grants : "approved_by"
    auth_users ||--o{ user_scope_grants : "user_id"
    centres |o--o{ guidance_participants : "centre_id"
    centres |o--o{ guidance_sessions : "centre_id"
    centres |o--o{ user_scope_grants : "centre_id"
    centres ||--o{ centre_funding_periods : "centre_id"
    centres ||--o{ staff_assignments : "centre_id"
    children |o--o{ guidance_participants : "child_id"
    funders ||--o{ centre_funding_periods : "funder_id"
    guidance_participants ||--o{ guidance_followups : "participant_id"
    guidance_sessions ||--o{ guidance_feedback : "session_id"
    guidance_sessions ||--o{ guidance_participants : "session_id"
    programme_cohorts |o--o{ guidance_sessions : "cohort_id"
    projects |o--o{ centre_funding_periods : "project_id"
    projects |o--o{ user_scope_grants : "project_id"
    staff |o--o{ guidance_feedback : "staff_id"
    staff ||--o{ staff_assignments : "staff_id"
```

## Migration provenance and audit

```mermaid
erDiagram
    source_files {
        uuid id PK
    }
    source_sheets {
        uuid id PK
        uuid file_id FK
    }
    import_batches {
        uuid id PK
    }
    source_rows {
        uuid id PK
        uuid sheet_id FK
        uuid first_batch_id FK
        uuid canonical_source_row_id FK
    }
    identity_resolutions {
        uuid id PK
        uuid source_row_id FK
        uuid child_id FK
        uuid staff_id FK
        uuid reviewed_by FK
    }
    import_exceptions {
        uuid id PK
        uuid batch_id FK
        uuid source_row_id FK
        uuid resolved_by FK
    }
    audit_events {
        uuid id PK
        uuid actor_user_id FK
        uuid batch_id FK
    }
    auth_users |o--o{ audit_events : "actor_user_id"
    auth_users |o--o{ identity_resolutions : "reviewed_by"
    auth_users |o--o{ import_exceptions : "resolved_by"
    children |o--o{ identity_resolutions : "child_id"
    import_batches |o--o{ audit_events : "batch_id"
    import_batches ||--o{ import_exceptions : "batch_id"
    import_batches ||--o{ source_rows : "first_batch_id"
    source_files ||--o{ source_sheets : "file_id"
    source_rows |o--o{ source_rows : "canonical_source_row_id"
    source_rows ||--o{ identity_resolutions : "source_row_id"
    source_rows ||--o{ import_exceptions : "source_row_id"
    source_sheets ||--o{ source_rows : "sheet_id"
    staff |o--o{ identity_resolutions : "staff_id"
```

## Cardinality qualifications

- children -> private_child_profiles is zero-or-one current private profile, enforced by unique child_id (the overview FK edge alone does not show uniqueness).
- cohort_memberships -> morarji_outcomes is zero-or-one outcome set, enforced by unique membership_id.
- monthly_activity_returns -> monthly_activity_responses is up to four slot rows with unique return/slot and slot bound 1-4; missing/NULL stays unknown.
- activity_events -> activity_participation has one row per distinct event/child after approval, not one participation per month.
- children -> enrolments, placement observations, roster reviews, assessments, cohort memberships and follow-up actions are one-to-many; they must not overwrite cross-year/history data.
- academic_years -> assessment_periods -> assessment_definitions -> results separates quarter/year and paper-scale revisions. F1-F4 mapping remains a decision, not an ERD equivalence.
- source_files -> source_sheets -> source_rows is immutable snapshot lineage; canonical imported facts reference source_rows through origin_row_id plus source cell locators (the shared origin relationship is specified in the dictionary rather than repeated on every diagram).
- identity_resolutions targets a child or staff person, never both for an accepted resolution; ambiguity remains a staging decision, not a forced match.
- audit_events entity_id is an intentional durable audit locator, not an unmodeled business FK. No FK cascade may erase historical audit evidence.

All optional future guidance/funding relations are proposals. No source supports converting project labels directly into funder accounts or inferring programme admission/award outcomes.
