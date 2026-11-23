-- Phase 6 server boundaries. Synthetic records only; no changes persist.
BEGIN;
SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.expect_error($q$
 WITH c AS(SELECT array_agg(id) ids FROM(SELECT id FROM mass_core.centres WHERE mass_core.can_read(id) ORDER BY id LIMIT 1)s)
 SELECT mass_api.attendance_register_page_v2(c.ids,'2025-01-01','2025-01-31',NULL,NULL,NULL,0,11,'date',true,'') FROM c
$q$,'42501','Teacher cannot request export-sized attendance pages');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',true);
SELECT core_test.expect_error($q$
 WITH c AS(SELECT array_agg(id) ids FROM(SELECT id FROM mass_core.centres WHERE mass_core.can_read(id) ORDER BY id LIMIT 1)s)
 SELECT mass_api.dashboard_table_page('visit_centres',c.ids,jsonb_build_object('from','2025-01-01','until','2025-02-01'),'','centre',false,0,11) FROM c
$q$,'42501','Cluster Officer cannot request export-sized dashboard pages');

RESET ROLE;
SELECT core_test.assert_true(position('Leadership export authority required' IN pg_get_functiondef('mass_api.attendance_register_page_v2(uuid[],date,date,text,text,text,integer,integer,text,boolean,text)'::regprocedure))>0,'attendance export authority is server enforced');
SELECT core_test.assert_true(position('Leadership export authority required' IN pg_get_functiondef('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)'::regprocedure))>0,'dashboard export authority is server enforced');
SELECT core_test.assert_true((SELECT position('jsonb_build_object(''id'',x->>''id''' IN prosrc)>0 FROM pg_proc WHERE oid='mass_api.read_attendance_register(uuid,text,date)'::regprocedure),'attendance register exposes the narrow row identity needed for versioned deletion');
ROLLBACK;
