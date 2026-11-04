-- SYNTHETIC, ISOLATED PG17 ONLY. Not a production seed or migration.
SET statement_timeout='60s';
INSERT INTO auth.users(id) VALUES('80000000-0000-4000-8000-000000000001');
SET ROLE mass_core_admin;
INSERT INTO mass_core.centres(id,label) SELECT md5('synthetic-load-centre-'||i)::uuid,'Synthetic load centre '||i FROM generate_series(1,92)i;
INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at,can_read_profiles) SELECT '80000000-0000-4000-8000-000000000001',id,'Teacher','2000-01-01','80000000-0000-4000-8000-000000000001','2000-01-01',true FROM mass_core.centres;
INSERT INTO mass_core.academic_years(id,starts_on) VALUES('80000000-0000-4000-8000-000000000002','2026-04-01');
INSERT INTO mass_core.assessment_periods(id,academic_year_id,quarter) SELECT md5('synthetic-load-quarter-'||q)::uuid,'80000000-0000-4000-8000-000000000002',q FROM generate_series(1,2)q;
INSERT INTO mass_core.assessment_definitions(period_id) SELECT id FROM mass_core.assessment_periods;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001"}',false);
DO $$DECLARE i int;BEGIN FOR i IN 1..1500 LOOP
 PERFORM mass_api.register_student(md5('synthetic-load-centre-'||(1+(i-1)%92))::uuid,(1+(i-1)%10)::text,CASE WHEN i%2=0 THEN 'Morning' ELSE 'Evening' END,'2026-04-01','Synthetic load learner '||i,CASE WHEN i%3=0 THEN NULL WHEN i%3=1 THEN 'Girl' ELSE 'Boy' END);
END LOOP;END;$$;
RESET ROLE;
SET ROLE mass_core_owner;
INSERT INTO mass_core.cac_sessions(centre_id,shift_code,session_date,is_scheduled,confirmation_ref) SELECT c.id,s,d::date,extract(isodow FROM d)<>7,'80000000-0000-4000-8000-000000000003' FROM mass_core.centres c CROSS JOIN unnest(ARRAY['Morning','Evening'])s CROSS JOIN generate_series('2026-10-01'::date,'2026-10-31'::date,interval '1 day')d;
INSERT INTO mass_core.attendance_records(child_id,centre_id,shift_code,enrolment_id,attendance_date,code) SELECT e.child_id,e.centre_id,e.shift_code,e.id,d::date,CASE WHEN extract(isodow FROM d)=7 THEN 'WO' WHEN extract(day FROM d)::int%5=0 THEN 'L' WHEN extract(day FROM d)::int%4=0 THEN 'A' ELSE 'P' END FROM mass_core.enrolments e CROSS JOIN generate_series('2026-10-01'::date,'2026-10-31'::date,interval '1 day')d;
INSERT INTO mass_core.assessment_results(child_id,centre_id,shift_code,enrolment_id,definition_id,assessed_on,score) SELECT e.child_id,e.centre_id,e.shift_code,e.id,d.id,NULL,(row_number() OVER(ORDER BY e.id,d.id))%26 FROM mass_core.enrolments e CROSS JOIN mass_core.assessment_definitions d;
RESET ROLE;
ANALYZE mass_core.enrolments;ANALYZE mass_core.private_child_profiles;ANALYZE mass_core.attendance_records;ANALYZE mass_core.cac_sessions;ANALYZE mass_core.assessment_results;
CREATE TABLE core_test.timings(case_name text,jit_setting text,run int,elapsed_ms numeric,children int);
GRANT INSERT,SELECT ON core_test.timings TO authenticated;
SET ROLE authenticated;
DO $$DECLARE t timestamptz;r jsonb;ids uuid[];i int;scenario text;jit_mode text;BEGIN
 SELECT array_agg(id ORDER BY id) INTO ids FROM mass_core.centres;
 FOREACH jit_mode IN ARRAY ARRAY['on','off'] LOOP
 PERFORM set_config('jit',jit_mode,false);
 FOREACH scenario IN ARRAY ARRAY['all92','one_centre','grade_shift_gender'] LOOP FOR i IN 1..5 LOOP
  t:=clock_timestamp();r:=mass_api.reviewed_chart_metrics(CASE WHEN scenario='one_centre' THEN ids[1:1] ELSE ids END,'2026-10-31','2026-10-01','2026-11-01','80000000-0000-4000-8000-000000000002',CASE WHEN scenario='grade_shift_gender' THEN '5' END,CASE WHEN scenario='grade_shift_gender' THEN 'Evening' END,CASE WHEN scenario='grade_shift_gender' THEN 'Girl' END);
  INSERT INTO core_test.timings VALUES(scenario,jit_mode,i,1000*extract(epoch FROM clock_timestamp()-t),(r->>'children')::int);
  IF scenario='all92' AND (r->>'children')::int<>1500 THEN RAISE EXCEPTION 'load calculation population mismatch';END IF;
 END LOOP;END LOOP;END LOOP;
END;$$;
RESET ROLE;
SELECT 'PERFORMANCE '||jsonb_build_object('synthetic_students',(SELECT count(*) FROM mass_core.children),'centres',92,'attendance_rows',(SELECT count(*) FROM mass_core.attendance_records),'assessment_rows',(SELECT count(*) FROM mass_core.assessment_results),'cases',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT case_name,jit_setting,count(*) runs,round(min(elapsed_ms),2) min_ms,round(avg(elapsed_ms),2) mean_ms,round(max(elapsed_ms),2) max_ms FROM core_test.timings GROUP BY case_name,jit_setting ORDER BY case_name,jit_setting)x),'boundary','Isolated synthetic PG17 timing; not a hosted/network SLA')::text;
