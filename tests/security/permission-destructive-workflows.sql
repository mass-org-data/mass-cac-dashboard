-- Phase 5 destructive workflows. Synthetic records only; every change rolls back.
BEGIN;
CREATE TABLE core_test.phase5(key text PRIMARY KEY,value text);
GRANT SELECT,INSERT,UPDATE,DELETE ON core_test.phase5 TO authenticated;

SET LOCAL ROLE mass_core_owner;
UPDATE mass_activation.features SET enabled=true,approval_reference='isolated Phase 5 test' WHERE feature IN ('attendance_entry','assessment_entry','visit_entry','student_deletion');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);

-- Direct deletion stays unavailable even for an otherwise authorized Teacher.
SELECT core_test.expect_error($q$DELETE FROM mass_core.attendance_records$q$,'42501','direct attendance deletion remains blocked');

INSERT INTO core_test.phase5
SELECT 'attendance_id',id::text FROM mass_core.attendance_records WHERE enrolment_id=core_test.id('A') ORDER BY attendance_date LIMIT 1;
INSERT INTO core_test.phase5
SELECT 'attendance_version',row_version::text FROM mass_core.attendance_records WHERE id=(SELECT value::uuid FROM core_test.phase5 WHERE key='attendance_id');
SELECT mass_api.delete_attendance_record('71000000-0000-4000-8000-000000000001',(SELECT value::uuid FROM core_test.phase5 WHERE key='attendance_id'),(SELECT value::bigint FROM core_test.phase5 WHERE key='attendance_version'),'Reviewed removal');
SELECT mass_api.delete_attendance_record('71000000-0000-4000-8000-000000000001',(SELECT value::uuid FROM core_test.phase5 WHERE key='attendance_id'),(SELECT value::bigint FROM core_test.phase5 WHERE key='attendance_version'),'Reviewed removal');
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_core.attendance_records WHERE id=(SELECT value::uuid FROM core_test.phase5 WHERE key='attendance_id')),'individual attendance delete is idempotent');

INSERT INTO core_test.phase5 SELECT 'assessment_exact',id::text FROM mass_core.assessment_results WHERE enrolment_id=core_test.id('A');
SELECT core_test.expect_error($q$SELECT mass_api.delete_assessment_record('71000000-0000-4000-8000-000000000002',(SELECT value::uuid FROM core_test.phase5 WHERE key='assessment_exact'),1,'Reviewed removal')$q$,'PT409','stale assessment version prevents deletion');
SELECT mass_api.delete_assessment_record('71000000-0000-4000-8000-000000000003',(SELECT value::uuid FROM core_test.phase5 WHERE key='assessment_exact'),2,'Reviewed removal');
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_core.assessment_results WHERE id=(SELECT value::uuid FROM core_test.phase5 WHERE key='assessment_exact')),'individual assessment deletion succeeds with current version');

-- NULL is an explicit historical register key, never a wildcard or invented date.
INSERT INTO core_test.phase5
SELECT 'unknown_token',mass_api.preview_assessment_register_deletion('10000000-0000-4000-8000-000000000001','Morning','22000000-0000-4000-8000-000000000001',NULL)->>'token';
SELECT mass_api.delete_assessment_register('71000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Morning','22000000-0000-4000-8000-000000000001',NULL,(SELECT value FROM core_test.phase5 WHERE key='unknown_token'),'Reviewed register removal');
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_core.assessment_results WHERE enrolment_id=core_test.id('A2') AND assessed_on IS NULL),'unknown-date assessment register deletion targets only NULL dates');

-- Teacher cannot delete visits. A second CO can delete a visit made by the first
-- CO when the centre is in their active scope.
SELECT core_test.expect_error($q$SELECT mass_api.delete_visit('71000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000002',1,'Reviewed removal')$q$,'42501','Teacher cannot delete visits');
SET LOCAL ROLE mass_core_admin;
INSERT INTO mass_core.application_users(user_id,role_code,status,starts_at,approval_reference,approved_by,approved_at)
VALUES('00000000-0000-4000-8000-000000000006','Cluster Officer','Active','2000-01-01','Synthetic Phase 5 test','00000000-0000-4000-8000-000000000006',statement_timestamp());
INSERT INTO mass_core.user_centre_assignments(user_id,centre_id,status,starts_at,approval_reference,approved_by,approved_at)
VALUES('00000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Active','2000-01-01','Synthetic Phase 5 test','00000000-0000-4000-8000-000000000006',statement_timestamp());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006"}',true);
SELECT mass_api.delete_visit('71000000-0000-4000-8000-000000000006','60000000-0000-4000-8000-000000000002',1,'Reviewed removal');
SET LOCAL ROLE mass_core_owner;
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_core.cluster_officer_visits WHERE id='60000000-0000-4000-8000-000000000002'),'CO deletes another CO visit in an assigned centre');

-- Only Leadership can preview or execute a student cascade.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.expect_error($q$SELECT mass_api.preview_student_deletion((SELECT child_id FROM core_test.ids WHERE label='A'))$q$,'42501','Teacher cannot preview student deletion');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);

-- A new dependency fails closed before any row is removed.
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.synthetic_unreviewed_student_dependency(id uuid PRIMARY KEY,child_id uuid REFERENCES mass_core.children(id));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SELECT core_test.expect_error($q$SELECT mass_api.preview_student_deletion((SELECT child_id FROM core_test.ids WHERE label='A'))$q$,'55000','unexpected dependency blocks the cascade');
SELECT core_test.assert_true(EXISTS(SELECT 1 FROM mass_core.children WHERE id=(SELECT child_id FROM core_test.ids WHERE label='A')),'blocked cascade leaves the student intact');
SET LOCAL ROLE mass_core_owner;
DROP TABLE mass_core.synthetic_unreviewed_student_dependency;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);

-- Monthly source history participates in the same reviewed cascade and token.
RESET ROLE;
INSERT INTO mass_foundation.import_batches(id,mapping_version,extractor_version) VALUES('81000000-0000-4000-8000-000000000001','synthetic-monthly','synthetic');
INSERT INTO mass_foundation.source_files(id,sha256,storage_ref) VALUES('81000000-0000-4000-8000-000000000002',repeat('a',64),'81000000-0000-4000-8000-000000000003');
INSERT INTO mass_foundation.source_sheets(id,file_id,ordinal,classification,header_version) VALUES('81000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000002',1,'input',1);
INSERT INTO mass_foundation.source_rows(id,sheet_id,first_batch_id,row_number,content_hash) VALUES('81000000-0000-4000-8000-000000000005','81000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001',5,repeat('b',64));
INSERT INTO mass_import.monthly_activity_history(source_row_id,source_sha256,payload_hmac,reporting_month,child_id,enrolment_id,centre_id,shift_code,grade_label,cultural_1,cultural_2,sports_1,sports_2)
SELECT '81000000-0000-4000-8000-000000000005',repeat('a',64),repeat('c',64),(date_trunc('month',e.starts_on)+interval '1 month')::date,e.child_id,e.id,e.centre_id,e.shift_code,e.grade_label,true,false,NULL,false
FROM mass_core.enrolments e WHERE e.child_id=(SELECT child_id FROM core_test.ids WHERE label='A') AND (e.ends_before IS NULL OR e.ends_before>=(date_trunc('month',e.starts_on)+interval '2 months')::date) ORDER BY e.starts_on LIMIT 1;
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_import.monthly_activity_history),'synthetic monthly history inserted');
SET ROLE authenticated;
SELECT core_test.assert_true((mass_api.preview_student_deletion((SELECT child_id FROM core_test.ids WHERE label='A'))->'counts'->>'monthly_activity_history')::int=1,'monthly history is included in deletion confirmation');
INSERT INTO core_test.phase5 SELECT 'student_token',mass_api.preview_student_deletion((SELECT child_id FROM core_test.ids WHERE label='A'))->>'token';
SELECT core_test.expect_error($q$SELECT mass_api.delete_student_cascade('71000000-0000-4000-8000-000000000007',(SELECT child_id FROM core_test.ids WHERE label='A'),'stale-token','Reviewed student removal')$q$,'PT409','stale student token prevents deletion');
SELECT core_test.assert_true(EXISTS(SELECT 1 FROM mass_core.children WHERE id=(SELECT child_id FROM core_test.ids WHERE label='A')),'stale token leaves the complete graph intact');
INSERT INTO core_test.phase5 SELECT 'activity_count',count(*)::text FROM mass_core.activity_events;
INSERT INTO core_test.phase5 SELECT 'cohort_count',count(*)::text FROM mass_core.programme_cohorts;
SELECT mass_api.delete_student_cascade('71000000-0000-4000-8000-000000000008',(SELECT child_id FROM core_test.ids WHERE label='A'),(SELECT value FROM core_test.phase5 WHERE key='student_token'),'Reviewed student removal');
SELECT mass_api.delete_student_cascade('71000000-0000-4000-8000-000000000008',(SELECT child_id FROM core_test.ids WHERE label='A'),(SELECT value FROM core_test.phase5 WHERE key='student_token'),'Reviewed student removal');
RESET ROLE;
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_import.monthly_activity_history),'reviewed student cascade removes monthly history');
SET ROLE authenticated;
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_core.children WHERE id=(SELECT child_id FROM core_test.ids WHERE label='A')),'Leadership cascade deletes the student atomically and retry is idempotent');
SELECT core_test.assert_true((SELECT count(*)=(SELECT value::bigint FROM core_test.phase5 WHERE key='activity_count') FROM mass_core.activity_events) AND (SELECT count(*)=(SELECT value::bigint FROM core_test.phase5 WHERE key='cohort_count') FROM mass_core.programme_cohorts),'shared activities and cohorts survive student deletion');
SET LOCAL ROLE mass_core_owner;
SELECT core_test.assert_true((SELECT bool_and((impact_counts::text||target_context::text||reason) NOT LIKE '%Synthetic%' AND impact_counts::text NOT LIKE '%score%' AND impact_counts::text NOT LIKE '%feedback%') FROM mass_core.deletion_receipts),'deletion receipts contain no names, scores, marks or visit notes');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SELECT core_test.expect_error('SELECT * FROM mass_core.deletion_receipts','42501','deletion receipts remain private');

ROLLBACK;
