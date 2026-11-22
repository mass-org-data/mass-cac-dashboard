-- Phase 8 retirement checks. Every temporary mutation rolls back.
BEGIN;

SELECT core_test.assert_true(
 NOT has_any_column_privilege('authenticated','mass_core.user_scope_grants','SELECT')
 AND NOT has_function_privilege('authenticated','mass_core.staff_operational_enabled()','EXECUTE'),
 'browser roles cannot discover legacy grants or execute the retired override');
SELECT core_test.assert_true(
 NOT has_table_privilege('mass_core_admin','mass_core.user_scope_grants','INSERT,UPDATE,DELETE')
 AND NOT has_table_privilege('mass_core_admin','mass_core.staff_operational_access','INSERT,UPDATE,DELETE'),
 'operator role cannot recreate legacy authorization');
SELECT core_test.assert_true(
 (SELECT count(*)>0 AND bool_and(governed_assignment_id IS NOT NULL) FROM mass_core.officer_assignments),
 'every historical officer assignment has a governed link');
SELECT core_test.assert_true(
 (SELECT count(*)>0 FROM mass_core.user_scope_grants),
 'legacy grant rows remain retained as rollback evidence');
SELECT core_test.assert_true(
 NOT EXISTS(
  SELECT 1 FROM pg_proc p
  WHERE p.oid IN (
   'mass_api.get_visit_assignments()'::regprocedure,
   'mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text)'::regprocedure,
   'mass_core.guard_visit()'::regprocedure
  ) AND (position('user_scope_grants' IN p.prosrc)>0 OR position('scope_grant_id' IN p.prosrc)>0)
 ),'visit runtime functions contain no legacy authorization dependency');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',true);
SELECT core_test.assert_true(jsonb_array_length(mass_api.get_visit_assignments())=1,
 'Cluster Officer visit assignments use the governed account-centre link');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SELECT core_test.assert_true(jsonb_array_length(mass_api.get_visit_assignments())>=1,
 'Leadership inherits governed visit assignment access');
SELECT core_test.expect_error($q$SELECT * FROM mass_core.user_scope_grants$q$,'42501',
 'authenticated cannot query retained legacy evidence');

SET LOCAL ROLE mass_core_admin;
SELECT core_test.expect_error($q$
 INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at)
 VALUES('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Cluster Officer',clock_timestamp(),'00000000-0000-4000-8000-000000000006',clock_timestamp())
$q$,'42501','operator cannot create a legacy scope grant');

SET LOCAL ROLE mass_core_owner;
SELECT core_test.expect_error($q$
 INSERT INTO mass_core.officer_assignments(scope_grant_id,governed_assignment_id,directory_assignment_id,starts_on,shift_scope,verification_reference)
 SELECT g.id,a.id,'57000000-0000-4000-8000-000000000003','2098-01-01','Both shifts','Synthetic legacy-link rejection'
 FROM mass_core.user_scope_grants g
 JOIN mass_core.user_centre_assignments a ON a.user_id=g.user_id AND a.centre_id=g.centre_id
 WHERE g.user_id='00000000-0000-4000-8000-000000000003' AND g.centre_id='10000000-0000-4000-8000-000000000001'
 LIMIT 1
$q$,'23514','new officer assignments reject legacy scope links');
INSERT INTO mass_core.officer_assignments(governed_assignment_id,directory_assignment_id,starts_on,shift_scope,verification_reference)
SELECT a.id,'57000000-0000-4000-8000-000000000003','2098-01-01','Both shifts','Synthetic governed-link acceptance'
FROM mass_core.user_centre_assignments a
WHERE a.user_id='00000000-0000-4000-8000-000000000003' AND a.centre_id='10000000-0000-4000-8000-000000000001' AND a.status='Active';
SELECT core_test.assert_true(
 (SELECT count(*)=1 FROM mass_core.officer_assignments WHERE starts_on='2098-01-01' AND scope_grant_id IS NULL),
 'new officer assignments use only the governed link');

ROLLBACK;
