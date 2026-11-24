-- Historical evidence does not grant login access or operational authority.
BEGIN;
GRANT REFERENCES(id) ON mass_foundation.source_files TO mass_core_owner;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_import.historical_officer_assignments(
 id uuid PRIMARY KEY,
 reporting_month date NOT NULL CHECK(extract(day FROM reporting_month)=1),
 officer_id uuid NOT NULL REFERENCES mass_core.staff_members(id) ON DELETE RESTRICT,
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 confirmed_officer_name text NOT NULL CHECK(length(btrim(confirmed_officer_name)) BETWEEN 1 AND 200),
 confirmed_centre_name text NOT NULL CHECK(length(btrim(confirmed_centre_name)) BETWEEN 1 AND 200),
 source_row_id uuid NOT NULL REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 review_file_id uuid NOT NULL REFERENCES mass_foundation.source_files(id) ON DELETE RESTRICT,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 review_sha256 text NOT NULL CHECK(review_sha256 ~ '^[0-9a-f]{64}$'),
 payload_hmac text NOT NULL CHECK(payload_hmac ~ '^[0-9a-f]{64}$'),
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 imported_by name NOT NULL DEFAULT session_user,
 UNIQUE(reporting_month,officer_id,centre_id),
 UNIQUE(id,reporting_month,officer_id,centre_id,source_sha256,review_sha256)
);
COMMENT ON TABLE mass_import.historical_officer_assignments IS 'Officer-centre evidence for a reporting month. Not employment start/end dates, login access, or operational scope.';
CREATE TABLE mass_import.historical_officer_visits(
 id uuid PRIMARY KEY,
 assignment_id uuid NOT NULL,
 reporting_month date NOT NULL,
 officer_id uuid NOT NULL,
 centre_id uuid NOT NULL,
 source_row_id uuid NOT NULL UNIQUE REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 review_sha256 text NOT NULL CHECK(review_sha256 ~ '^[0-9a-f]{64}$'),
 payload_hmac text NOT NULL CHECK(payload_hmac ~ '^[0-9a-f]{64}$'),
 visit_date date NOT NULL,
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),
 remarks text CHECK(length(remarks)<=2000),
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 imported_by name NOT NULL DEFAULT session_user,
 CHECK(visit_date>=reporting_month AND visit_date<(reporting_month+interval '1 month')::date),
 FOREIGN KEY(assignment_id,reporting_month,officer_id,centre_id,source_sha256,review_sha256)
  REFERENCES mass_import.historical_officer_assignments(id,reporting_month,officer_id,centre_id,source_sha256,review_sha256) ON DELETE RESTRICT,
 UNIQUE(officer_id,centre_id,visit_date,shift_code)
);
COMMENT ON TABLE mass_import.historical_officer_visits IS 'Dated source visit entries. No invented author, completion status or feedback. Blank remarks remain unknown.';
CREATE INDEX historical_visit_assignment_fk ON mass_import.historical_officer_visits(assignment_id,reporting_month,officer_id,centre_id,source_sha256,review_sha256);
CREATE INDEX historical_assignment_officer_fk ON mass_import.historical_officer_assignments(officer_id);
CREATE INDEX historical_assignment_centre_fk ON mass_import.historical_officer_assignments(centre_id);
CREATE INDEX historical_assignment_source_fk ON mass_import.historical_officer_assignments(source_row_id);
CREATE INDEX historical_assignment_review_fk ON mass_import.historical_officer_assignments(review_file_id);
CREATE INDEX historical_visit_scope ON mass_import.historical_officer_visits(centre_id,visit_date,shift_code);
CREATE FUNCTION mass_import.guard_historical_officer_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Historical visit evidence is immutable';END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_rows r JOIN mass_foundation.source_sheets s ON s.id=r.sheet_id JOIN mass_foundation.source_files f ON f.id=s.file_id WHERE r.id=NEW.source_row_id AND f.sha256=NEW.source_sha256) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Visit source fingerprint mismatch';END IF;
 IF TG_TABLE_NAME='historical_officer_assignments' THEN
  IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_files f WHERE f.id=NEW.review_file_id AND f.sha256=NEW.review_sha256) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Visit review fingerprint mismatch';END IF;
 ELSE
  IF NEW.visit_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Historical visit cannot be future';END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION mass_import.guard_historical_officer_evidence() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_import.guard_historical_officer_evidence() TO mass_data_importer;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['historical_officer_assignments','historical_officer_visits'] LOOP
 EXECUTE format('ALTER TABLE mass_import.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE mass_import.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON mass_import.%I FROM PUBLIC,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT,INSERT ON mass_import.%I TO mass_data_importer',t);
 EXECUTE format('CREATE POLICY history_owner_read ON mass_import.%I FOR SELECT TO mass_core_owner USING(true)',t);
 EXECUTE format('CREATE POLICY history_import_read ON mass_import.%I FOR SELECT TO mass_data_importer USING(true)',t);
 EXECUTE format('CREATE POLICY history_import_append ON mass_import.%I FOR INSERT TO mass_data_importer WITH CHECK(true)',t);
 EXECUTE format('CREATE TRIGGER history_validate BEFORE INSERT OR UPDATE OR DELETE ON mass_import.%I FOR EACH ROW EXECUTE FUNCTION mass_import.guard_historical_officer_evidence()',t);
 EXECUTE format('CREATE TRIGGER history_no_truncate BEFORE TRUNCATE ON mass_import.%I FOR EACH STATEMENT EXECUTE FUNCTION mass_import.guard_historical_officer_evidence()',t);
END LOOP;END;$$;
RESET ROLE;
COMMIT;
