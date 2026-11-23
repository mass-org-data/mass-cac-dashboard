-- Phase 4: make governed role hierarchy and active centre assignments the
-- authoritative write model. Release gates and record-specific validation stay
-- in place; legacy role grants and operational overrides no longer grant writes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

SELECT mass_core.assert_permission_scope_reconciled();

CREATE OR REPLACE FUNCTION mass_core.governed_can_write(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.governed_can_read(c)
$$;
CREATE OR REPLACE FUNCTION mass_core.can_write(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.governed_can_write(c)
$$;
CREATE OR REPLACE FUNCTION mass_core.can_write_profile(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.can_write_child(c) AND mass_core.can_read_profile(c)
$$;

-- Retain the historical table for audit/reconciliation, but make its runtime
-- exception inert. It will be removed after the complete cutover is verified.
CREATE OR REPLACE FUNCTION mass_core.staff_operational_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT false $$;

-- Correction authority follows creation authority. The old correction feature
-- names remain in the response for client compatibility, but resolve to their
-- corresponding entry release gate. staff_operational_access cannot bypass a
-- disabled visit gate.
DO $activation_cutover$
BEGIN
 IF to_regclass('mass_activation.features') IS NOT NULL THEN
  EXECUTE $function$
CREATE OR REPLACE FUNCTION mass_core.operation_enabled(p_feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
 SELECT current_setting('role')='authenticated' AND mass_core.request_user_id() IS NOT NULL
 AND coalesce((SELECT enabled FROM mass_activation.features WHERE feature=CASE p_feature
  WHEN 'attendance_corrections' THEN 'attendance_entry'
  WHEN 'assessment_corrections' THEN 'assessment_entry'
  WHEN 'visit_corrections' THEN 'visit_entry'
  ELSE p_feature END),false)
$body$;
$function$;
 END IF;
END;
$activation_cutover$;

CREATE OR REPLACE FUNCTION mass_core.can_record_visit(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.role_at_least('Cluster Officer') AND mass_core.can_write(c)
$$;

CREATE OR REPLACE FUNCTION mass_core.guard_visit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='visit deletion unsupported'; END IF;
 IF NOT mass_core.can_record_visit(NEW.centre_id) OR NOT EXISTS(
  SELECT 1 FROM mass_core.officer_assignments a JOIN mass_core.user_scope_grants g ON g.id=a.scope_grant_id
  JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
  WHERE a.id=NEW.assignment_id AND (g.user_id=mass_core.request_user_id() OR mass_core.application_role()='Leadership')
   AND g.centre_id=NEW.centre_id AND d.staff_member_id=NEW.officer_id AND d.centre_id=NEW.centre_id
   AND g.role_code='Cluster Officer' AND d.role_code='Cluster Officer' AND a.shift_scope='Both shifts'
   AND a.starts_on<=NEW.visit_date AND (a.ends_before IS NULL OR NEW.visit_date<a.ends_before)
 ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified dated officer assignment required'; END IF;
 IF NEW.status='Completed' AND NEW.visit_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='completed visit cannot be future'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.created_by<>OLD.created_by OR (mass_core.application_role()<>'Leadership' AND OLD.created_by<>mass_core.request_user_id())
   OR (to_jsonb(NEW)-ARRAY['status','feedback','next_action','visit_date','shift_code','last_updated_by','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','feedback','next_action','visit_date','shift_code','last_updated_by','updated_at']) THEN
   RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='visit identity immutable';
  END IF;
  NEW.row_version:=OLD.row_version+1;
 ELSIF NEW.row_version<>1 OR NEW.created_by<>mass_core.request_user_id() THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='initial visit actor/revision required';
 END IF;
 NEW.last_updated_by:=mass_core.request_user_id();NEW.updated_at:=clock_timestamp();RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.record_visit(p_id uuid,p_assignment uuid,p_shift text,p_date date,p_status text,p_feedback text,p_next_action text,p_expected bigint,p_reason text DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old mass_core.cluster_officer_visits; n mass_core.cluster_officer_visits; c uuid; officer uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_id IS NULL OR p_date IS NULL OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_status IS NULL OR p_status NOT IN ('Planned','Completed') OR p_feedback IS NULL OR length(p_feedback)>2000 OR p_next_action IS NULL OR length(p_next_action)>2000 OR (p_status='Completed' AND length(btrim(p_feedback))=0) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='valid visit fields and completed feedback required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visit.'||p_id::text,0));
 SELECT * INTO old FROM mass_core.cluster_officer_visits WHERE id=p_id FOR UPDATE;
 IF old.id IS NULL THEN
  SELECT g.centre_id,d.staff_member_id INTO c,officer FROM mass_core.officer_assignments a
  JOIN mass_core.user_scope_grants g ON g.id=a.scope_grant_id JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
  WHERE a.id=p_assignment AND g.user_id=mass_core.request_user_id();
 ELSE
  IF old.assignment_id<>p_assignment OR (mass_core.application_role()<>'Leadership' AND old.created_by<>mass_core.request_user_id()) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='visit correction authority required'; END IF;
  SELECT g.centre_id,d.staff_member_id INTO c,officer FROM mass_core.officer_assignments a
  JOIN mass_core.user_scope_grants g ON g.id=a.scope_grant_id JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
  WHERE a.id=p_assignment AND (g.user_id=mass_core.request_user_id() OR mass_core.application_role()='Leadership');
 END IF;
 IF c IS NULL OR officer IS NULL OR NOT mass_core.can_record_visit(c) OR (old.id IS NOT NULL AND (old.centre_id<>c OR old.officer_id<>officer)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified officer scope required'; END IF;
 IF old.id IS NOT NULL AND p_expected=0 AND old.row_version=1 AND old.assignment_id=p_assignment AND old.shift_code=p_shift AND old.visit_date=p_date AND old.status=p_status AND old.feedback=p_feedback AND old.next_action=p_next_action THEN RETURN old.row_version; END IF;
 PERFORM mass_core.expected_version(old.row_version,p_expected);
 IF old.id IS NULL THEN
  INSERT INTO mass_core.cluster_officer_visits(id,assignment_id,centre_id,officer_id,shift_code,visit_date,status,feedback,next_action,created_by,last_updated_by)
  VALUES(p_id,p_assignment,c,officer,p_shift,p_date,p_status,p_feedback,p_next_action,mass_core.request_user_id(),mass_core.request_user_id()) RETURNING * INTO n;
 ELSE
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='correction reason and original assignment required'; END IF;
  UPDATE mass_core.cluster_officer_visits SET shift_code=p_shift,visit_date=p_date,status=p_status,feedback=p_feedback,next_action=p_next_action WHERE id=p_id RETURNING * INTO n;
 END IF;
 INSERT INTO mass_core.visit_revisions(visit_id,operation,previous_values,new_values,actor_user_id,revision,correction_reason)
 VALUES(p_id,CASE WHEN old.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old) END,to_jsonb(n),mass_core.request_user_id(),n.row_version,p_reason);
 INSERT INTO mass_foundation.audit_events(actor_database_principal,actor_database_role,actor_user_id,entity_type,entity_id,operation,change_metadata)
 VALUES(session_user,current_setting('role'),mass_core.request_user_id(),'core.cluster_officer_visits',p_id,CASE WHEN old.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,jsonb_build_object('revision',n.row_version));
 RETURN n.row_version;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.correct_profile(p_child uuid,p_expected bigint,p_name text,p_gender text,p_board boolean) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.private_child_profiles;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid profile fields required';END IF;
 IF NOT mass_core.can_write_child(p_child) OR NOT mass_core.can_read_profile(p_child) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='profile correction capability required'; END IF;
 SELECT * INTO r FROM mass_core.private_child_profiles WHERE child_id=p_child FOR UPDATE;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='profile not found'; END IF;
 UPDATE mass_core.private_child_profiles SET full_name=p_name,gender_code=p_gender,class10_board_passed=p_board WHERE id=r.id RETURNING row_version INTO p_expected;
 RETURN p_expected;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.get_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE subject uuid:=mass_core.request_user_id(); app_role text; result jsonb;
BEGIN
 IF current_setting('role')<>'authenticated' OR subject IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required';END IF;
 app_role:=mass_core.application_role();
 IF app_role IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='active application user required';END IF;
 SELECT jsonb_build_object(
  'api_version','governed-writes-v1','authorization_model','single-role-v1','user_id',subject,
  'role',app_role,'roles',jsonb_build_array(app_role),'status','Active',
  'capabilities',jsonb_build_object(
   'read_operational',true,'write_operational',coalesce(bool_or(mass_core.can_write(c.id)),false),
   'read_profiles',true,'read_visits',mass_core.role_at_least('Cluster Officer'),
   'export',app_role='Leadership','manage_users',app_role='Leadership'),
  'operational_roles_enabled',false,
  'centres',coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'label',c.label,'roles',jsonb_build_array(app_role),
   'can_write',mass_core.can_write(c.id),'can_read_profiles',true) ORDER BY c.label,c.id),'[]'::jsonb)
 ) INTO result FROM mass_core.centres c WHERE mass_core.can_read(c.id);
 RETURN result;
END;
$$;

-- The register-specific switch and the general attendance gate are both release
-- controls. Enforce and advertise their intersection so the UI and direct RPCs
-- cannot disagree.
DO $register_gates$
DECLARE p record;definition text;updated text;needle text;replacement text;
BEGIN
 needle:='IF NOT coalesce((SELECT enabled FROM mass_core.attendance_register_control),false) OR NOT mass_core.can_write(p_centre) THEN';
 replacement:='IF NOT coalesce((SELECT enabled FROM mass_core.attendance_register_control),false) OR NOT mass_core.operation_enabled(''attendance_entry'') OR NOT mass_core.can_write(p_centre) THEN';
 FOR p IN SELECT oid,proname FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND proname IN ('save_attendance_register','delete_attendance_register','save_attendance_register_v3','delete_attendance_register_v3','save_centre_holiday') LOOP
  definition:=pg_get_functiondef(p.oid);
  IF position(replacement IN definition)>0 THEN CONTINUE;END IF;
  IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized attendance gate source for %',p.proname;END IF;
  updated:=replace(definition,needle,replacement);
  IF updated=definition THEN RAISE EXCEPTION 'Attendance gate patch failed for %',p.proname;END IF;
  EXECUTE updated;
 END LOOP;
END;
$register_gates$;

CREATE OR REPLACE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE control_enabled boolean;entry_enabled boolean;
BEGIN
 PERFORM mass_core.require_staff_session();
 control_enabled:=coalesce((SELECT enabled FROM mass_core.attendance_register_control),false);
 entry_enabled:=mass_core.operation_enabled('attendance_entry');
 RETURN jsonb_build_object('version',7,'holiday_code',true,'profile_pages',true,'assessment_register',true,'register_timestamps',true,'profile_sort_v2',true,'register_paging',true,'present_distribution',true,'session_entry',true,'academic_history',true,
  'control_enabled',control_enabled,'entry_enabled',entry_enabled,'corrections_enabled',entry_enabled,'enabled',control_enabled AND entry_enabled);
END;
$$;

REVOKE ALL ON FUNCTION mass_core.governed_can_write(uuid),mass_core.can_write_profile(uuid),mass_core.staff_operational_enabled(),mass_core.can_record_visit(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_core.governed_can_write(uuid),mass_core.staff_operational_enabled(),mass_core.can_record_visit(uuid) TO authenticated;
REVOKE ALL ON FUNCTION mass_core.can_write_profile(uuid) FROM authenticated;
DO $activation_acl$ BEGIN
 IF to_regprocedure('mass_core.operation_enabled(text)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION mass_core.operation_enabled(text) FROM PUBLIC,anon,service_role;
  GRANT EXECUTE ON FUNCTION mass_core.operation_enabled(text) TO authenticated;
 END IF;
END;$activation_acl$;
NOTIFY pgrst,'reload schema';
COMMIT;
