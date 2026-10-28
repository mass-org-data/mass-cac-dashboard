-- Constructed identities/labels/dates ONLY. No source file or actual child is used.
INSERT INTO auth.users(id) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,8)n;
SET ROLE mass_core_admin;
INSERT INTO mass_core.centres(id,label) VALUES
 ('10000000-0000-4000-8000-000000000001','Synthetic centre A'),('10000000-0000-4000-8000-000000000002','Synthetic centre B');
INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,ends_at,verified_by,verified_at,can_read_profiles) VALUES
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Teacher','2000-01-01',NULL,'00000000-0000-4000-8000-000000000006','2000-01-01',true),
 ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Teacher','2000-01-01',NULL,'00000000-0000-4000-8000-000000000006','2000-01-01',false),
 ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Cluster Officer','2000-01-01',NULL,'00000000-0000-4000-8000-000000000006','2000-01-01',false),
 ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Leadership','2000-01-01',NULL,'00000000-0000-4000-8000-000000000006','2000-01-01',false),
 ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','Leadership','2000-01-01',NULL,'00000000-0000-4000-8000-000000000006','2000-01-01',false),
 ('00000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Teacher','1999-01-01','2000-01-01','00000000-0000-4000-8000-000000000006','2000-01-01',true),
 ('00000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','Leadership','2000-01-01',NULL,'00000000-0000-4000-8000-000000000006','2000-01-01',false),
 ('00000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000002','Teacher','2000-01-01',NULL,'00000000-0000-4000-8000-000000000006','2000-01-01',false);
INSERT INTO mass_core.academic_years(id,starts_on) VALUES('20000000-0000-4000-8000-000000000001','2026-04-01');
INSERT INTO mass_core.assessment_periods(id,academic_year_id,quarter) SELECT
 ('21000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',n FROM generate_series(1,4)n;
INSERT INTO mass_core.assessment_definitions(id,period_id) VALUES('22000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001');
INSERT INTO mass_core.programme_cohorts(id,label) VALUES('23000000-0000-4000-8000-000000000001','Synthetic Morarji cohort');
INSERT INTO mass_core.cac_sessions(centre_id,shift_code,session_date,is_scheduled,confirmation_ref)
 VALUES('10000000-0000-4000-8000-000000000001','Morning','2026-04-08',false,'24000000-0000-4000-8000-000000000001');
RESET ROLE;
SELECT core_test.assert_true((SELECT count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE relnamespace='mass_core'::regnamespace AND relkind='r'),'17 core tables with forced RLS');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
INSERT INTO core_test.ids SELECT 'A',child_id,enrolment_id FROM mass_api.register_student('10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic record','Girl');
INSERT INTO core_test.ids SELECT 'A2',child_id,enrolment_id FROM mass_api.register_student('10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic record','Boy');
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_core.children),'same-name registrations never merge automatically');
SELECT core_test.assert_true((SELECT count(DISTINCT student_id)=2 AND bool_and(student_id=upper(id::text)) FROM mass_core.children),'unique permanent server-generated display IDs');
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_core.private_child_profiles),'explicit profile capability allows assigned-centre profiles');
SELECT core_test.expect_error($q$UPDATE mass_core.children SET id=gen_random_uuid()$q$,'42501','client cannot rewrite identity');
SELECT core_test.expect_error($q$INSERT INTO mass_core.user_scope_grants DEFAULT VALUES$q$,'42501','client cannot grant itself scope');
SELECT core_test.expect_error($q$SELECT mass_api.register_student('10000000-0000-4000-8000-000000000002','1','Morning','2026-04-01','Synthetic record','Girl')$q$,'42501','teacher cannot register in other centre');
SELECT core_test.expect_error($q$SELECT mass_api.register_student('10000000-0000-4000-8000-000000000001','11','Morning','2026-04-01','Synthetic record','Girl')$q$,'23514','unapproved grade rejected atomically');
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_core.children),'failed registration leaves no identity orphan');
SELECT core_test.expect_error($q$SELECT mass_api.add_enrolment((SELECT child_id FROM core_test.ids WHERE label='A'),'10000000-0000-4000-8000-000000000002','2','Morning','2026-07-01','Active')$q$,'42501','transfer requires destination scope');
SELECT mass_api.record_attendance(core_test.id('A'),d,code,0) FROM (VALUES
 ('2026-04-01'::date,'P'),('2026-04-02'::date,'P'),('2026-04-03'::date,'P'),('2026-04-04'::date,'A'),
 ('2026-04-05'::date,'WO'),('2026-04-06'::date,'L'),('2026-04-07'::date,'MM'))v(d,code);
SELECT core_test.assert_true((SELECT present_count=3 AND absent_count=1 AND leave_count=1 AND excluded_count=2 AND percentage=60 FROM mass_api.attendance_summary('10000000-0000-4000-8000-000000000001','2026-04-01','2026-05-01')),'confirmed attendance formula excludes unknown and WO/MM');
SELECT core_test.assert_true((SELECT percentage IS NULL FROM mass_api.attendance_summary('10000000-0000-4000-8000-000000000001','2026-05-01','2026-06-01')),'no recorded denominator produces unknown rate');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-08','P',0)$q$,'23514','present on confirmed holiday rejected');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-09','H',0)$q$,'23503','unapproved H code rejected');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-03-31','P',0)$q$,'23514','attendance before enrolment rejected');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-01','A',0)$q$,'PT409','duplicate create cannot overwrite attendance');
SELECT mass_api.record_assessment(core_test.id('A'),'22000000-0000-4000-8000-000000000001','2026-04-10',25,0);
SELECT core_test.expect_error($q$SELECT mass_api.record_assessment(core_test.id('A2'),'22000000-0000-4000-8000-000000000001','2026-04-10',26,0)$q$,'23514','score above 25 rejected');
SELECT core_test.expect_error($q$SELECT mass_api.record_assessment(core_test.id('A2'),'22000000-0000-4000-8000-000000000001','2026-07-01',20,0)$q$,'23514','assessment outside quarter rejected');
SELECT mass_api.record_assessment(core_test.id('A'),'22000000-0000-4000-8000-000000000001','2026-04-10',0,1);
SELECT core_test.assert_true((SELECT score=0 AND row_version=2 FROM mass_core.assessment_results),'zero is a score and correction creates revision');
SELECT core_test.expect_error($q$SELECT mass_api.record_assessment(core_test.id('A'),'22000000-0000-4000-8000-000000000001','2026-04-10',10,1)$q$,'PT409','stale assessment edit rejected');
SELECT core_test.expect_error($q$SELECT mass_api.record_assessment(core_test.id('A'),'22000000-0000-4000-8000-000000000001','2026-04-11',10,2)$q$,'55000','correction cannot retag historical assessment date');
SELECT mass_api.create_activity('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-11','Synthetic named activity');
SELECT core_test.expect_error($q$SELECT mass_api.create_activity('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-11','Synthetic named activity')$q$,'23505','activity request identity prevents duplicate creation');
SELECT mass_api.record_participation(core_test.id('A'),'30000000-0000-4000-8000-000000000001',NULL,0);
SELECT core_test.assert_true((SELECT participated IS NULL FROM mass_core.activity_participation),'unmarked participation remains unknown');
SELECT mass_api.record_participation(core_test.id('A'),'30000000-0000-4000-8000-000000000001',true,1);
SELECT core_test.expect_error($q$SELECT mass_api.record_participation(core_test.id('A'),'30000000-0000-4000-8000-000000000001',false,1)$q$,'PT409','stale participation correction rejected');
SELECT core_test.expect_error($q$SELECT mass_api.close_enrolment(core_test.id('A'),1,'2026-04-10','Left programme')$q$,'23514','closure cannot invalidate assessment/activity history');
SELECT mass_api.close_enrolment(core_test.id('A'),1,'2026-07-01','Active');
INSERT INTO core_test.ids SELECT 'A-new',(SELECT child_id FROM core_test.ids WHERE label='A'),mass_api.add_enrolment((SELECT child_id FROM core_test.ids WHERE label='A'),'10000000-0000-4000-8000-000000000001','2','Evening','2026-07-01','Active');
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_core.enrolments WHERE child_id=(SELECT child_id FROM core_test.ids WHERE label='A')),'grade/shift change adds verified episode and preserves history');
SELECT core_test.assert_true((SELECT shift_code='Morning' AND grade_label='1' AND ends_before='2026-07-01' FROM mass_core.enrolments WHERE id=core_test.id('A')),'original assignment retains original grade shift and dates');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-07-01','P',0)$q$,'23514','exclusive historical end boundary enforced');
SELECT core_test.expect_error($q$SELECT mass_api.close_enrolment(core_test.id('A'),2,'2026-08-01','Active')$q$,'23514','closed assignment cannot be silently extended');
SELECT mass_api.record_morarji(mass_api.add_morarji_member(core_test.id('A'),'23000000-0000-4000-8000-000000000001'),NULL,true,NULL,'Synthetic school reference',0);
SELECT core_test.assert_true((SELECT applied IS NULL AND attended AND passed IS NULL FROM mass_core.morarji_outcomes),'Morarji preserves flags without unsupported implications');
SELECT core_test.expect_error($q$SELECT mass_api.add_morarji_member(core_test.id('A'),'23000000-0000-4000-8000-000000000001')$q$,'23505','duplicate Morarji membership rejected');
-- All academic boundaries are explicit, independent of frontend F aliases.
DO $$
DECLARE q int; start_date date; end_date date;
BEGIN
 FOR q IN 1..4 LOOP
  start_date:=('2026-04-01'::date+(q-1)*interval '3 months')::date;
  end_date:=('2026-04-01'::date+q*interval '3 months')::date;
  PERFORM core_test.assert_true(mass_core.period_contains(('21000000-0000-4000-8000-'||lpad(q::text,12,'0'))::uuid,start_date),'quarter '||q||' inclusive start');
  PERFORM core_test.assert_true(mass_core.period_contains(('21000000-0000-4000-8000-'||lpad(q::text,12,'0'))::uuid,end_date-1),'quarter '||q||' final day');
  PERFORM core_test.assert_true(NOT mass_core.period_contains(('21000000-0000-4000-8000-'||lpad(q::text,12,'0'))::uuid,end_date),'quarter '||q||' exclusive next-quarter start');
 END LOOP;
END;
$$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',false);
INSERT INTO core_test.ids SELECT 'B',child_id,enrolment_id FROM mass_api.register_student('10000000-0000-4000-8000-000000000002','1','Morning','2026-04-01','Synthetic isolated record','Boy');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_core.children),'teacher B sees only centre B identities');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.attendance_records),'teacher B cannot read centre A attendance');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.private_child_profiles),'centre grant alone does not grant personal-profile access');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-02','A',1)$q$,'42501','cross-centre fact correction denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_participation(core_test.id('B'),'30000000-0000-4000-8000-000000000001',true,0)$q$,'42501','cross-centre event reference denied');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',false);
SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-02','P',1);
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('B'),'2026-04-01','P',0)$q$,'42501','Cluster Officer outside approved scope denied');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.private_child_profiles),'Cluster Officer has no implicit profile permission');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',false);
SELECT core_test.assert_true((SELECT count(*)=3 FROM mass_core.children),'Leadership reads granted programme scope');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.private_child_profiles),'Leadership programme read does not expose personal profiles');
SELECT core_test.expect_error($q$SELECT mass_api.register_student('10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic record','Girl')$q$,'42501','Leadership registration denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-03','A',1)$q$,'42501','Leadership attendance denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_assessment(core_test.id('A'),'22000000-0000-4000-8000-000000000001','2026-04-10',20,2)$q$,'42501','Leadership assessment denied');
SELECT core_test.expect_error($q$SELECT mass_api.create_activity(gen_random_uuid(),'10000000-0000-4000-8000-000000000001','Morning','2026-04-12','Synthetic activity')$q$,'42501','Leadership activity denied');
SELECT core_test.expect_error($q$SELECT mass_api.add_morarji_member(core_test.id('A2'),'23000000-0000-4000-8000-000000000001')$q$,'42501','Leadership Morarji denied');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"Leadership","centre":"all"}',false);
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.children),'unassigned user and forged business claims reveal no children');
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.centres),'unassigned user reveals no centres');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated"}',false);
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.children),'expired scope reads denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-03','A',1)$q$,'42501','expired scope writes denied');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000008","role":"authenticated"}',false);
SELECT core_test.assert_true(NOT mass_core.can_write('10000000-0000-4000-8000-000000000002'),'Leadership cannot gain writes through accidental mixed grants');
RESET ROLE;
SELECT set_config('request.jwt.claims','',false);
SET ROLE anon;
SELECT core_test.expect_error('SELECT * FROM mass_core.children','42501','anonymous core access denied');
SELECT core_test.expect_error('SELECT * FROM mass_foundation.source_rows','42501','anonymous foundation access denied');
RESET ROLE;
SET ROLE service_role;
SELECT core_test.expect_error('SELECT * FROM mass_core.children','42501','service BYPASSRLS does not grant core ACLs');
SELECT core_test.expect_error('SELECT * FROM mass_foundation.audit_events','42501','service BYPASSRLS does not grant foundation ACLs');
RESET ROLE;
SELECT core_test.expect_error('UPDATE mass_core.children SET id=gen_random_uuid()','55000','identity trigger also prevents privileged mutation');
SELECT core_test.expect_error('UPDATE mass_core.enrolments SET grade_label=''9''','55000','historical grade cannot be overwritten');
SELECT core_test.expect_error('TRUNCATE mass_core.children CASCADE','55000','core truncate denied by trigger');
SELECT core_test.expect_error('UPDATE mass_foundation.audit_events SET operation=''UPDATE''','55000','core audit history immutable');
SELECT core_test.assert_true((SELECT count(*)>0 AND bool_and(actor_user_id='00000000-0000-4000-8000-000000000003') FROM mass_foundation.audit_events WHERE entity_type='core.attendance_records' AND operation='UPDATE'),'core audit carries verified request subject');
SELECT core_test.assert_true((SELECT bool_and(change_metadata-'revision'='{}'::jsonb) FROM mass_foundation.audit_events),'core audit stores no personal field payloads');
SELECT core_test.expect_error($q$INSERT INTO mass_core.academic_years(starts_on) VALUES('2026-01-01')$q$,'23514','academic year cannot begin January');
SELECT core_test.expect_error($q$INSERT INTO mass_core.assessment_definitions(period_id,max_score) VALUES('21000000-0000-4000-8000-000000000002',100)$q$,'23514','historical max100 cannot become approved current definition');
-- Revocation test rolls back so API fixtures keep the original verified synthetic grant.
BEGIN;
SET ROLE mass_core_admin;
UPDATE mass_core.user_scope_grants SET ends_at='2001-01-01' WHERE user_id='00000000-0000-4000-8000-000000000001';
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.assert_true((SELECT count(*)=0 FROM mass_core.children),'revocation removes reads immediately');
SELECT core_test.expect_error($q$SELECT mass_api.record_attendance(core_test.id('A'),'2026-04-03','A',1)$q$,'42501','revocation removes writes immediately');
ROLLBACK;
-- Every Leadership business mutation path must remain read-only.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',false);
SELECT core_test.expect_error($q$SELECT mass_api.close_enrolment(core_test.id('A-new'),1,'2026-08-01','Active')$q$,'42501','Leadership enrolment close denied');
SELECT core_test.expect_error($q$SELECT mass_api.add_enrolment((SELECT child_id FROM core_test.ids WHERE label='A'),'10000000-0000-4000-8000-000000000001','3','Morning','2026-08-01','Active')$q$,'42501','Leadership assignment creation denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_participation(core_test.id('A'),'30000000-0000-4000-8000-000000000001',false,2)$q$,'42501','Leadership participation denied');
SELECT core_test.expect_error($q$SELECT mass_api.record_morarji((SELECT id FROM mass_core.cohort_memberships LIMIT 1),true,true,true,'Synthetic school reference',1)$q$,'42501','Leadership outcome correction denied');
SELECT core_test.expect_error('SELECT * FROM mass_foundation.audit_events','42501','authenticated programme role cannot read private audit');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002"}',false);
DO $$ DECLARE t text; n bigint; BEGIN
 FOREACH t IN ARRAY ARRAY['assessment_results','activity_events','activity_participation','cohort_memberships','morarji_outcomes'] LOOP
 EXECUTE format('SELECT count(*) FROM mass_core.%I',t) INTO n;
 PERFORM core_test.assert_true(n=0,'centre B isolation: '||t);
 END LOOP;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','',false);
SELECT core_test.assert_true((SELECT count(*)=3 FROM mass_foundation.audit_events WHERE entity_type='core.children'),'failed registrations leave no orphan audit event');
SELECT core_test.assert_true((SELECT bool_and(NOT has_function_privilege('anon',oid,'EXECUTE')) FROM pg_proc WHERE pronamespace IN ('mass_core'::regnamespace,'mass_api'::regnamespace)),'no anonymous execution on core or API functions');
SELECT core_test.assert_true((SELECT bool_and(proconfig @> ARRAY['search_path=pg_catalog']) FROM pg_proc WHERE pronamespace IN ('mass_core'::regnamespace,'mass_api'::regnamespace) AND prosecdef),'all definer helpers have fixed search paths');
SELECT core_test.assert_true((SELECT count(*)=1 AND bool_and(member=(SELECT oid FROM pg_roles WHERE rolname=session_user) AND set_option AND inherit_option)
 FROM pg_auth_members WHERE roleid='mass_core_owner'::regrole),'core owner membership restricted to deployment principal with SET/INHERIT');
-- RLS still denies direct mutation if a future ACL is widened accidentally.
BEGIN;
GRANT UPDATE(code) ON mass_core.attendance_records TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
WITH changed AS (UPDATE mass_core.attendance_records SET code='A' RETURNING id)
 SELECT core_test.assert_true((SELECT count(*)=0 FROM changed),'RLS prevents direct writes despite accidental column grant');
ROLLBACK;
BEGIN;
DROP POLICY core_audit_append ON mass_foundation.audit_events;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
SELECT core_test.expect_error($q$SELECT mass_api.register_student('10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Synthetic rollback record','Girl')$q$,'42501','audit append failure aborts registration');
RESET ROLE;
SELECT core_test.assert_true((SELECT count(*)=3 FROM mass_core.children),'audit failure leaves no partial child');
ROLLBACK;
SET ROLE mass_core_admin;
INSERT INTO mass_core.academic_years(id,starts_on) VALUES('20000000-0000-4000-8000-000000000002','2023-04-01');
INSERT INTO mass_core.assessment_periods(id,academic_year_id,quarter) VALUES('21000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002',4);
RESET ROLE;
SELECT core_test.assert_true(mass_core.period_contains('21000000-0000-4000-8000-000000000005','2024-02-29'),'leap day belongs to Q4 in the correct academic year');
SELECT core_test.expect_error($q$UPDATE mass_core.children SET student_id='SYNTHETIC-FORGED-ID'$q$,'428C9','generated permanent student ID cannot be overwritten');
SELECT core_test.expect_error($q$UPDATE mass_core.enrolments SET centre_id='10000000-0000-4000-8000-000000000002'$q$,'55000','historical centre assignment cannot be retagged');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.expect_error($q$SELECT mass_api.add_enrolment((SELECT child_id FROM core_test.ids WHERE label='A'),'10000000-0000-4000-8000-000000000001','1','Morning','2026-04-01','Active')$q$,'23505','duplicate historical episode rejected');
SELECT core_test.expect_error($q$SELECT mass_api.add_enrolment((SELECT child_id FROM core_test.ids WHERE label='A'),'10000000-0000-4000-8000-000000000001','3','Morning','2026-08-01','Left programme')$q$,'23514','non-active episode requires explicit verified end');
SELECT core_test.expect_error($q$SELECT mass_api.record_assessment(core_test.id('A'),'22000000-0000-4000-8000-000000000001','2026-04-10',20,0)$q$,'PT409','routine duplicate assessment cannot create repeat attempt');
RESET ROLE;
SELECT set_config('request.jwt.claims','',false);
