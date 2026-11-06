-- No real identities, user grants or source workbooks.
SELECT core_test.assert_true(NOT (SELECT rolcanlogin OR rolbypassrls OR rolsuper FROM pg_roles WHERE rolname='mass_data_importer'),'import role cannot login or bypass RLS');
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE m.roleid='mass_data_importer'::regrole AND r.rolname IN ('anon','authenticated','service_role')),'application principals cannot assume importer');
SELECT core_test.assert_true(NOT has_table_privilege('mass_data_importer','mass_core.user_scope_grants','INSERT') AND NOT has_table_privilege('mass_data_importer','mass_core.staff_members','INSERT'),'import role cannot provision people or staff scope');
SELECT core_test.assert_true(NOT has_table_privilege('mass_data_importer','mass_core.enrolments','UPDATE') AND NOT has_table_privilege('mass_data_importer','mass_core.children','DELETE'),'import role is insert-only');
SELECT core_test.assert_true(NOT has_schema_privilege('authenticated','mass_import','USAGE') AND NOT has_schema_privilege('service_role','mass_import','USAGE'),'receipts private to migration administrators');
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('mass_core','mass_foundation','mass_import') AND c.relkind='r' AND NOT(c.relrowsecurity AND c.relforcerowsecurity)),'all application and import tables retain forced RLS');
BEGIN;
GRANT mass_data_importer TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE mass_data_importer;
SELECT core_test.expect_error('INSERT INTO mass_core.user_scope_grants DEFAULT VALUES','42501','importer cannot invent authorization');
SELECT core_test.expect_error('UPDATE mass_core.children SET student_id=student_id','42501','importer cannot modify existing IDs');
SELECT core_test.expect_error('TRUNCATE mass_core.enrolments','42501','importer cannot truncate');
INSERT INTO mass_core.children(id,student_id) VALUES('81000000-0000-4000-8000-000000000001','ST_SY_1_99');
SELECT core_test.assert_true(mass_core.next_student_id('10000000-0000-4000-8000-000000000001','1')='ST_SY_1_100','sequence grows beyond two digits');
SELECT core_test.assert_true(mass_core.next_student_id('10000000-0000-4000-8000-000000000002','1')='ST_SY_1_100','same prefix and class share sequence across centres');
SELECT core_test.assert_true(mass_core.next_student_id('10000000-0000-4000-8000-000000000002','2')='ST_SY_2_01','classes use distinct sequence buckets');
RESET ROLE;
ROLLBACK;
BEGIN;
GRANT mass_data_importer TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE mass_data_importer;
INSERT INTO mass_core.children(id,student_id) VALUES('82000000-0000-4000-8000-000000000001','ST_SY_3_01');
INSERT INTO mass_core.enrolments(id,child_id,centre_id,grade_label,shift_code,starts_on,ends_before,status_code)
 VALUES('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','3','Morning','2026-04-01','2027-04-01','Active');
INSERT INTO mass_core.assessment_results(child_id,centre_id,shift_code,enrolment_id,definition_id,assessed_on,score)
 VALUES('82000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','83000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001',NULL,25);
SELECT core_test.assert_true((SELECT assessed_on IS NULL FROM mass_core.assessment_results WHERE child_id='82000000-0000-4000-8000-000000000001'),'documented period preserves missing date as NULL');
INSERT INTO mass_core.children(id,student_id) VALUES('82000000-0000-4000-8000-000000000002','ST_SY_3_02');
INSERT INTO mass_core.enrolments(id,child_id,centre_id,grade_label,shift_code,starts_on,ends_before,status_code)
 VALUES('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','3','Morning','2026-05-01','2027-04-01','Active');
SELECT core_test.expect_error($q$INSERT INTO mass_core.assessment_results(child_id,centre_id,shift_code,enrolment_id,definition_id,assessed_on,score) VALUES('82000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Morning','83000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001',NULL,20)$q$,'23514','period-only score requires full enrolment containment');
RESET ROLE;
SELECT core_test.expect_error($q$UPDATE mass_core.enrolments SET ends_before='2026-06-15' WHERE id='83000000-0000-4000-8000-000000000001'$q$,'23514','closure cannot invalidate a period-only result');
ROLLBACK;
SELECT core_test.assert_true(NOT pg_has_role(current_user,'mass_data_importer','MEMBER') OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'aborted transaction restores temporary membership');
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_core.children WHERE id='81000000-0000-4000-8000-000000000001'),'aborted ID reservation leaves no child');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.expect_error('SELECT mass_core.next_student_id(''10000000-0000-4000-8000-000000000001'',''1'')','42501','staff cannot call allocator directly');
SELECT core_test.assert_true((SELECT student_id ~ '^ST_SY_1_[0-9]{2,}$' FROM mass_api.register_student('10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic new identity','Girl')),'normal registration uses new ID through existing Auth check');
SELECT core_test.expect_error('SELECT mass_api.register_student(''10000000-0000-4000-8000-000000000002'',''1'',''Morning'',''2026-04-01'',''Synthetic denied'',''Girl'')','42501','registration retains centre-level authorization');
RESET ROLE;
SELECT core_test.expect_error('UPDATE mass_core.children SET student_id=''ST_ZZ_1_01''','55000','permanent ID remains immutable after generator change');
ROLLBACK;
