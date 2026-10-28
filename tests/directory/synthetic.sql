-- Synthetic directory/provenance only. No real donor, staff or child source data.
SET ROLE mass_foundation_ingestor;
INSERT INTO mass_foundation.source_files(id,sha256,storage_ref) VALUES('51000000-0000-4000-8000-000000000001',repeat('e',64),'51000000-0000-4000-8000-000000000002');
INSERT INTO mass_foundation.source_sheets(id,file_id,ordinal,header_version) VALUES('52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1,1);
INSERT INTO mass_foundation.import_batches(id,mapping_version,extractor_version) VALUES('53000000-0000-4000-8000-000000000001','synthetic-directory-v1','synthetic-v1');
INSERT INTO mass_foundation.source_rows(id,sheet_id,first_batch_id,row_number,content_hash) SELECT
 ('54000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',n,repeat('e',64) FROM generate_series(1,12)n;
RESET ROLE;
SET ROLE mass_core_owner;
INSERT INTO mass_core.donors(id,label,source_label,source_row_id,source_slot) VALUES
 ('55000000-0000-4000-8000-000000000001','Synthetic donor A',' Synthetic donor A ','54000000-0000-4000-8000-000000000001',1),
 ('55000000-0000-4000-8000-000000000002','Synthetic donor B','Synthetic donor B','54000000-0000-4000-8000-000000000002',1);
UPDATE mass_core.centres SET donor_id='55000000-0000-4000-8000-000000000001',donor_source_row_id='54000000-0000-4000-8000-000000000001' WHERE id='10000000-0000-4000-8000-000000000001';
UPDATE mass_core.centres SET donor_id='55000000-0000-4000-8000-000000000002',donor_source_row_id='54000000-0000-4000-8000-000000000002' WHERE id='10000000-0000-4000-8000-000000000002';
INSERT INTO mass_core.staff_members(id,display_name,source_name,source_row_id,source_slot) SELECT
 ('56000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic staff',' Synthetic staff ',('54000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,2 FROM generate_series(1,4)n;
INSERT INTO mass_core.centre_staff_assignments(id,centre_id,staff_member_id,role_code,shift_code,source_row_id,source_slot) VALUES
 ('57000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','Teacher','Morning','54000000-0000-4000-8000-000000000001',2),
 ('57000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000002','Teacher','Evening','54000000-0000-4000-8000-000000000002',2),
 ('57000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000003','Cluster Officer',NULL,'54000000-0000-4000-8000-000000000003',2),
 ('57000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000004','Teacher','Morning','54000000-0000-4000-8000-000000000004',2);
SELECT core_test.assert_true((SELECT count(*)=4 FROM mass_core.staff_members),'same-named staff occurrences are not automatically merged');
SELECT core_test.expect_error($q$UPDATE mass_core.centres SET donor_id='55000000-0000-4000-8000-000000000002' WHERE id='10000000-0000-4000-8000-000000000001'$q$,'55000','conflicting donor never silently overwrites first association');
SELECT core_test.expect_error($q$UPDATE mass_core.centres SET label='Changed' WHERE id='10000000-0000-4000-8000-000000000001'$q$,'55000','original centre label stays immutable');
SELECT core_test.expect_error($q$INSERT INTO mass_core.centre_staff_assignments(centre_id,staff_member_id,role_code,shift_code,source_row_id,source_slot) VALUES('10000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','Teacher','Both','54000000-0000-4000-8000-000000000005',2)$q$,'23514','unverified Both shift cannot become an assignment');
SELECT core_test.expect_error($q$INSERT INTO mass_core.centre_staff_assignments(centre_id,staff_member_id,role_code,source_row_id,source_slot) VALUES('10000000-0000-4000-8000-000000000099','56000000-0000-4000-8000-000000000001','Teacher','54000000-0000-4000-8000-000000000005',2)$q$,'23503','missing centre reference rejected');
SELECT core_test.expect_error($q$UPDATE mass_core.staff_members SET display_name='Changed'$q$,'55000','directory changes require separate reviewed reconciliation');
-- A reviewed import retry targets source occurrence only, never name or arbitrary UUID.
INSERT INTO mass_core.staff_members(display_name,source_name,source_row_id,source_slot)
 VALUES('Synthetic staff',' Synthetic staff ','54000000-0000-4000-8000-000000000001',2)
 ON CONFLICT(source_row_id,source_slot) DO NOTHING;
SELECT core_test.assert_true((SELECT count(*)=4 FROM mass_core.staff_members),'source-occurrence retry creates no duplicate staff');
INSERT INTO mass_core.centre_staff_assignments(centre_id,staff_member_id,role_code,shift_code,source_row_id,source_slot)
 VALUES('10000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000003','Cluster Officer',NULL,'54000000-0000-4000-8000-000000000003',2)
 ON CONFLICT(source_row_id,source_slot,role_code,shift_code) DO NOTHING;
SELECT core_test.assert_true((SELECT count(*)=4 FROM mass_core.centre_staff_assignments),'NULL shift retry also creates no duplicate assignment');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.assert_true((SELECT count(*)=1 AND bool_and(donor_label='Synthetic donor A') FROM mass_api.get_centre_directory()),'teacher discovers only assigned centre donor');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_api.get_centre_directory(NULL,'55000000-0000-4000-8000-000000000002')),'donor filter cannot widen centre scope');
SELECT core_test.assert_true((SELECT count(*)=3 FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001')),'teacher sees only assigned-centre directory');
SELECT core_test.assert_true((SELECT count(*)=1 AND bool_and(shift_code='Morning') FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001','Morning')),'shift filter returns explicit assignment only');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001') WHERE role_code='Cluster Officer' AND shift_code IS NULL),'unknown officer shift remains unknown');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000002')$q$,'42501','other centre staff rejected');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.get_centre_directory('10000000-0000-4000-8000-000000000002')$q$,'42501','explicit other centre directory rejected');
SELECT core_test.expect_error('SELECT source_name FROM mass_core.staff_members','42501','original staff spelling stays private');
SELECT core_test.expect_error('SELECT donor_source_row_id FROM mass_core.centres','42501','source row references not exposed by original centre privileges');
SELECT core_test.expect_error('SELECT * FROM mass_core.donors','42501','no broad donor table grant');
SELECT core_test.assert_true((SELECT count(id)=1 FROM mass_core.donors),'column rights still enforce donor RLS');
SELECT core_test.assert_true((SELECT count(id)=3 FROM mass_core.staff_members),'staff column rights still enforce centre RLS');
SELECT core_test.expect_error('UPDATE mass_core.centres SET donor_id=NULL','42501','application cannot mutate donor association');
SELECT core_test.expect_error('INSERT INTO mass_core.staff_members DEFAULT VALUES','42501','directory row is not application provisioning permission');
SELECT core_test.expect_error('SELECT * FROM mass_api.get_centre_directory(NULL,NULL,101,0)','22023','directory pagination bounded');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001','Both')$q$,'22023','invalid API shift rejected');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',false);
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_api.get_centre_directory()),'Leadership directory stays within explicit assigned centres');
SELECT core_test.assert_true((SELECT bool_and(full_name IS NULL) FROM mass_api.read_students('10000000-0000-4000-8000-000000000001')),'private student fields still masked after 017');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006"}',false);
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_api.get_centre_directory()),'directory names do not grant Auth scopes');
SELECT set_config('request.jwt.claims','{}',false);
SELECT core_test.expect_error('SELECT * FROM mass_api.get_centre_directory()','42501','directory requires managed identity');
RESET ROLE;
SET ROLE anon;
SELECT core_test.expect_error('SELECT * FROM mass_api.get_centre_directory()','42501','anonymous directory denied');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001')$q$,'42501','anonymous staff denied');
RESET ROLE;
SELECT core_test.assert_true((SELECT count(*)=26 AND bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r'),'all 26 tables force RLS');
SELECT core_test.assert_true((SELECT count(*)=78 FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace))),'only six new policies added');
SELECT core_test.assert_true((SELECT count(*)=22 FROM pg_proc WHERE pronamespace='mass_api'::regnamespace),'original twenty plus two read RPCs');
SELECT core_test.assert_true((SELECT count(*)=19 FROM pg_proc WHERE prosecdef AND pronamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace,'mass_api'::regnamespace)),'no new SECURITY DEFINER');
SELECT core_test.assert_true((SELECT bool_and(NOT has_function_privilege('anon',oid,'EXECUTE') AND NOT has_function_privilege('service_role',oid,'EXECUTE')) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace),'API anonymous/service privileges remain closed');
SELECT core_test.assert_true((SELECT count(*)=8 FROM auth.users),'directory import creates no Auth users');
SET ROLE mass_core_owner;
SELECT core_test.expect_error($q$INSERT INTO mass_core.donors(label,source_label,source_row_id,source_slot) VALUES('Synthetic','Synthetic','54000000-0000-4000-8000-000000000099',1)$q$,'23503','directory provenance must reference a real staged row');
SELECT core_test.expect_error($q$INSERT INTO mass_core.staff_members(display_name,source_name,source_row_id,source_slot) VALUES('Different','Different','54000000-0000-4000-8000-000000000001',2)$q$,'23505','same source occurrence with conflicting identity is flagged');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',false);
SELECT core_test.assert_true((SELECT count(*)=3 FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001')),'CO reads only approved centre directory');
SELECT core_test.expect_error('SELECT source_label FROM mass_core.donors','42501','original donor source spelling remains restricted');
RESET ROLE;
BEGIN;
GRANT authenticated TO service_role;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SELECT core_test.expect_error('SELECT * FROM mass_api.get_centre_directory()','42501','service BYPASSRLS role cannot use inherited directory access');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001')$q$,'42501','service BYPASSRLS role cannot use inherited staff API');
RESET ROLE;
ROLLBACK;
BEGIN;
SET ROLE mass_core_admin;
UPDATE mass_core.user_scope_grants SET ends_at='2001-01-01' WHERE user_id='00000000-0000-4000-8000-000000000001';
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_api.get_centre_directory()),'revoked assignments lose donor discovery');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.get_centre_staff('10000000-0000-4000-8000-000000000001')$q$,'42501','revoked assignment loses staff read access');
ROLLBACK;
SELECT core_test.assert_true((SELECT count(*)=174 FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r') AND attnum>0 AND NOT attisdropped),'017 has exactly 174 columns');
SELECT core_test.assert_true((SELECT count(*)=34 FROM pg_constraint WHERE conrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('mass_core'::regnamespace,'mass_foundation'::regnamespace) AND relkind='r') AND contype='f'),'017 has exactly 34 foreign keys');
SET ROLE mass_core_owner;
INSERT INTO mass_core.donors(label,source_label,source_row_id,source_slot) VALUES('Synthetic donor A',' Synthetic donor A ','54000000-0000-4000-8000-000000000001',1) ON CONFLICT(source_row_id,source_slot) DO NOTHING;
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_core.donors),'same reviewed donor source occurrence is retry-safe');
SELECT core_test.assert_true((SELECT row_version=2 FROM mass_core.centres WHERE id='10000000-0000-4000-8000-000000000001'),'first donor association increments existing centre revision');
RESET ROLE;

SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname IN ('anon','service_role') AND c.oid IN ('mass_core.donors'::regclass,'mass_core.staff_members'::regclass,'mass_core.centre_staff_assignments'::regclass) AND (has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))),'new directory tables have no effective anonymous or service-role rights');
