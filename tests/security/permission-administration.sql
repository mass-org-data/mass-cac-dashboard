-- Local synthetic identities. Provider changes below stand in for the trusted
-- Auth Admin response and roll back with the rest of the fixture.
BEGIN;
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000009');
CREATE FUNCTION core_test.administration_candidate(n integer) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_array(jsonb_build_object(
  'id','00000000-0000-4000-8000-'||lpad(n::text,12,'0'), 'email','synthetic@example.invalid','confirmed',true))
$$;
CREATE FUNCTION core_test.token_event(n integer,s integer,method text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('user_id','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),
  'claims',jsonb_build_object('session_id','00000000-0000-4000-8000-'||lpad(s::text,12,'0')),
  'authentication_method',method)
$$;

SELECT core_test.assert_true(
 NOT has_function_privilege('authenticated','mass_core.administration_prepare(uuid,uuid,text,jsonb)','EXECUTE')
 AND NOT has_function_privilege('anon','mass_core.administration_directory(uuid,jsonb)','EXECUTE')
 AND NOT has_function_privilege('service_role','mass_core.administration_finish(uuid,uuid,uuid,text)','EXECUTE')
 AND NOT has_function_privilege('mass_user_admin_bridge','mass_core.administration_access_token_hook(jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','mass_core.administration_access_token_hook(jsonb)','EXECUTE')
 AND has_function_privilege('supabase_auth_admin','mass_core.administration_access_token_hook(jsonb)','EXECUTE')
 AND NOT has_table_privilege('supabase_auth_admin','mass_core.administration_auth_sessions','SELECT,INSERT,UPDATE,DELETE')
 AND NOT has_table_privilege('authenticated','mass_core.administration_events','SELECT,INSERT,UPDATE,DELETE')
 AND NOT has_table_privilege('mass_user_admin_bridge','mass_core.application_users','SELECT,INSERT,UPDATE,DELETE'),
 'browser, service role and bridge cannot bypass the narrow server entry points');

SET LOCAL ROLE supabase_auth_admin;
SELECT core_test.assert_true(
 mass_core.administration_access_token_hook(core_test.token_event(3,11,'token_refresh'))=core_test.token_event(3,11,'token_refresh'),
 'hook preserves refresh behavior before first administration revocation');
SELECT core_test.assert_true(
 mass_core.administration_access_token_hook(core_test.token_event(9,15,'password'))=core_test.token_event(9,15,'password'),
 'hook preserves Auth behavior for unlinked accounts');

SET LOCAL ROLE mass_user_admin_bridge;
SELECT core_test.expect_error($q$SELECT mass_core.administration_directory('00000000-0000-4000-8000-000000000001','[]')$q$,'42501','Teacher denied');
SELECT core_test.expect_error($q$SELECT mass_core.administration_directory('00000000-0000-4000-8000-000000000003','[]')$q$,'42501','CO denied');
SELECT core_test.expect_error($q$SELECT mass_core.administration_directory(NULL,'[]')$q$,'42501','anonymous denied');
SELECT core_test.assert_true(jsonb_array_length(mass_core.administration_directory('00000000-0000-4000-8000-000000000004',core_test.administration_candidate(4))->'users')>0,'active Leadership can search users');
SELECT core_test.expect_error($q$SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000001','role','{"subject":"00000000-0000-4000-8000-000000000004","version":1,"role":"Teacher"}')$q$,'42501','self role changes denied');
SELECT core_test.expect_error($q$SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000002','deactivate','{"subject":"00000000-0000-4000-8000-000000000004","version":1}')$q$,'42501','self deactivation denied');
SELECT core_test.expect_error($q$SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000003','link','{"email":"synthetic-unconfirmed@example.invalid","role":"Teacher"}')$q$,'22023','manual fallback requires a confirmed Auth account');

SELECT core_test.assert_true(mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000004','link','{"email":"synthetic-manual@example.invalid","role":"Teacher","subject":"00000000-0000-4000-8000-000000000009"}')->>'state'='complete','verified manual account linked');
SELECT core_test.assert_true(mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000004','link','{"email":"synthetic-manual@example.invalid","role":"Teacher","subject":"00000000-0000-4000-8000-000000000009"}')->>'state'='complete','replayed link is idempotent');
SELECT core_test.expect_error($q$SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000004','link','{"email":"synthetic-manual@example.invalid","role":"Leadership","subject":"00000000-0000-4000-8000-000000000009"}')$q$,'PT409','reused ID cannot change role');
SELECT core_test.assert_true(mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000005','assign','{"subject":"00000000-0000-4000-8000-000000000009","centre":"10000000-0000-4000-8000-000000000001","version":1}')->>'state'='complete','one active Teacher assignment');
SELECT core_test.expect_error($q$SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000006','assign','{"subject":"00000000-0000-4000-8000-000000000009","centre":"10000000-0000-4000-8000-000000000002","version":1}')$q$,'PT409','concurrent form version cannot overwrite assignment');
SELECT core_test.expect_error($q$SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000006','assign','{"subject":"00000000-0000-4000-8000-000000000009","centre":"10000000-0000-4000-8000-000000000002","version":2}')$q$,'23514','second Teacher assignment denied at current version');
SELECT core_test.expect_error($q$SELECT mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000007','role','{"subject":"00000000-0000-4000-8000-000000000009","role":"Leadership","version":2}')$q$,'23514','cannot promote while an active assignment exists');

SELECT core_test.assert_true(mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000008','invite','{"email":"synthetic-invite@example.invalid","role":"Leadership"}')->>'state'='pending','invite is reserved before Auth');
RESET ROLE;
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000013');
SET LOCAL ROLE mass_user_admin_bridge;
SELECT core_test.assert_true(mass_core.administration_finish('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000013',NULL)->>'state'='complete','provider-confirmed invite links correct Auth account');
SELECT core_test.assert_true(mass_core.administration_prepare('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000009','deactivate','{"subject":"00000000-0000-4000-8000-000000000013","version":1}')->>'state'='pending','one Leadership member can deactivate another');
SELECT core_test.expect_error($q$SELECT mass_core.administration_directory('00000000-0000-4000-8000-000000000013','[]')$q$,'42501','deactivated Leadership immediately loses admin authority');

SELECT core_test.assert_true(mass_core.administration_prepare(
 '00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000010','deactivate',
 jsonb_build_object('subject','00000000-0000-4000-8000-000000000003','version',
   (SELECT item->'version' FROM jsonb_array_elements(mass_core.administration_directory(
      '00000000-0000-4000-8000-000000000004',core_test.administration_candidate(3))->'users') item))
 )->>'state'='pending','app account goes inactive before Auth work');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","session_id":"00000000-0000-4000-8000-000000000011"}',true);
SELECT core_test.expect_error($q$SELECT mass_api.get_context()$q$,'42501','existing JWT denied before Auth ban');
SET LOCAL ROLE mass_user_admin_bridge;
SELECT core_test.assert_true(mass_core.administration_finish('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000010',NULL,'auth_unavailable')->>'state'='retry','failed provider action remains retryable');
SET LOCAL ROLE supabase_auth_admin;
SELECT core_test.expect_error($q$SELECT mass_core.administration_access_token_hook(core_test.token_event(3,11,'token_refresh'))$q$,'42501','provider rejects refresh while app account inactive');
SET LOCAL ROLE mass_user_admin_bridge;
SELECT core_test.assert_true(mass_core.administration_finish('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000003',NULL)->>'state'='complete','trusted bridge finalizes verified provider ban');
RESET ROLE;
SELECT core_test.assert_true(NOT EXISTS(SELECT 1 FROM mass_core.user_centre_assignments
 WHERE user_id='00000000-0000-4000-8000-000000000003' AND status='Active'),'deactivation ends all assignments');
SELECT core_test.expect_error($q$
 INSERT INTO mass_core.user_centre_assignments(user_id,centre_id,status,starts_at,approval_reference,approved_by,approved_at)
 VALUES('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Active',now(),'synthetic','00000000-0000-4000-8000-000000000004',now())
$q$,'23514','inactive user cannot receive an active assignment');
SET LOCAL ROLE mass_user_admin_bridge;
SELECT core_test.assert_true(mass_core.administration_prepare(
 '00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000011','reactivate',
 jsonb_build_object('subject','00000000-0000-4000-8000-000000000003','version',
   (SELECT item->'version' FROM jsonb_array_elements(mass_core.administration_directory(
      '00000000-0000-4000-8000-000000000004',core_test.administration_candidate(3))->'users') item))
 )->>'state'='pending','reactivation is reserved while application stays inactive');
SET LOCAL ROLE supabase_auth_admin;
SELECT core_test.expect_error($q$SELECT mass_core.administration_access_token_hook(core_test.token_event(3,14,'password'))$q$,'42501','provider cannot issue a fresh token before app reactivation');
SET LOCAL ROLE mass_user_admin_bridge;
SELECT core_test.expect_error($q$SELECT mass_core.administration_finish('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000004',NULL)$q$,'22023','unban result must match target');
SELECT core_test.assert_true(mass_core.administration_finish('00000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000003',NULL)->>'state'='complete','trusted bridge finalizes verified provider unban');
SET LOCAL ROLE authenticated;
SELECT core_test.expect_error($q$SELECT mass_api.get_context()$q$,'42501','revoked JWT cannot resume after reactivation');
SET LOCAL ROLE supabase_auth_admin;
SELECT core_test.expect_error($q$SELECT mass_core.administration_access_token_hook(core_test.token_event(3,11,'token_refresh'))$q$,'42501','old refresh remains denied after unban');
SELECT core_test.expect_error($q$SELECT mass_core.administration_access_token_hook(core_test.token_event(3,11,'mfa/totp'))$q$,'42501','old session cannot be admitted through MFA');
SELECT core_test.assert_true(mass_core.administration_access_token_hook(core_test.token_event(3,14,'password'))=core_test.token_event(3,14,'password'),'fresh login registers its session without altering claims');
SELECT core_test.assert_true(mass_core.administration_access_token_hook(core_test.token_event(3,14,'token_refresh'))=core_test.token_event(3,14,'token_refresh'),'new session can refresh');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","session_id":"00000000-0000-4000-8000-000000000014"}',true);
SELECT core_test.assert_true(mass_api.get_context()->>'role'='Cluster Officer','new Auth session can use the active application account');
RESET ROLE;
SELECT core_test.expect_error('UPDATE mass_core.administration_events SET action=action','55000','administration events are immutable');
SELECT core_test.expect_error('DELETE FROM mass_core.administration_events','55000','administration events cannot be deleted');
SELECT core_test.assert_true((SELECT bool_and(changes::text NOT LIKE '%@%' AND coalesce(failure,'') NOT LIKE '%@%') FROM mass_core.administration_events),'event payloads contain no email or provider messages');
ROLLBACK;
