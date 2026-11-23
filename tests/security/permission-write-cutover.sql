-- Phase 4: governed hierarchy writes and immediate assignment/user denial.
-- All changes in this test roll back.
BEGIN;
SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.assert_true(mass_core.can_write('10000000-0000-4000-8000-000000000001') AND NOT mass_core.can_write('10000000-0000-4000-8000-000000000002'),'Teacher writes only the governed centre');

SET LOCAL ROLE mass_core_admin;
UPDATE mass_core.user_centre_assignments SET starts_at='2099-01-01',ends_at=NULL,row_version=row_version+1 WHERE user_id='00000000-0000-4000-8000-000000000001' AND status='Active';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.assert_true(mass_core.can_write('10000000-0000-4000-8000-000000000001'),'assignment dates are administrative history, not authorization');

SET LOCAL ROLE mass_core_admin;
UPDATE mass_core.user_centre_assignments SET starts_at='2000-01-01',ends_at='2001-01-01',row_version=row_version+1 WHERE user_id='00000000-0000-4000-8000-000000000001' AND status='Active';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.assert_true(mass_core.can_write('10000000-0000-4000-8000-000000000001'),'expired assignment dates remain history while Active status authorizes');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',true);
SELECT core_test.assert_true(mass_core.can_write('10000000-0000-4000-8000-000000000001') AND mass_core.role_at_least('Teacher'),'Cluster Officer inherits Teacher centre writes');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SELECT core_test.assert_true(mass_core.can_write('10000000-0000-4000-8000-000000000001') AND mass_core.can_write('10000000-0000-4000-8000-000000000002'),'Leadership writes every centre without assignments or override');
SELECT core_test.assert_true((mass_api.get_context()#>>'{capabilities,write_operational}')::boolean AND (SELECT bool_and((x->>'can_write')::boolean) FROM jsonb_array_elements(mass_api.get_context()->'centres') x),'Leadership context advertises governed writes everywhere');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000008"}',true);
SELECT core_test.assert_true(mass_core.can_write('10000000-0000-4000-8000-000000000001') AND mass_core.can_write('10000000-0000-4000-8000-000000000002') AND NOT mass_core.staff_operational_enabled(),'legacy mixed grants and operational override are irrelevant to governed Leadership writes');

SET LOCAL ROLE mass_core_admin;
UPDATE mass_core.user_centre_assignments SET status='Inactive',row_version=row_version+1 WHERE user_id='00000000-0000-4000-8000-000000000003' AND centre_id='10000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',true);
SELECT core_test.assert_true(NOT mass_core.can_write('10000000-0000-4000-8000-000000000001'),'inactive CO assignment immediately removes writes');

SET LOCAL ROLE mass_core_admin;
UPDATE mass_core.application_users SET status='Inactive',row_version=row_version+1 WHERE user_id='00000000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SELECT core_test.assert_true(NOT mass_core.can_write('10000000-0000-4000-8000-000000000001'),'inactive Leadership immediately loses global writes');
SELECT core_test.expect_error($q$SELECT mass_api.get_context()$q$,'42501','inactive Leadership has no application context');

ROLLBACK;
