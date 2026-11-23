-- The trusted reconciliation gate must detect drift without exposing identities
-- or scope details to browser roles.
RESET ROLE;
SET ROLE mass_core_admin;
SELECT core_test.assert_true((mass_core.permission_scope_reconciliation_summary()->>'users')::int=6,'all synthetic grant holders are reconciled');
SELECT core_test.assert_true((mass_core.permission_scope_reconciliation_summary()->>'mismatches')::int=0,'legacy and governed scopes initially match');
SELECT mass_core.assert_permission_scope_reconciled();

UPDATE mass_core.user_centre_assignments SET status='Inactive',row_version=row_version+1
WHERE user_id='00000000-0000-4000-8000-000000000001' AND centre_id='10000000-0000-4000-8000-000000000001';
SELECT core_test.assert_true((mass_core.permission_scope_reconciliation_summary()->>'mismatches')::int=1,'assignment drift is detected');
SELECT core_test.assert_true((mass_core.permission_scope_reconciliation_summary()->>'missing_centre_links')::int=1,'missing governed centre is counted');
SELECT core_test.expect_error($q$SELECT mass_core.assert_permission_scope_reconciled()$q$,'P0001','scope assertion blocks an unreconciled cutover');
UPDATE mass_core.user_centre_assignments SET status='Active',row_version=row_version+1
WHERE user_id='00000000-0000-4000-8000-000000000001' AND centre_id='10000000-0000-4000-8000-000000000001';
SELECT mass_core.assert_permission_scope_reconciled();

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.expect_error($q$SELECT mass_core.permission_scope_reconciliation_summary()$q$,'42501','browser cannot execute governance reconciliation');
RESET ROLE;
