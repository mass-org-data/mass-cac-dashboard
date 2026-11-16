-- Batched read functions (Phase B) against the single-centre functions they replace. Runs right after tests/release/visits.sql
-- (same synthetic identities: user ...03 is the verified Cluster Officer of centre 1, ...04 is Leadership, ...01 reads centre 1).
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003"}',false);
SELECT core_test.assert_true((SELECT jsonb_array_length(mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01')->'summary')=1),'coverage returns one summary row per centre');
SELECT core_test.assert_true((SELECT (s.v->>'morning')::int=x.morning AND (s.v->>'evening')::int=x.evening AND (s.v->>'achieved')::boolean=x.achieved AND (s.v->>'recorded_count')::int=x.recorded_count AND (s.v->>'target_morning')::int=x.target_morning
  FROM mass_api.visit_summary('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01') x,jsonb_array_elements(mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01')->'summary') s(v)),'coverage summary equals visit_summary');
SELECT core_test.assert_true((SELECT count(*)=1 AND bool_and((o.v->>'morning')::int=x.morning AND (o.v->>'evening')::int=x.evening AND (o.v->>'recorded_count')::int=x.recorded_count AND o.v->>'label'=x.label AND o.v->>'officer_id'=x.officer_id::text)
  FROM mass_api.visit_officer_summary('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01') x,jsonb_array_elements(mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01')->'officers') o(v)),'coverage officers equal visit_officer_summary');
SELECT core_test.assert_true((SELECT jsonb_array_length(mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01','56000000-0000-4000-8000-000000000003')->'summary')=1),'officer filter keeps a centre where that officer is assigned');
SELECT core_test.assert_true((SELECT jsonb_array_length(mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01','56000000-0000-4000-8000-000000000001')->'summary')=0),'officer filter omits a centre where that staff member is not an assigned officer, like visit_summary');
SELECT core_test.assert_true((SELECT count(*)=7 AND array_agg(id ORDER BY visit_date,id)=(SELECT array_agg(id ORDER BY visit_date,id) FROM mass_api.read_visits('10000000-0000-4000-8000-000000000001','2026-10-01','2026-11-01')) FROM mass_api.read_visits_v2(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01')),'read_visits_v2 equals read_visits');
SELECT core_test.assert_true((SELECT count(*)=2 FROM mass_api.read_visits_v2(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01',2,0)),'read_visits_v2 honours the limit');
SELECT core_test.assert_true((SELECT count(*)=5 FROM mass_api.read_visits_v2(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01',100,2)),'read_visits_v2 honours the offset');
SELECT core_test.expect_error($q$SELECT mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002']::uuid[],'2026-10-01','2026-11-01')$q$,'42501','coverage rejects a scope containing an unreadable centre');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.read_visits_v2(ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002']::uuid[],'2026-10-01','2026-11-01')$q$,'42501','visit log rejects a scope containing a centre the officer cannot record in');
SELECT core_test.expect_error($q$SELECT mass_api.visit_coverage(NULL,'2026-10-01','2026-11-01')$q$,'42501','coverage rejects a null scope');
SELECT core_test.expect_error($q$SELECT mass_api.visit_coverage(ARRAY[]::uuid[],'2026-10-01','2026-11-01')$q$,'42501','coverage rejects an empty scope');
SELECT core_test.expect_error($q$SELECT mass_api.visit_coverage(ARRAY(SELECT '10000000-0000-4000-8000-000000000001'::uuid FROM generate_series(1,101)),'2026-10-01','2026-11-01')$q$,'42501','coverage rejects more than 100 centres');
SELECT core_test.expect_error($q$SELECT mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-02','2026-11-02')$q$,'22023','coverage requires one calendar month');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.read_visits_v2(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01',501,0)$q$,'22023','visit log rejects an oversize page');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',false);
SELECT core_test.assert_true((SELECT (s.v->>'morning')::int=4 AND (s.v->>'evening')::int=2 FROM jsonb_array_elements(mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01')->'summary') s(v)),'Leadership receives scoped aggregates');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.read_visits_v2(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01')$q$,'42501','Leadership cannot read private visit notes through the batched log');
RESET ROLE;
SET ROLE anon;
SELECT core_test.expect_error($q$SELECT mass_api.visit_coverage(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-01','2026-11-01')$q$,'42501','anonymous callers cannot execute visit_coverage');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.morarji_followup(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[])$q$,'42501','anonymous callers cannot execute morarji_followup');
RESET ROLE;
-- Morarji follow-up equals read_morarji for the same centre, and adds only the student identifier and name the caller may already read.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
SELECT core_test.assert_true((SELECT count(*)>0 FROM mass_api.read_morarji('10000000-0000-4000-8000-000000000001')),'fixture has cohort members for centre 1');
SELECT core_test.assert_true((SELECT (SELECT count(*) FROM mass_api.morarji_followup(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[]))=(SELECT count(*) FROM mass_api.read_morarji('10000000-0000-4000-8000-000000000001'))),'morarji_followup returns the same members as read_morarji');
SELECT core_test.assert_true((SELECT bool_and(f.membership_id=m.membership_id AND f.enrolment_id=m.enrolment_id AND f.applied IS NOT DISTINCT FROM m.applied AND f.passed IS NOT DISTINCT FROM m.passed AND f.row_version IS NOT DISTINCT FROM m.row_version AND f.student_id IS NOT NULL)
  FROM mass_api.morarji_followup(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[]) f JOIN mass_api.read_morarji('10000000-0000-4000-8000-000000000001') m ON m.membership_id=f.membership_id),'morarji_followup rows match read_morarji field by field');
SELECT core_test.assert_true((SELECT count(*)=1 FROM mass_api.morarji_followup(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],NULL,1,0)),'morarji_followup honours the limit');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.morarji_followup(ARRAY['10000000-0000-4000-8000-000000000002']::uuid[])$q$,'42501','morarji_followup rejects another centre');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.morarji_followup(ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002']::uuid[])$q$,'42501','morarji_followup rejects a mixed scope');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.morarji_followup(NULL)$q$,'42501','morarji_followup rejects a null scope');
SELECT core_test.expect_error($q$SELECT * FROM mass_api.morarji_followup(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],NULL,501,0)$q$,'22023','morarji_followup rejects an oversize page');
-- Profile page v3: identical ids to v2, plus details for exactly those ids in the same order.
SELECT core_test.assert_true((SELECT (mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15')->'ids')=(mass_api.student_profile_page_v2(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15')->'ids')),'v3 returns the same ids as v2');
SELECT core_test.assert_true((SELECT jsonb_array_length(p->'rows')=jsonb_array_length(p->'ids') AND jsonb_array_length(p->'rows')>0
  AND (SELECT bool_and(r.v->>'enrolment_id'=i.id) FROM jsonb_array_elements(p->'rows') WITH ORDINALITY r(v,o) JOIN jsonb_array_elements_text(p->'ids') WITH ORDINALITY i(id,o) ON i.o=r.o)
  FROM (SELECT mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15') p)q),'v3 rows follow the id order and cover every id');
SELECT core_test.assert_true((SELECT bool_and(r.v->>'full_name'=s.full_name AND r.v->>'student_id'=s.student_id AND (r.v->>'row_version')::bigint=s.row_version AND r.v->>'grade_label'=s.grade_label)
  FROM jsonb_array_elements(mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15')->'rows') r(v)
  JOIN mass_api.read_students('10000000-0000-4000-8000-000000000001') s ON s.enrolment_id=(r.v->>'enrolment_id')::uuid),'v3 details equal read_students');
SELECT core_test.assert_true((SELECT jsonb_array_length(mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15','','name',NULL,NULL,NULL,0,1)->'rows')=1),'v3 honours the page size');
SELECT core_test.assert_true((SELECT (mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15','','name',NULL,NULL,NULL,0,10,'',true)->'ids')=(mass_api.student_profile_page_v2(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15','','name',NULL,NULL,NULL,0,10,'',true)->'ids')),'v3 keeps reverse order identical to v2');
SELECT core_test.expect_error($q$SELECT mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000002']::uuid[],'2026-10-15')$q$,'42501','v3 rejects another centre');
SELECT core_test.assert_true(NOT mass_api.student_profile_page_v3(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'2026-10-15')::text LIKE '%feedback%','v3 exposes no visit or other private text');
RESET ROLE;
