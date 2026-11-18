-- Synthetic checks for the additive single-role governance foundation.
RESET ROLE;
SET ROLE mass_core_admin;
INSERT INTO mass_core.application_users(user_id,role_code,status,starts_at,ends_at,approval_reference,approved_by,approved_at) VALUES
 ('00000000-0000-4000-8000-000000000001','Teacher','Active','1999-01-01','2001-01-01','Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01'),
 ('00000000-0000-4000-8000-000000000003','Cluster Officer','Active','1999-01-01',NULL,'Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01'),
 ('00000000-0000-4000-8000-000000000004','Leadership','Active','1999-01-01',NULL,'Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01');
INSERT INTO mass_core.user_centre_assignments(user_id,centre_id,status,starts_at,ends_at,approval_reference,approved_by,approved_at) VALUES
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Active','1999-01-01','2001-01-01','Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01'),
 ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Active','1999-01-01',NULL,'Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01'),
 ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Active','1999-01-01',NULL,'Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01');
SELECT core_test.expect_error($q$
 INSERT INTO mass_core.user_centre_assignments(user_id,centre_id,status,starts_at,approval_reference,approved_by,approved_at)
 VALUES('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Active','1999-01-01','Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01')
$q$,'23514','Teacher cannot receive a second active centre');
SELECT core_test.expect_error($q$
 INSERT INTO mass_core.user_centre_assignments(user_id,centre_id,status,starts_at,approval_reference,approved_by,approved_at)
 VALUES('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Active','1999-01-01','Synthetic governance test','00000000-0000-4000-8000-000000000006','2000-01-01')
$q$,'23514','Leadership cannot receive centre assignment rows');

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.assert_true(mass_core.application_role()='Teacher','single Teacher role is server-derived');
SELECT core_test.assert_true(mass_core.governed_can_read('10000000-0000-4000-8000-000000000001'),'active status authorizes even when administrative dates are historical');
SELECT core_test.assert_true(NOT mass_core.governed_can_read('10000000-0000-4000-8000-000000000002'),'Teacher remains centre scoped');
SELECT core_test.expect_error($q$SELECT * FROM mass_core.application_users$q$,'42501','browser cannot read governance tables directly');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',false);
SELECT core_test.assert_true(mass_core.application_role()='Cluster Officer','single Cluster Officer role is server-derived');
SELECT core_test.assert_true(mass_core.governed_can_write('10000000-0000-4000-8000-000000000001') AND mass_core.governed_can_write('10000000-0000-4000-8000-000000000002'),'Cluster Officer receives every active assigned centre');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',false);
SELECT core_test.assert_true(mass_core.application_role()='Leadership','single Leadership role is server-derived');
SELECT core_test.assert_true(mass_core.governed_can_read('10000000-0000-4000-8000-000000000001') AND mass_core.governed_can_write('10000000-0000-4000-8000-000000000002') AND mass_core.governed_can_manage_users(),'Leadership receives global capability without assignment rows');

RESET ROLE;
SET ROLE mass_core_admin;
UPDATE mass_core.application_users SET status='Inactive',row_version=row_version+1 WHERE user_id='00000000-0000-4000-8000-000000000003';
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',false);
SELECT core_test.assert_true(mass_core.application_role() IS NULL AND NOT mass_core.governed_can_read('10000000-0000-4000-8000-000000000001'),'inactive user loses governed access immediately');
RESET ROLE;
