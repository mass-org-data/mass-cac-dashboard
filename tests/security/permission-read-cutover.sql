-- Phase 3: governed reads, one role, current-student identity and immediate
-- assignment deactivation. All data added here rolls back.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.assert_true(mass_core.application_role()='Teacher' AND mass_core.role_at_least('Teacher') AND NOT mass_core.role_at_least('Cluster Officer'),'Teacher hierarchy is server-derived');
SELECT core_test.assert_true(mass_core.can_read('10000000-0000-4000-8000-000000000001') AND NOT mass_core.can_read('10000000-0000-4000-8000-000000000002'),'Teacher read scope uses the governed assignment');
SELECT core_test.assert_true(mass_api.get_context()->>'role'='Teacher' AND mass_api.get_context()->>'authorization_model'='single-role-v1','context exposes one authoritative role');
SELECT core_test.assert_true(jsonb_array_length(mass_api.get_context()->'roles')=1 AND jsonb_array_length(mass_api.get_context()->'centres')=1,'context cannot expose a role union');
SELECT core_test.assert_true((mass_api.get_context()#>>'{capabilities,read_profiles}')::boolean,'profile visibility is a role capability, not a grant flag');

INSERT INTO core_test.ids(label,child_id,enrolment_id)
SELECT 'former',child_id,enrolment_id FROM mass_api.register_student('10000000-0000-4000-8000-000000000001','3','Morning','2026-04-01','Synthetic former learner','Girl');
SELECT mass_api.close_enrolment((SELECT enrolment_id FROM core_test.ids WHERE label='former'),1,'2026-08-01','Left programme');
SELECT core_test.assert_true(NOT mass_core.can_read_profile((SELECT child_id FROM core_test.ids WHERE label='former')),'former student identity is not readable by current centre staff');
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_api.read_students('10000000-0000-4000-8000-000000000001') s WHERE s.child_id=(SELECT child_id FROM core_test.ids WHERE label='former')),'current Teacher roster excludes former students');
SELECT core_test.assert_true(NOT (mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-07-01')->'ids') ? ((SELECT enrolment_id FROM core_test.ids WHERE label='former')::text),'historical date cannot recover a former profile for Teacher');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SELECT core_test.assert_true(mass_api.get_context()->>'role'='Leadership' AND jsonb_array_length(mass_api.get_context()->'roles')=1,'Leadership context has one role');
SELECT core_test.assert_true(jsonb_array_length(mass_api.get_context()->'centres')=2 AND mass_core.can_read('10000000-0000-4000-8000-000000000001') AND mass_core.can_read('10000000-0000-4000-8000-000000000002'),'Leadership derives all centres without assignment rows');
SELECT core_test.assert_true(mass_core.can_read_profile((SELECT child_id FROM core_test.ids WHERE label='former')),'Leadership can read historical student identity');
SELECT core_test.assert_true(EXISTS(SELECT 1 FROM mass_api.read_students('10000000-0000-4000-8000-000000000001','2026-07-01') s WHERE s.child_id=(SELECT child_id FROM core_test.ids WHERE label='former') AND s.full_name='Synthetic former learner'),'Leadership historical profile read retains identifiable details');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000008"}',true);
SELECT core_test.assert_true(mass_api.get_context()->>'role'='Leadership' AND jsonb_array_length(mass_api.get_context()->'roles')=1,'legacy mixed-role account resolves to one governed role');

SET LOCAL ROLE mass_core_admin;
UPDATE mass_core.user_centre_assignments SET status='Inactive',row_version=row_version+1 WHERE user_id='00000000-0000-4000-8000-000000000001' AND status='Active';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.assert_true(NOT mass_core.can_read('10000000-0000-4000-8000-000000000001') AND NOT mass_core.can_write('10000000-0000-4000-8000-000000000001'),'inactive assignment immediately removes reads and transitional writes');
SELECT core_test.assert_true(jsonb_array_length(mass_api.get_context()->'centres')=0,'inactive assignment disappears from context immediately');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007"}',true);
SELECT core_test.expect_error($q$SELECT mass_api.get_context()$q$,'42501','inactive application user has no context');
ROLLBACK;
