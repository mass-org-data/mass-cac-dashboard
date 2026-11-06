SELECT core_test.assert_true((SELECT bool_and(NOT enabled) FROM mass_activation.features),'all operational flags default disabled');
SELECT core_test.assert_true(NOT has_schema_privilege('authenticated','mass_activation','USAGE'),'staff cannot reach private activation schema');
SELECT core_test.assert_true(NOT has_table_privilege('authenticated','mass_activation.features','UPDATE'),'staff cannot flip activation flags');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001"}',false);
DO $$DECLARE p record;arguments text;n integer:=0;BEGIN
 FOR p IN SELECT proc.* FROM pg_proc proc WHERE proc.pronamespace='mass_api'::regnamespace AND position('-- MASS_ACTIVATION_GUARD_V1' IN proc.prosrc)>0 LOOP
 SELECT string_agg('NULL::'||format_type(t,NULL),',') INTO arguments FROM unnest(p.proargtypes::oid[]) t;
 PERFORM core_test.expect_error(format('SELECT mass_api.%I(%s)',p.proname,arguments),'42501','direct disabled RPC '||p.proname);n:=n+1;
 END LOOP;
 PERFORM core_test.assert_true(n>=15,'all existing and new mutator entry points guarded');
 PERFORM core_test.assert_true((mass_api.get_original_capabilities()->>'activation_control')::int=1,'explicit activation contract');
 PERFORM core_test.assert_true(NOT EXISTS(SELECT 1 FROM jsonb_each(mass_api.get_original_capabilities()->'writes') x WHERE x.value<>'false'::jsonb),'frontend receives no enabled writes');
END;$$;
SELECT core_test.assert_true(jsonb_array_length(mass_api.get_context()->'centres')>0,'existing context reads still work');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_api.read_attendance('90000000-0000-4000-8000-000000000002','2026-04-02','2026-04-03')),'existing scoped attendance reads still work');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_api.read_assessments('90000000-0000-4000-8000-000000000002','2026-04-01','2026-05-01')),'approved assessment reads still work');
SELECT core_test.expect_error('UPDATE mass_activation.features SET enabled=true','42501','authenticated direct control write denied');
SELECT core_test.expect_error('SELECT mass_api.record_attendance_batch(''[]''::jsonb)','42501','batch denied before payload/row evaluation');
RESET ROLE;
SET ROLE anon;
SELECT core_test.expect_error('SELECT mass_api.record_attendance_batch(''[]''::jsonb)','42501','anonymous direct RPC denied');
RESET ROLE;
