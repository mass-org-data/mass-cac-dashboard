-- Disposable synthetic coverage for the audited in-place session conversion.
SET ROLE mass_core_owner;
UPDATE mass_activation.features SET enabled=true,approval_reference='isolated session conversion test' WHERE feature='attendance_entry';
UPDATE mass_core.attendance_register_control SET enabled=true,approval_reference='isolated session conversion test';
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',false);

WITH read AS(
 SELECT mass_api.read_attendance_register_v3('10000000-0000-4000-8000-000000000001','Morning','2026-04-20') value
),payload AS(
 SELECT value->>'token' token,(SELECT jsonb_agg(jsonb_build_object('enrolment',x->>'id','code',CASE ord WHEN 1 THEN 'A' ELSE 'P' END)) FROM jsonb_array_elements(value->'roster') WITH ORDINALITY AS q(x,ord)) rows FROM read
)
SELECT mass_api.save_classroom_register('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Morning','2026-04-20',token,rows,'Synthetic complete register','') FROM payload;

WITH read AS(
 SELECT mass_api.read_attendance_register_v3('10000000-0000-4000-8000-000000000001','Morning','2026-04-20') value
),payload AS(
 SELECT value->>'marks_token' token,(SELECT jsonb_agg(jsonb_build_object('enrolment',a.enrolment_id,'code',a.code) ORDER BY a.enrolment_id) FROM mass_core.attendance_records a WHERE a.centre_id='10000000-0000-4000-8000-000000000001' AND a.shift_code='Morning' AND a.attendance_date='2026-04-20' AND a.session_type='Classroom') rows FROM read
)
SELECT mass_api.convert_attendance_session_register('90000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Morning','2026-04-20','Classroom',NULL,'Monthly Meeting',NULL,token,rows,'Corrected synthetic session type') FROM payload;

SELECT core_test.assert_true((SELECT count(*)>0 AND bool_and(session_type='Monthly Meeting') AND bool_and(session_subtype IS NULL) AND count(*) FILTER(WHERE code='MMA')=1 AND count(*) FILTER(WHERE code='MMP')=count(*)-1 AND min(row_version)>=1 FROM mass_core.attendance_records WHERE centre_id='10000000-0000-4000-8000-000000000001' AND shift_code='Morning' AND attendance_date='2026-04-20'),'conversion preserves the complete roster and maps P/A into the target session codes');
SELECT core_test.assert_true((SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(mass_api.attendance_register_page_v3(ARRAY['10000000-0000-4000-8000-000000000001'::uuid],'2026-04-01','2026-05-01',NULL,NULL,NULL,0,100,'session',false,'')->'rows')x WHERE x->>'attendance_date'='2026-04-20' AND x->>'session_type'='Monthly Meeting' AND x->>'last_edited_at' IS NOT NULL)),'all-session register page includes the converted student session and its audit timestamp');
RESET ROLE;
SET ROLE mass_core_owner;
SELECT core_test.assert_true((SELECT count(*)=1 AND min(changed_count)=(SELECT count(*) FROM mass_core.attendance_records WHERE centre_id='10000000-0000-4000-8000-000000000001' AND shift_code='Morning' AND attendance_date='2026-04-20') AND min(from_type)='Classroom' AND min(to_type)='Monthly Meeting' FROM mass_core.attendance_session_conversion_actions WHERE request_id='90000000-0000-4000-8000-000000000002'),'conversion appends one immutable receipt');
UPDATE mass_activation.features SET enabled=false,approval_reference=NULL WHERE feature='attendance_entry';
UPDATE mass_core.attendance_register_control SET enabled=false,approval_reference=NULL;
RESET ROLE;
