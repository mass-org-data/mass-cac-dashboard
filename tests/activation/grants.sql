-- SYNTHETIC ONLY. Same grant count, deliberately not a claim of real topology.
INSERT INTO auth.users SELECT ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,4)n;
SET ROLE mass_core_admin;
INSERT INTO mass_core.centres(id,label) VALUES('91000000-0000-4000-8000-000000000004','Synthetic second centre');
INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at,can_read_profiles)
SELECT ('91000000-0000-4000-8000-'||lpad((1+(n%3))::text,12,'0'))::uuid,
 CASE WHEN n%2=0 THEN '91000000-0000-4000-8000-000000000004'::uuid ELSE '90000000-0000-4000-8000-000000000002'::uuid END,
 CASE WHEN n=3 THEN 'Teacher' ELSE CASE n%3 WHEN 0 THEN 'Leadership' WHEN 1 THEN 'Teacher' ELSE 'Cluster Officer' END END,
 '2000-01-01'::timestamptz + n*interval '1 minute','91000000-0000-4000-8000-000000000001','2000-01-01',n%3<>0 FROM generate_series(1,272)n;
INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,ends_at,verified_by,verified_at) VALUES
 ('90000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004','Teacher','2000-01-01','2001-01-01','90000000-0000-4000-8000-000000000001','2000-01-01'),
 ('90000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004','Teacher','2099-01-01',NULL,'90000000-0000-4000-8000-000000000001','2000-01-01'),
 ('91000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000002','Teacher','2000-01-01','2001-01-01','90000000-0000-4000-8000-000000000001','2000-01-01');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002"}',false);
INSERT INTO core_test.ids SELECT 'foreign',child_id,enrolment_id FROM mass_api.register_student('91000000-0000-4000-8000-000000000004','5','Evening','2026-04-01','Synthetic foreign learner',NULL);
RESET ROLE;
SELECT core_test.assert_true((SELECT count(*)=276 FROM mass_core.user_scope_grants),'276 synthetic grants, no hosted identities');
-- Snapshot new grant/centre rows too; no installation may rewrite permissions.
DO $$DECLARE r record;s text;BEGIN
 FOR r IN SELECT * FROM upgrade_test.snapshot LOOP
 EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,''[]'')) FROM(SELECT %s FROM %s)x',r.fields,r.table_name) INTO s;
 UPDATE upgrade_test.snapshot SET checksum=s WHERE table_name=r.table_name;
 END LOOP;
END;$$;
