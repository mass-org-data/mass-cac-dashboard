-- Parity of the batched monthly attendance series with reviewed_chart_metrics, plus scope and input guards.
-- Runs after tests/reviewed-calculations/synthetic.sql, before the activation seal. Synthetic identities only.
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
-- Extra marks so earlier months, leave, absence, Sunday, and a confirmed holiday are all exercised.
SELECT mass_api.record_calendar('10000000-0000-4000-8000-000000000001','Morning','2026-08-15',false,'62000000-0000-4000-8000-000000000002');
DO $$DECLARE d date;BEGIN FOR d IN SELECT generate_series('2026-08-03'::date,'2026-08-14'::date,interval '1 day')::date LOOP
 PERFORM mass_api.record_attendance(core_test.id('R2'),d,CASE WHEN extract(dow FROM d)=0 THEN 'WO' WHEN extract(day FROM d)%4=0 THEN 'A' WHEN extract(day FROM d)%5=0 THEN 'L' ELSE 'P' END,0);
 PERFORM mass_api.record_attendance(core_test.id('R1new'),d,CASE WHEN extract(day FROM d)%3=0 THEN 'A' ELSE 'P' END,0);
END LOOP;END;$$;
SELECT mass_api.record_attendance(core_test.id('R2'),'2026-08-15','H',0);
DO $$
DECLARE c uuid[]:=ARRAY['10000000-0000-4000-8000-000000000001']::uuid[];y uuid:='20000000-0000-4000-8000-000000000001';today date:='2026-10-31';
 f record;s jsonb;e jsonb;r jsonb;a date;checked int:=0;withdata int:=0;
BEGIN
 FOR f IN SELECT * FROM (VALUES (NULL,NULL,NULL),(NULL,'Morning',NULL),(NULL,'Evening',NULL),('5',NULL,NULL),('6','Morning',NULL),(NULL,NULL,'Girl'),(NULL,NULL,'Boy'),(NULL,NULL,'Unknown'),('9','Evening','Boy'))v(g,sh,ge) LOOP
  s:=mass_api.reviewed_attendance_series(c,y,today,f.g,f.sh,f.ge);
  IF jsonb_array_length(s)<>7 THEN RAISE EXCEPTION 'expected April to October, got % months',jsonb_array_length(s); END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(s)x LOOP
   a:=to_date((e->>'month')||'-01','YYYY-MM-DD');
   r:=mass_api.reviewed_chart_metrics(c,least((a+interval '1 month')::date-1,today),a,(a+interval '1 month')::date,y,f.g,f.sh,f.ge)->'attendance';
   IF (r->>'p')::int IS DISTINCT FROM (e->>'p')::int OR (r->>'a')::int IS DISTINCT FROM (e->>'a')::int OR (r->>'l')::int IS DISTINCT FROM (e->>'l')::int
      OR (r->>'excluded')::int IS DISTINCT FROM (e->>'excluded')::int OR (r->>'percentage')::numeric IS DISTINCT FROM (e->>'percentage')::numeric THEN
    RAISE EXCEPTION 'series differs from reviewed_chart_metrics: filter % % %, month %, series %, reviewed %',f.g,f.sh,f.ge,e->>'month',e,r; END IF;
   checked:=checked+1; IF (e->>'p')::int+(e->>'a')::int+(e->>'l')::int>0 THEN withdata:=withdata+1; END IF;
  END LOOP;
 END LOOP;
 IF checked<>63 THEN RAISE EXCEPTION 'expected 63 month and filter comparisons, got %',checked; END IF;
 IF withdata<10 THEN RAISE EXCEPTION 'fixture must exercise months with recorded attendance, got %',withdata; END IF;
END$$;
SELECT core_test.assert_true((SELECT (e->>'excluded')::int>=1 FROM jsonb_array_elements(mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')) e WHERE e->>'month'='2026-08'),'holiday and Sunday marks are excluded, not counted');
SELECT core_test.assert_true((SELECT e->'percentage'='null'::jsonb FROM jsonb_array_elements(mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')) e WHERE e->>'month'='2026-05'),'a month with no recorded marks stays unknown, not zero');
SELECT core_test.assert_true(mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-03-15')='[]'::jsonb,'a reporting day before the academic year returns no months');
SELECT core_test.assert_true(jsonb_array_length(mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2030-01-01'))=12,'months never run past the academic year');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000002']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','series rejects another centre');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','series rejects mixed readable and unreadable scope');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(NULL,'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','series rejects global null scope');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY[]::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','series rejects empty scope');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-0000000000ff','2026-10-31')$q$,'22023','series rejects an unknown academic year');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001',NULL)$q$,'22023','series requires a reporting day');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31','11')$q$,'22023','series rejects an unapproved grade');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31',NULL,'Night')$q$,'22023','series rejects an unknown shift');
SELECT core_test.assert_true(NOT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')::text LIKE '%Synthetic%','series exposes no names or profile text');
RESET ROLE;
SET ROLE anon;
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_series(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','anonymous callers cannot execute the series');
RESET ROLE;
-- Per-centre, per-month counts equal the batched series (one centre in this fixture) and the reviewed report, for every filter.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001"}',false);
DO $$
DECLARE c uuid[]:=ARRAY['10000000-0000-4000-8000-000000000001']::uuid[];y uuid:='20000000-0000-4000-8000-000000000001';today date:='2026-10-31';
 f record;b jsonb;e jsonb;r jsonb;a date;checked int:=0;
BEGIN
 FOR f IN SELECT * FROM (VALUES (NULL,NULL,NULL),(NULL,'Morning',NULL),(NULL,'Evening',NULL),('5',NULL,NULL),('6','Morning',NULL),(NULL,NULL,'Girl'),(NULL,NULL,'Boy'),(NULL,NULL,'Unknown'),('9','Evening','Boy'))v(g,sh,ge) LOOP
  b:=mass_api.reviewed_attendance_by_centre_month(c,y,today,f.g,f.sh,f.ge);
  IF jsonb_array_length(b)<>7 THEN RAISE EXCEPTION 'expected one row per month for one centre, got %',jsonb_array_length(b); END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(b)x LOOP
   a:=to_date((e->>'month')||'-01','YYYY-MM-DD');
   r:=mass_api.reviewed_chart_metrics(c,least((a+interval '1 month')::date-1,today),a,(a+interval '1 month')::date,y,f.g,f.sh,f.ge);
   IF (r->'attendance'->>'p')::int IS DISTINCT FROM (e->>'p')::int OR (r->'attendance'->>'a')::int IS DISTINCT FROM (e->>'a')::int OR (r->'attendance'->>'l')::int IS DISTINCT FROM (e->>'l')::int
      OR (r->'attendance'->>'excluded')::int IS DISTINCT FROM (e->>'excluded')::int OR (r->>'children')::int IS DISTINCT FROM (e->>'children')::int OR e->>'centre_id'<>c[1]::text THEN
    RAISE EXCEPTION 'by-centre-month differs from reviewed_chart_metrics: filter % % %, month %, got %, reviewed %',f.g,f.sh,f.ge,e->>'month',e,r; END IF;
   checked:=checked+1;
  END LOOP;
 END LOOP;
 IF checked<>63 THEN RAISE EXCEPTION 'expected 63 comparisons, got %',checked; END IF;
END$$;
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_by_centre_month(ARRAY['10000000-0000-4000-8000-000000000002']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','by-centre-month rejects another centre');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_by_centre_month(ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','by-centre-month rejects mixed readable scope');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_by_centre_month(NULL,'20000000-0000-4000-8000-000000000001','2026-10-31')$q$,'42501','by-centre-month rejects a null scope');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_by_centre_month(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-0000000000ff','2026-10-31')$q$,'22023','by-centre-month rejects an unknown academic year');
SELECT core_test.expect_error($q$SELECT mass_api.reviewed_attendance_by_centre_month(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31','11')$q$,'22023','by-centre-month rejects an unapproved grade');
SELECT core_test.assert_true(NOT mass_api.reviewed_attendance_by_centre_month(ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'20000000-0000-4000-8000-000000000001','2026-10-31')::text LIKE '%Synthetic%','by-centre-month exposes no names or profile text');
RESET ROLE;
