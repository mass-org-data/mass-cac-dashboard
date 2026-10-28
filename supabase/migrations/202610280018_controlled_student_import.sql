-- Explicit administrative import capability, never an application/staff grant.
BEGIN;
SET LOCAL createrole_self_grant = '';
CREATE ROLE mass_data_importer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
-- No permanent membership is installed. The trusted deployment administrator
-- grants SET-only membership inside each import transaction and revokes it there.
SET LOCAL ROLE mass_foundation_owner;
GRANT USAGE ON SCHEMA mass_foundation TO mass_data_importer;
GRANT SELECT ON mass_foundation.source_rows,mass_foundation.source_sheets,mass_foundation.source_files TO mass_data_importer;
CREATE POLICY admin_import_reference_rows ON mass_foundation.source_rows FOR SELECT TO mass_data_importer USING(true);
CREATE POLICY admin_import_reference_sheets ON mass_foundation.source_sheets FOR SELECT TO mass_data_importer USING(true);
CREATE POLICY admin_import_reference_files ON mass_foundation.source_files FOR SELECT TO mass_data_importer USING(true);
GRANT REFERENCES(id) ON mass_foundation.source_rows TO mass_core_owner;
RESET ROLE;
CREATE SCHEMA mass_import AUTHORIZATION mass_core_owner;
SET LOCAL ROLE mass_core_owner;
REVOKE ALL ON SCHEMA mass_import FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA mass_import,mass_core TO mass_data_importer;
CREATE TABLE mass_import.receipts (
 source_row_id uuid NOT NULL REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 source_slot integer NOT NULL CHECK(source_slot>0),
 target_table text NOT NULL CHECK(target_table IN ('children','private_child_profiles','enrolments','attendance_records','assessment_results','cohort_memberships','morarji_outcomes')),
 target_id uuid NOT NULL,
 payload_hmac text NOT NULL CHECK(payload_hmac ~ '^[0-9a-f]{64}$'),
 staging_sha256 text NOT NULL CHECK(staging_sha256 ~ '^[0-9a-f]{64}$'),
 assumed_enrolment_dates boolean NOT NULL DEFAULT false,
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 imported_by name NOT NULL DEFAULT session_user,
 PRIMARY KEY(source_row_id,source_slot,target_table),
 UNIQUE(target_table,target_id)
);
ALTER TABLE mass_import.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_import.receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_import.receipts FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY importer_read ON mass_import.receipts FOR SELECT TO mass_data_importer USING(true);
CREATE POLICY importer_append ON mass_import.receipts FOR INSERT TO mass_data_importer WITH CHECK(true);
REVOKE ALL ON mass_import.receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON mass_import.receipts TO mass_data_importer;
GRANT INSERT(source_row_id,source_slot,target_table,target_id,payload_hmac,staging_sha256,assumed_enrolment_dates) ON mass_import.receipts TO mass_data_importer;
CREATE TRIGGER receipts_immutable BEFORE UPDATE OR DELETE ON mass_import.receipts FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER receipts_no_truncate BEFORE TRUNCATE ON mass_import.receipts FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
-- Dedicated insert-only administrative policies. Existing owner/application
-- policies, can_write(), user_scope_grants and runtime Auth are not changed.
DO $policies$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['children','private_child_profiles','enrolments','attendance_records','assessment_results','cohort_memberships','morarji_outcomes','academic_years','assessment_periods','assessment_definitions','programme_cohorts'] LOOP
  EXECUTE format('CREATE POLICY admin_import_read ON mass_core.%I FOR SELECT TO mass_data_importer USING(true)',t);
  EXECUTE format('CREATE POLICY admin_import_append ON mass_core.%I FOR INSERT TO mass_data_importer WITH CHECK(true)',t);
  EXECUTE format('GRANT SELECT,INSERT ON mass_core.%I TO mass_data_importer',t);
 END LOOP;
END;
$policies$;
GRANT SELECT(id,label,donor_id) ON mass_core.centres TO mass_data_importer;
GRANT SELECT(id,label) ON mass_core.donors TO mass_data_importer;
CREATE POLICY admin_import_read ON mass_core.centres FOR SELECT TO mass_data_importer USING(true);
CREATE POLICY admin_import_read ON mass_core.donors FOR SELECT TO mass_data_importer USING(true);
-- DROP EXPRESSION retains every existing value and the unique constraint.
-- No UPDATE of a child's UUID/display ID is allowed by the existing guard.
ALTER TABLE mass_core.children ALTER COLUMN student_id DROP EXPRESSION;
ALTER TABLE mass_core.children ALTER COLUMN student_id SET NOT NULL;
CREATE FUNCTION mass_core.next_student_id(p_centre uuid,p_grade text) RETURNS text
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE prefix text; sequence_number bigint;
BEGIN
 IF p_grade IS NULL OR p_grade !~ '^(10|[1-9])$' THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='approved grade required'; END IF;
 SELECT left(upper(regexp_replace(label,'[^A-Za-z]','','g')),2) INTO prefix FROM mass_core.centres WHERE id=p_centre;
 IF prefix IS NULL OR prefix !~ '^[A-Z]{2}$' THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='verified centre prefix required'; END IF;
 -- Transaction-level lock shared across all centres with this prefix and grade.
 -- Selecting the persisted maximum avoids nontransactional sequence consumption.
 PERFORM pg_advisory_xact_lock(hashtextextended('mass.student.'||prefix||'.'||p_grade,0));
 SELECT coalesce(max(substring(student_id FROM '[0-9]+$')::bigint),0)+1 INTO sequence_number
 FROM mass_core.children WHERE student_id ~ ('^ST_'||prefix||'_'||p_grade||'_[0-9]+$');
 RETURN 'ST_'||prefix||'_'||p_grade||'_'||lpad(sequence_number::text,greatest(2,length(sequence_number::text)), '0');
END;
$$;
REVOKE ALL ON FUNCTION mass_core.next_student_id(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_core.next_student_id(uuid,text) TO mass_data_importer;
-- Same signature, Auth check, ownership, execution ACL and transaction behavior.
CREATE OR REPLACE FUNCTION mass_api.register_student(p_centre uuid,p_grade text,p_shift text,p_start date,p_name text,p_gender text)
 RETURNS TABLE(child_id uuid,student_id text,enrolment_id uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid; e uuid; display text;
BEGIN
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 display:=mass_core.next_student_id(p_centre,p_grade);
 INSERT INTO mass_core.children(student_id) VALUES(display) RETURNING id INTO c;
 INSERT INTO mass_core.private_child_profiles(child_id,full_name,gender_code) VALUES(c,p_name,p_gender);
 INSERT INTO mass_core.enrolments(child_id,centre_id,grade_label,shift_code,starts_on,status_code)
 VALUES(c,p_centre,p_grade,p_shift,p_start,'Active') RETURNING id INTO e;
 RETURN QUERY SELECT c,display,e;
END;
$$;
COMMIT;
