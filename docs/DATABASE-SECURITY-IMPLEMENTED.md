# Implemented database security and RLS

Phase 3C, 27 October 2026. Generated policy/ACL evidence from the isolated local schema, not hosted Supabase certification. Read with [the core handover](PHASE-3B-CORE-HANDOVER.md) and [deployment gates](PHASE-3C-DEPLOYMENT-READINESS.md). No real users/scopes are provisioned.

## Access boundary

- All 23 relations enable and force RLS. Private schemas are mass_foundation and mass_core; mass_api contains curated functions and no tables. The local API exposes only mass_api; actual hosted exposure must be reviewed before any apply/enablement.
- Leadership has programme reads only within explicit valid grants and no business writes. Teachers and Cluster Officers need verified centre scopes; explicit can_read_profiles is additional and still excludes Leadership. No null/global centre or browser role claim grants access.
- Authenticated direct mutations are not granted. Typed definer RPCs enforce scope and optimistic revisions; centred owner write policies add scope enforcement. Scoped invoker read projections preserve RLS and private-field filtering.
- Technical foundation roles and core admin/owner are NOLOGIN and NOBYPASSRLS. Only the trusted deployment principal receives explicit SET/INHERIT owner memberships; no application-role owner memberships or actual staff scope rows are installed. Actor UID is trusted only behind a real validated Auth issuer/gateway; test stubs do not certify managed Auth.
- Managed Auth privileges are not delegated to owner roles. The deployment principal installs auth.users foreign keys using its own direct REFERENCES rights. The private request_user_id wrapper is SECURITY INVOKER with a SQL-standard body bound to managed auth.uid(); runtime EXECUTE is still enforced. No manual JWT parser or new SECURITY DEFINER is introduced.
- Runtime audit is append-only minimized revision metadata, atomic with writes; DB administrator tampering and generic runtime/error logging are separate operational controls. No PII-rich before/after payload, retention duration or end-user exception-review API is introduced.

## Technical roles

| Role | Login | Superuser | Bypass RLS | Create role |
| --- | --- | --- | --- | --- |
| `mass_core_admin` | False | False | False | False |
| `mass_core_owner` | False | False | False | False |
| `mass_foundation_auditor` | False | False | False | False |
| `mass_foundation_ingestor` | False | False | False | False |
| `mass_foundation_owner` | False | False | False | False |
| `mass_foundation_reviewer` | False | False | False | False |

## Exact RLS policies

Commands: r SELECT, a INSERT, w UPDATE, * ALL. Multiple applicable permissive policies combine with OR; owner helper read policies are intentional and are not grants to application users. Table/column ACLs also apply. Every expression below comes from pg_policy.

### mass_core.academic_years

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `admin_access` | * | `mass_core_admin` | `true` | `true` |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `(mass_core.request_user_id() IS NOT NULL)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,mass_core_admin=ar/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.activity_events

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.activity_participation

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.assessment_definitions

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `admin_access` | * | `mass_core_admin` | `true` | `true` |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `(mass_core.request_user_id() IS NOT NULL)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,mass_core_admin=ar/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.assessment_periods

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `admin_access` | * | `mass_core_admin` | `true` | `true` |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `(mass_core.request_user_id() IS NOT NULL)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,mass_core_admin=ar/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.assessment_results

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.attendance_codes

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `(mass_core.request_user_id() IS NOT NULL)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.attendance_records

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.cac_sessions

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `admin_access` | * | `mass_core_admin` | `true` | `true` |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,mass_core_admin=ar/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.centres

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `admin_access` | * | `mass_core_admin` | `true` | `true` |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,mass_core_admin=ar/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.children

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read_child(id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.cohort_memberships

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.enrolments

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.morarji_outcomes

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_insert` | a | `mass_core_owner` | `none` | `mass_core.can_write(centre_id)` |
| `owner_read` | r | `mass_core_owner` | `true` | `none` |
| `owner_update` | w | `mass_core_owner` | `mass_core.can_write(centre_id)` | `mass_core.can_write(centre_id)` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read(centre_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.private_child_profiles

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `mass_core.can_read_profile(child_id)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.programme_cohorts

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `admin_access` | * | `mass_core_admin` | `true` | `true` |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |
| `scoped_read` | r | `authenticated` | `(mass_core.request_user_id() IS NOT NULL)` | `none` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,mass_core_admin=ar/mass_core_owner,authenticated=r/mass_core_owner}`.

### mass_core.user_scope_grants

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `admin_access` | * | `mass_core_admin` | `true` | `true` |
| `owner_access` | * | `mass_core_owner` | `true` | `true` |

Table ACL: `{mass_core_owner=arwdDxtm/mass_core_owner,mass_core_admin=ar/mass_core_owner}`.

Column ACL `ends_at`: `{mass_core_admin=w/mass_core_owner}`.

### mass_foundation.audit_events

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `audit_events_append` | a | `mass_foundation_owner` | `none` | `true` |
| `audit_events_read` | r | `mass_foundation_auditor` | `true` | `none` |
| `core_audit_append` | a | `mass_core_owner` | `none` | `true` |

Table ACL: `{mass_foundation_owner=arwdDxtm/mass_foundation_owner,mass_foundation_auditor=r/mass_foundation_owner}`.

Column ACL `actor_database_principal`: `{mass_core_owner=a/mass_foundation_owner}`.

Column ACL `actor_database_role`: `{mass_core_owner=a/mass_foundation_owner}`.

Column ACL `entity_type`: `{mass_core_owner=a/mass_foundation_owner}`.

Column ACL `entity_id`: `{mass_core_owner=a/mass_foundation_owner}`.

Column ACL `operation`: `{mass_core_owner=a/mass_foundation_owner}`.

Column ACL `change_metadata`: `{mass_core_owner=a/mass_foundation_owner}`.

Column ACL `actor_user_id`: `{mass_core_owner=a/mass_foundation_owner}`.

### mass_foundation.import_batches

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `import_batches_insert` | a | `mass_foundation_ingestor` | `none` | `true` |
| `import_batches_read` | r | `mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor` | `true` | `none` |
| `import_batches_update` | w | `mass_foundation_ingestor` | `true` | `true` |

Table ACL: `{mass_foundation_owner=arwdDxtm/mass_foundation_owner,mass_foundation_ingestor=r/mass_foundation_owner,mass_foundation_reviewer=r/mass_foundation_owner,mass_foundation_auditor=r/mass_foundation_owner}`.

Column ACL `id`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `mapping_version`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `extractor_version`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `state`: `{mass_foundation_ingestor=w/mass_foundation_owner}`.

Column ACL `checkpoint_position`: `{mass_foundation_ingestor=w/mass_foundation_owner}`.

Column ACL `extracted_count`: `{mass_foundation_ingestor=w/mass_foundation_owner}`.

Column ACL `accepted_count`: `{mass_foundation_ingestor=w/mass_foundation_owner}`.

Column ACL `quarantined_count`: `{mass_foundation_ingestor=w/mass_foundation_owner}`.

Column ACL `excluded_count`: `{mass_foundation_ingestor=w/mass_foundation_owner}`.

### mass_foundation.import_exceptions

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `import_exceptions_insert` | a | `mass_foundation_ingestor` | `none` | `true` |
| `import_exceptions_read` | r | `mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor` | `true` | `none` |
| `import_exceptions_review` | w | `mass_foundation_reviewer` | `true` | `true` |

Table ACL: `{mass_foundation_owner=arwdDxtm/mass_foundation_owner,mass_foundation_ingestor=r/mass_foundation_owner,mass_foundation_reviewer=r/mass_foundation_owner,mass_foundation_auditor=r/mass_foundation_owner}`.

Column ACL `id`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `batch_id`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `source_row_id`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `field_ordinal`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `reason_code`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `review_state`: `{mass_foundation_reviewer=w/mass_foundation_owner}`.

Column ACL `resolution_code`: `{mass_foundation_reviewer=w/mass_foundation_owner}`.

### mass_foundation.source_files

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `source_files_insert` | a | `mass_foundation_ingestor` | `none` | `true` |
| `source_files_read` | r | `mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor` | `true` | `none` |

Table ACL: `{mass_foundation_owner=arwdDxtm/mass_foundation_owner,mass_foundation_ingestor=r/mass_foundation_owner,mass_foundation_reviewer=r/mass_foundation_owner,mass_foundation_auditor=r/mass_foundation_owner}`.

Column ACL `id`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `original_file_id`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `sha256`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `storage_ref`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `source_version`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

Column ACL `exported_at`: `{mass_foundation_ingestor=a/mass_foundation_owner}`.

### mass_foundation.source_rows

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `source_rows_insert` | a | `mass_foundation_ingestor` | `none` | `true` |
| `source_rows_read` | r | `mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor` | `true` | `none` |

Table ACL: `{mass_foundation_owner=arwdDxtm/mass_foundation_owner,mass_foundation_ingestor=ar/mass_foundation_owner,mass_foundation_reviewer=r/mass_foundation_owner,mass_foundation_auditor=r/mass_foundation_owner}`.

### mass_foundation.source_sheets

| Policy | Command | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| `source_sheets_insert` | a | `mass_foundation_ingestor` | `none` | `true` |
| `source_sheets_read` | r | `mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor` | `true` | `none` |

Table ACL: `{mass_foundation_owner=arwdDxtm/mass_foundation_owner,mass_foundation_ingestor=ar/mass_foundation_owner,mass_foundation_reviewer=r/mass_foundation_owner,mass_foundation_auditor=r/mass_foundation_owner}`.

## Function boundary

| Function / identity arguments | Returns | Definer | Settings | ACL |
| --- | --- | --- | --- | --- |
| `mass_api.add_enrolment(p_child uuid, p_centre uuid, p_grade text, p_shift text, p_start date, p_status text)` | `uuid` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.add_morarji_member(p_enrolment uuid, p_cohort uuid)` | `uuid` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.attendance_summary(p_centre uuid, p_from date, p_until date)` | `TABLE(present_count bigint, absent_count bigint, leave_count bigint, excluded_count bigint, percentage numeric)` | False | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.close_enrolment(p_id uuid, p_expected bigint, p_ends_before date, p_status text)` | `bigint` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.create_activity(p_id uuid, p_centre uuid, p_shift text, p_date date, p_name text)` | `uuid` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.list_students(p_centre uuid, p_on date)` | `TABLE(child_id uuid, student_id text, enrolment_id uuid, grade_label text, shift_code text, full_name text, row_version bigint)` | False | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.record_assessment(p_enrolment uuid, p_definition uuid, p_date date, p_score numeric, p_expected bigint)` | `uuid` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.record_attendance(p_enrolment uuid, p_date date, p_code text, p_expected bigint)` | `uuid` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.record_morarji(p_member uuid, p_applied boolean, p_attended boolean, p_passed boolean, p_school text, p_expected bigint)` | `uuid` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.record_participation(p_enrolment uuid, p_event uuid, p_participated boolean, p_expected bigint)` | `uuid` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_api.register_student(p_centre uuid, p_grade text, p_shift text, p_start date, p_name text, p_gender text)` | `TABLE(child_id uuid, student_id text, enrolment_id uuid)` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.can_read(c uuid)` | `boolean` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.can_read_child(c uuid)` | `boolean` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.can_read_profile(c uuid)` | `boolean` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.can_write(c uuid)` | `boolean` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.can_write_child(c uuid)` | `boolean` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.expected_version(actual bigint, expected bigint)` | `void` | False | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner}` |
| `mass_core.guard_record()` | `trigger` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner}` |
| `mass_core.period_contains(p uuid, d date)` | `boolean` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.record_audit()` | `trigger` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner}` |
| `mass_core.request_user_id()` | `uuid` | False | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner,authenticated=X/mass_core_owner}` |
| `mass_core.writable_enrolment(e uuid)` | `mass_core.enrolments` | True | `search_path=pg_catalog` | `{mass_core_owner=X/mass_core_owner}` |
| `mass_foundation.guard_batch()` | `trigger` | False | `search_path=pg_catalog` | `{mass_foundation_owner=X/mass_foundation_owner}` |
| `mass_foundation.guard_exception()` | `trigger` | False | `search_path=pg_catalog` | `{mass_foundation_owner=X/mass_foundation_owner}` |
| `mass_foundation.record_audit()` | `trigger` | True | `search_path=pg_catalog` | `{mass_foundation_owner=X/mass_foundation_owner}` |
| `mass_foundation.reject_mutation()` | `trigger` | False | `search_path=pg_catalog` | `{mass_foundation_owner=X/mass_foundation_owner}` |

ACL notation: r SELECT, a INSERT, w UPDATE, d DELETE, D TRUNCATE, x REFERENCES, t TRIGGER, X EXECUTE. PostgreSQL owner rights and role inheritance must also be reviewed; NULL ACL text is not proof of no rights. Foundation helpers use explicit PUBLIC EXECUTE revokes (a schema-local default revoke alone does not remove global function defaults). Core-owner global function defaults revoke PUBLIC EXECUTE. Check effective privileges on the real target, including service_role inheritance and grant options.

Exact constraints, trigger definitions, indexes and default ACLs are retained in DATABASE-SCHEMA-INVENTORY.json; their executable implementation is the 15 migrations. The existing 207 tests exercise allowed/denied roles, forced RLS, invalid signatures, centre isolation, profile masking, immutable metadata, transactional audit and expected-version conflicts. Actual managed Auth sessions and hosted migration-role/ownership grants remain unverified.
