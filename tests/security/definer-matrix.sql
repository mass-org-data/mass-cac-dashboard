-- Isolated synthetic Auth/RLS regression for the nine actual advisor-flagged RPCs.
-- Successful probes roll back their writes and audit rows inside a subtransaction.
SET ROLE mass_core_admin;
INSERT INTO mass_core.programme_cohorts(id,label) SELECT '23000000-0000-4000-8000-000000000024','Synthetic security cohort' WHERE NOT EXISTS(SELECT 1 FROM mass_core.programme_cohorts WHERE id='23000000-0000-4000-8000-000000000024');
RESET ROLE;
CREATE TABLE core_test.definer_cases(name text,own_sql text,foreign_sql text);
INSERT INTO core_test.definer_cases VALUES
('register_student',$q$SELECT mass_api.register_student('10000000-0000-4000-8000-000000000001','5','Morning','2026-04-01','Synthetic security learner',NULL)$q$,$q$SELECT mass_api.register_student('10000000-0000-4000-8000-000000000002','5','Morning','2026-04-01','Synthetic security learner',NULL)$q$),
('add_enrolment',$q$DO $x$BEGIN PERFORM mass_api.close_enrolment(core_test.id('A-new'),(SELECT row_version FROM mass_core.enrolments WHERE id=core_test.id('A-new')),'2026-11-01','Active');PERFORM mass_api.add_enrolment((SELECT child_id FROM core_test.ids WHERE label='A'),'10000000-0000-4000-8000-000000000001','2','Morning','2026-11-01','Active');END;$x$$q$,$q$SELECT mass_api.add_enrolment((SELECT child_id FROM core_test.ids WHERE label='B'),'10000000-0000-4000-8000-000000000001','5','Evening','2026-04-01','Active')$q$),
('close_enrolment',$q$SELECT mass_api.close_enrolment(core_test.id('A-new'),(SELECT row_version FROM mass_core.enrolments WHERE id=core_test.id('A-new')),'2026-11-01','Left programme')$q$,$q$SELECT mass_api.close_enrolment(core_test.id('B'),1,'2026-11-01','Left programme')$q$),
('create_activity',$q$SELECT mass_api.create_activity('78000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-10-01','Synthetic security activity')$q$,$q$SELECT mass_api.create_activity('78000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Morning','2026-10-01','Synthetic security activity')$q$),
('record_attendance',$q$SELECT mass_api.record_attendance(core_test.id('A-new'),'2026-10-20','P',0)$q$,$q$SELECT mass_api.record_attendance(core_test.id('B'),'2026-10-20','P',0)$q$),
('record_assessment',$q$SELECT mass_api.record_assessment(core_test.id('A'),'22000000-0000-4000-8000-000000000001','2026-04-10',7,(SELECT row_version FROM mass_core.assessment_results WHERE enrolment_id=core_test.id('A') AND definition_id='22000000-0000-4000-8000-000000000001'))$q$,$q$SELECT mass_api.record_assessment(core_test.id('B'),'22000000-0000-4000-8000-000000000001','2026-04-10',7,0)$q$),
('record_participation',$q$SELECT mass_api.record_participation(core_test.id('A'),'30000000-0000-4000-8000-000000000001',true,(SELECT row_version FROM mass_core.activity_participation WHERE enrolment_id=core_test.id('A') AND event_id='30000000-0000-4000-8000-000000000001'))$q$,$q$SELECT mass_api.record_participation(core_test.id('B'),'30000000-0000-4000-8000-000000000001',true,0)$q$),
('add_morarji_member',$q$SELECT mass_api.add_morarji_member(core_test.id('A'),'23000000-0000-4000-8000-000000000024')$q$,$q$SELECT mass_api.add_morarji_member(core_test.id('B'),'23000000-0000-4000-8000-000000000024')$q$),
('record_morarji',$q$SELECT mass_api.record_morarji((SELECT m.id FROM mass_core.cohort_memberships m WHERE m.enrolment_id=core_test.id('A') LIMIT 1),true,true,true,'Synthetic security school',(SELECT o.row_version FROM mass_core.morarji_outcomes o JOIN mass_core.cohort_memberships m ON m.id=o.membership_id WHERE m.enrolment_id=core_test.id('A') LIMIT 1))$q$,$q$SELECT mass_api.record_morarji((SELECT id FROM core_test.foreign_member),true,true,true,NULL,0)$q$);
CREATE TABLE core_test.foreign_member(id uuid);
GRANT SELECT,INSERT ON core_test.foreign_member TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002"}',false);
INSERT INTO core_test.foreign_member SELECT mass_api.add_morarji_member(core_test.id('B'),'23000000-0000-4000-8000-000000000024');
RESET ROLE;
-- Resolve own-scope record identifiers/versions before switching to a masked CO.
-- No profile rows/values are exposed by this test-only function.
CREATE FUNCTION core_test.probe(statement text,expected text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text:='00000';BEGIN
 BEGIN EXECUTE statement;RAISE EXCEPTION USING ERRCODE='PZ000',MESSAGE='rollback successful synthetic probe';
 EXCEPTION WHEN SQLSTATE 'PZ000' THEN NULL;WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;END;
 IF actual<>expected THEN RAISE EXCEPTION 'FAIL: %, expected %, got %',label,expected,actual;END IF;
 RAISE NOTICE 'PASS SECURITY: %',label;
END;$$;
GRANT SELECT ON core_test.definer_cases TO PUBLIC;
CREATE TABLE core_test.security_baseline AS SELECT (SELECT count(*) FROM mass_core.children) children,(SELECT count(*) FROM mass_foundation.audit_events) audit;
-- Authenticated principals: actual role decisions remain inside each RPC.
SET ROLE authenticated;
DO $$DECLARE actor record;c record;expected text;BEGIN
 FOR actor IN SELECT * FROM (VALUES(1,'Teacher'),(3,'Cluster Officer'),(4,'Leadership'),(7,'Expired'),(5,'Unassigned'),(2,'Other centre'))a(n,label) LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',('00000000-0000-4000-8000-'||lpad(actor.n::text,12,'0')))::text,false);
  expected:=CASE WHEN actor.n IN(1,3) THEN '00000' ELSE '42501' END;
  FOR c IN SELECT * FROM core_test.definer_cases LOOP
   PERFORM core_test.probe(c.own_sql,expected,c.name||' / '||actor.label);
   IF actor.n IN(1,3) THEN PERFORM core_test.probe(c.foreign_sql,'42501',c.name||' / '||actor.label||' foreign scope');END IF;
  END LOOP;
 END LOOP;
END;$$;
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.probe(own_sql,'42501',name||' / anonymous forged subject') FROM core_test.definer_cases;
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.probe(own_sql,'42501',name||' / service-role forged subject') FROM core_test.definer_cases;
RESET ROLE;
SELECT core_test.assert_true((SELECT children=(SELECT count(*) FROM mass_core.children) AND audit=(SELECT count(*) FROM mass_foundation.audit_events) FROM core_test.security_baseline),'security probes preserve all successful synthetic writes/audit via rollback');
SELECT core_test.assert_true((SELECT count(*)=9 AND bool_and(p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog'] AND pg_get_userbyid(p.proowner)='mass_core_owner' AND has_function_privilege('authenticated',p.oid,'EXECUTE') AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')) FROM core_test.definer_cases c JOIN pg_proc p ON p.proname=c.name JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='mass_api'),'all nine advisor functions retain reviewed definer owner/search path/effective ACL');
-- New profile correction must not turn centre write authority into profile access.
SET ROLE authenticated;
DO $$BEGIN
 IF to_regprocedure('mass_api.correct_profile(uuid,bigint,text,text,boolean)') IS NOT NULL THEN
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',false);
  PERFORM core_test.probe($q$SELECT mass_api.correct_profile((SELECT child_id FROM core_test.ids WHERE label='A'),1,'Synthetic prohibited correction',NULL,NULL)$q$,'42501','correct_profile / CO without profile capability');
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
  PERFORM core_test.probe($q$SELECT mass_api.correct_profile((SELECT child_id FROM core_test.ids WHERE label='B'),1,'Synthetic foreign correction',NULL,NULL)$q$,'42501','correct_profile / foreign child');
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',false);
  PERFORM core_test.probe($q$SELECT mass_api.correct_profile((SELECT child_id FROM core_test.ids WHERE label='A'),1,'Synthetic Leadership correction',NULL,NULL)$q$,'42501','correct_profile / Leadership');
 END IF;
END;$$;
RESET ROLE;
