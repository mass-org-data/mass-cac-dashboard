-- Temporary response compatibility for the already-deployed Phase 7 frontend.
-- Every array contains exactly the one server-authoritative role. Authorization
-- continues to use application_users and user_centre_assignments exclusively.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE OR REPLACE FUNCTION mass_api.get_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE subject uuid:=mass_core.request_user_id(); app_role text; result jsonb;
BEGIN
 IF current_setting('role')<>'authenticated' OR subject IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required';END IF;
 app_role:=mass_core.application_role();
 IF app_role IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='active application user required';END IF;
 SELECT jsonb_build_object(
  'api_version','legacy-retired-compatible-v1','authorization_model','single-role-v1','user_id',subject,
  'role',app_role,'roles',jsonb_build_array(app_role),'status','Active',
  'capabilities',jsonb_build_object(
   'read_operational',true,'write_operational',coalesce(bool_or(mass_core.can_write(c.id)),false),
   'read_profiles',true,'read_visits',mass_core.role_at_least('Cluster Officer'),
   'export',app_role='Leadership','manage_users',app_role='Leadership'),
  'operational_roles_enabled',false,
  'centres',coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'label',c.label,'roles',jsonb_build_array(app_role),
   'can_write',mass_core.can_write(c.id),'can_read_profiles',true
  ) ORDER BY c.label,c.id),'[]'::jsonb)
 ) INTO result FROM mass_core.centres c WHERE mass_core.can_read(c.id);
 RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION mass_api.get_context() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.get_context() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
