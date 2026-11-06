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
-- Verified assignments are synthetic and installed ONLY in this isolated DB.
INSERT INTO mass_core.officer_assignments(id,scope_grant_id,directory_assignment_id,starts_on,ends_before,shift_scope,verification_reference)
SELECT '58000000-0000-4000-8000-000000000001',id,'57000000-0000-4000-8000-000000000003','2026-04-01','2027-04-01','Both shifts','Synthetic verified administrator reference'
FROM mass_core.user_scope_grants WHERE user_id='00000000-0000-4000-8000-000000000003';
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT mass_api.record_assessment(core_test.id('A2'),'22000000-0000-4000-8000-000000000001',NULL,7,0);
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_api.read_assessments('10000000-0000-4000-8000-000000000001','2026-04-01','2026-07-01')),'period read includes quarter-only and exact-date results');
SELECT mass_api.record_assessment(core_test.id('A2'),'22000000-0000-4000-8000-000000000001',NULL,8,1);
SELECT core_test.assert_true((SELECT assessed_on IS NULL AND score=8 AND row_version=2 FROM mass_core.assessment_results WHERE enrolment_id=core_test.id('A2')),'quarter-only correction retains NULL date and version');
SELECT core_test.expect_error($q$SELECT mass_api.record_assessment(core_test.id('A2'),'22000000-0000-4000-8000-000000000001','2026-04-12',8,2)$q$,'55000','NULL exact date cannot be silently fabricated');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance_batch(jsonb_build_array(jsonb_build_object('enrolment',core_test.id('A2'),'date','2026-04-20','code','P','expected',0),jsonb_build_object('enrolment',core_test.id('A2'),'date','2026-04-21','code','X','expected',0)))$q$,'23503','atomic batch rejects invalid code');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.attendance_records WHERE attendance_date='2026-04-20'),'failed batch leaves no partial attendance');
SELECT mass_api.record_attendance_batch(jsonb_build_array(jsonb_build_object('enrolment',core_test.id('A2'),'date','2026-04-20','code','L','expected',0)));
SELECT core_test.assert_true((SELECT code='L' FROM mass_core.attendance_records WHERE attendance_date='2026-04-20'),'explicit bulk mark persists');
SELECT mass_api.correct_profile((SELECT child_id FROM core_test.ids WHERE label='A2'),1,'Synthetic corrected profile',NULL,NULL);
SELECT core_test.assert_true(mass_api.read_profile_revision((SELECT child_id FROM core_test.ids WHERE label='A2'))=2,'profile correction version increments');
SELECT core_test.expect_error($q$SELECT mass_api.correct_profile((SELECT child_id FROM core_test.ids WHERE label='A2'),1,'Synthetic stale profile','Boy',NULL)$q$,'PT409','stale profile correction denied');
SELECT mass_api.record_calendar('10000000-0000-4000-8000-000000000001','Morning','2026-05-01',true,'59000000-0000-4000-8000-000000000001');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_core.cac_sessions WHERE session_date='2026-05-01'),'calendar authority UUID persists');
SELECT mass_api.register_student_once('59100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic idempotent learner',NULL);
SELECT mass_api.register_student_once('59100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic idempotent learner',NULL);
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_core.private_child_profiles WHERE full_name='Synthetic idempotent learner'),'same registration request creates one student');
SELECT core_test.expect_error($q$SELECT * FROM mass_core.registration_requests$q$,'42501','registration receipts private');
SELECT core_test.expect_error($q$SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000001','Morning','2026-10-01','Completed','Synthetic feedback','',0)$q$,'42501','Teacher cannot record officer visits');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',false);
SELECT core_test.assert_true(jsonb_array_length(mass_api.get_visit_assignments())=1,'verified CO discovers dated assignment');
SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000001','Morning','2026-10-01','Completed','Synthetic feedback','',0);
SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000001','Morning','2026-10-01','Completed','Synthetic feedback','',0);
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_api.read_visits('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01')),'identical duplicate visit request creates one row');
SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000001','Morning','2026-10-01','Completed','Synthetic correction','Synthetic follow-up',1,'Synthetic correction reason');
SELECT core_test.assert_true((SELECT count(*)=2 AND max(revision)=2 FROM mass_api.read_visit_history('60000000-0000-4000-8000-000000000001')),'visit history records previous/new versions');
SELECT core_test.expect_error($q$SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000001','Morning','2026-10-01','Completed','Synthetic stale','',1,'Synthetic reason')$q$,'PT409','stale visit correction denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000002','58000000-0000-4000-8000-000000000001','Morning','2026-10-02','Completed','','',0)$q$,'23514','completed visit requires feedback');
SELECT core_test.expect_error($q$SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000002','58000000-0000-4000-8000-000000000001','Morning',current_date+1,'Completed','Synthetic feedback','',0)$q$,'23514','future completed visit denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000002','58000000-0000-4000-8000-000000000001','Morning','2027-04-01','Completed','Synthetic feedback','',0)$q$,'42501','assignment exclusive end enforced');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.read_visits('10000000-0000-4000-8000-000000000002','2026-10-01','2026-11-01')$q$,'42501','cross-centre visit details denied');
SELECT core_test.expect_error($q$DELETE FROM mass_core.cluster_officer_visits$q$,'42501','no direct visit delete');
SELECT mass_api.record_visit(('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'58000000-0000-4000-8000-000000000001','Morning','2026-10-02','Completed','Synthetic feedback','',0) FROM generate_series(2,4)n;
SELECT core_test.assert_true((SELECT morning=4 AND evening=0 AND NOT achieved FROM mass_api.visit_summary('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01')),'four morning and zero evening do not achieve target');
SELECT mass_api.record_visit(('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'58000000-0000-4000-8000-000000000001','Evening','2026-10-03','Completed','Synthetic feedback','',0) FROM generate_series(5,6)n;
SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000007','58000000-0000-4000-8000-000000000001','Evening','2026-10-04','Planned','','',0);
SELECT core_test.assert_true((SELECT morning=4 AND evening=2 AND achieved AND recorded_count=7 FROM mass_api.visit_summary('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01')),'completed counts uncapped; planned not counted; both shifts qualify');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',false);
SELECT core_test.assert_true((SELECT morning=4 AND evening=2 FROM mass_api.visit_summary('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01')),'Leadership receives scoped aggregates');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.read_visits('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01')$q$,'42501','Leadership cannot read private visit notes');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.read_visit_history('60000000-0000-4000-8000-000000000001')$q$,'42501','Leadership cannot read private revision snapshots');
SELECT core_test.expect_error($q$SELECT mass_api.record_visit('60000000-0000-4000-8000-000000000008','58000000-0000-4000-8000-000000000001','Morning','2026-10-01','Completed','Synthetic feedback','',0)$q$,'42501','Leadership cannot write visits');
RESET ROLE;
SELECT core_test.assert_true((SELECT count(*)=8 FROM mass_foundation.audit_events WHERE entity_type='core.cluster_officer_visits'),'minimized framework audit records every visit revision');
SELECT core_test.assert_true((SELECT bool_and(change_metadata-'revision'='{}'::jsonb) FROM mass_foundation.audit_events WHERE entity_type='core.cluster_officer_visits'),'technical audit never contains feedback');
SELECT core_test.assert_true((SELECT bool_and(NOT has_function_privilege('anon',oid,'EXECUTE') AND NOT has_function_privilege('service_role',oid,'EXECUTE')) FROM pg_proc WHERE pronamespace='mass_api'::regnamespace),'all RPC anonymous/service grants remain closed');
SET ROLE anon;
SELECT core_test.expect_error('SELECT mass_api.get_visit_assignments()','42501','anonymous visit discovery denied');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT mass_api.record_activity_detail('61000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-21','Synthetic observed activity','Sports','Planned',0);
SELECT core_test.expect_error($q$SELECT mass_api.record_participation(core_test.id('A2'),'61000000-0000-4000-8000-000000000001',true,0)$q$,'23514','planned activity rejects observed participation');
SELECT mass_api.record_activity_detail('61000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-21','Synthetic observed activity','Sports','Held',1);
SELECT mass_api.record_participation(core_test.id('A2'),'61000000-0000-4000-8000-000000000001',true,0);
SELECT core_test.expect_error($q$SELECT mass_api.record_activity_detail('61000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-21','Synthetic observed activity','Sports','Cancelled',2)$q$,'23514','cancelled activity cannot erase participation context');
SELECT mass_api.record_cac_delivery('62000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-22','Held',0);
SELECT core_test.assert_true((SELECT status='Held' AND row_version=1 FROM mass_api.read_delivery('10000000-0000-4000-8000-000000000001','2026-04-01','2026-05-01')),'observed delivery is distinct from scheduling');
SELECT core_test.expect_error($q$SELECT mass_api.record_cac_delivery('62000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Morning','2026-04-08','Held',0)$q$,'23514','confirmed holiday cannot be marked held');
SELECT core_test.expect_error($q$SELECT mass_api.record_cac_delivery('62000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-22','Cancelled',0)$q$,'PT409','stale delivery correction denied');
SELECT core_test.expect_error($q$SELECT mass_api.programme_aggregate('10000000-0000-4000-8000-000000000002','2026-04-01','2026-04-01','2026-05-01','20000000-0000-4000-8000-000000000001')$q$,'42501','aggregate cannot widen centre scope');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',false);
SELECT core_test.assert_true((mass_api.programme_aggregate('10000000-0000-4000-8000-000000000001','2026-04-01','2026-04-01','2026-05-01','20000000-0000-4000-8000-000000000001')->>'students')::integer=3,'Leadership aggregate reconciles distinct eligible people');
SELECT core_test.assert_true((mass_api.programme_aggregate('10000000-0000-4000-8000-000000000001','2026-04-01','2026-04-01','2026-05-01','20000000-0000-4000-8000-000000000001',NULL,NULL,'Girl')->>'students')::integer=1,'gender scope is server-side and profile-restricted');
SELECT core_test.assert_true(NOT mass_api.programme_aggregate('10000000-0000-4000-8000-000000000001','2026-04-01','2026-04-01','2026-05-01','20000000-0000-4000-8000-000000000001')::text LIKE '%Synthetic%','aggregate contains no names or note content');
RESET ROLE;
BEGIN;
GRANT authenticated TO service_role;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',true);
SELECT core_test.expect_error('SELECT mass_api.get_visit_assignments()','42501','BYPASSRLS role cannot inherit the staff RPC contract');
RESET ROLE;
ROLLBACK;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
INSERT INTO core_test.ids SELECT 'TRANSFER',child_id,enrolment_id FROM mass_api.register_student('10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic transfer learner',NULL);
SELECT mass_api.transfer_student((SELECT child_id FROM core_test.ids WHERE label='TRANSFER'),core_test.id('TRANSFER'),1,1,'Synthetic transfer learner',NULL,NULL,'2026-06-01','10000000-0000-4000-8000-000000000001','2','Evening','2026-06-01');
SELECT core_test.assert_true((SELECT count(*)=2 AND count(DISTINCT child_id)=1 FROM mass_core.enrolments WHERE child_id=(SELECT child_id FROM core_test.ids WHERE label='TRANSFER')),'transfer preserves UUID and both verified episodes');
SELECT core_test.assert_true((SELECT starts_on='2026-04-01' AND ends_before='2026-06-01' AND grade_label='1' FROM mass_core.enrolments WHERE id=core_test.id('TRANSFER')),'transfer never retags historical grade/start');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.expect_error((SELECT format('SELECT mass_api.record_assessment_batch(%L::jsonb)',jsonb_agg(jsonb_build_object('enrolment',enrolment_id,'definition',definition_id,'date',assessed_on,'score',CASE WHEN n=1 THEN 10 ELSE 26 END,'expected',row_version) ORDER BY n)) FROM (SELECT a.*,row_number() OVER(ORDER BY enrolment_id) n FROM mass_core.assessment_results a WHERE definition_id='22000000-0000-4000-8000-000000000001')x),'23514','assessment batch rolls back a valid correction preceding an invalid score');
SELECT core_test.assert_true((SELECT sum(score)=8 AND bool_and(row_version=2) FROM mass_core.assessment_results WHERE definition_id='22000000-0000-4000-8000-000000000001'),'failed assessment batch leaves scores and revisions unchanged');
SELECT core_test.expect_error($q$SELECT mass_api.transfer_student((SELECT child_id FROM core_test.ids WHERE label='TRANSFER'),(SELECT id FROM mass_core.enrolments WHERE child_id=(SELECT child_id FROM core_test.ids WHERE label='TRANSFER') AND ends_before IS NULL),2,1,'Synthetic failed transfer correction',NULL,NULL,'2026-08-01','10000000-0000-4000-8000-000000000002','3','Morning','2026-08-01')$q$,'42501','transfer cannot cross into unauthorized destination');
SELECT core_test.assert_true((SELECT full_name='Synthetic transfer learner' AND row_version=2 FROM mass_core.private_child_profiles WHERE child_id=(SELECT child_id FROM core_test.ids WHERE label='TRANSFER')),'failed transfer rolls back profile correction');
RESET ROLE;
