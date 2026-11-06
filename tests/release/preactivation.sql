-- ISOLATED SYNTHETIC UPGRADE TEST ONLY. Never run against hosted data.
INSERT INTO auth.users(id) VALUES('90000000-0000-4000-8000-000000000001');
SET ROLE mass_core_admin;
INSERT INTO mass_core.centres(id,label) VALUES('90000000-0000-4000-8000-000000000002','Synthetic upgrade centre');
INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at,can_read_profiles) VALUES('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Teacher','2000-01-01','90000000-0000-4000-8000-000000000001','2000-01-01',true);
INSERT INTO mass_core.academic_years(id,starts_on) VALUES('90000000-0000-4000-8000-000000000003','2026-04-01');
INSERT INTO mass_core.assessment_periods(id,academic_year_id,quarter) VALUES('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000003',1);
INSERT INTO mass_core.assessment_definitions(id,period_id) VALUES('90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000004');
RESET ROLE;
CREATE SCHEMA upgrade_test;
CREATE TABLE upgrade_test.student(child_id uuid,student_id text,enrolment_id uuid);
GRANT USAGE ON SCHEMA upgrade_test TO authenticated;
GRANT SELECT,INSERT ON upgrade_test.student TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001"}',false);
INSERT INTO upgrade_test.student SELECT * FROM mass_api.register_student('90000000-0000-4000-8000-000000000002','5','Morning','2026-04-01','Synthetic upgrade learner','Girl');
SELECT mass_api.record_attendance(enrolment_id,'2026-04-02','P',0) FROM upgrade_test.student;
SELECT mass_api.record_attendance(enrolment_id,'2026-04-03','L',0) FROM upgrade_test.student;
SELECT mass_api.record_attendance(enrolment_id,'2026-04-04','A',0) FROM upgrade_test.student;
SELECT mass_api.record_assessment(enrolment_id,'90000000-0000-4000-8000-000000000005','2026-04-12',0,0) FROM upgrade_test.student;
SELECT mass_api.create_activity('90000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000002','Morning','2026-04-11','Synthetic legacy event');
SELECT mass_api.record_participation(enrolment_id,'90000000-0000-4000-8000-000000000006',true,0) FROM upgrade_test.student;
RESET ROLE;
-- Freeze every old table's original columns and values (including audit rows).
-- Appended nullable columns are allowed; rewriting original values is not.
CREATE TABLE upgrade_test.snapshot(table_name text PRIMARY KEY,fields text NOT NULL,checksum text NOT NULL);
DO $$DECLARE r record;fields text;checksum text;BEGIN
 FOR r IN SELECT c.oid,format('%I.%I',n.nspname,c.relname) name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('mass_core','mass_foundation','mass_import') AND c.relkind='r' LOOP
  SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO fields FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped;
  EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,''[]'')) FROM(SELECT %s FROM %s)x',fields,r.name) INTO checksum;
  INSERT INTO upgrade_test.snapshot VALUES(r.name,fields,checksum);
 END LOOP;
END;$$;
