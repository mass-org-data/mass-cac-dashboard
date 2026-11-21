-- Phase 8: retire legacy authorization from runtime and operator writes while
-- preserving every historical grant and override row as rollback evidence.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

-- Every historical visit assignment must have one unambiguous governed link
-- before its runtime authorization joins can stop reading user_scope_grants.
ALTER TABLE mass_core.officer_assignments ADD COLUMN governed_assignment_id uuid;

DO $mapping_preflight$
BEGIN
 IF EXISTS(
  SELECT a.id
  FROM mass_core.officer_assignments a
  JOIN mass_core.user_scope_grants g ON g.id=a.scope_grant_id
  LEFT JOIN mass_core.user_centre_assignments u
   ON u.user_id=g.user_id AND u.centre_id=g.centre_id
  GROUP BY a.id HAVING count(u.id)<>1
 ) THEN
  RAISE EXCEPTION 'officer assignment governed-link backfill is ambiguous or incomplete';
 END IF;
END;
$mapping_preflight$;

-- The original immutability trigger rejects every UPDATE. Disable only that
-- user trigger for this reviewed, transactional backfill and restore it before
-- any function or privilege cutover.
ALTER TABLE mass_core.officer_assignments DISABLE TRIGGER verified_link;
UPDATE mass_core.officer_assignments a
SET governed_assignment_id=u.id
FROM mass_core.user_scope_grants g
JOIN mass_core.user_centre_assignments u
 ON u.user_id=g.user_id AND u.centre_id=g.centre_id
WHERE g.id=a.scope_grant_id;
ALTER TABLE mass_core.officer_assignments ENABLE TRIGGER verified_link;

ALTER TABLE mass_core.officer_assignments
 ALTER COLUMN governed_assignment_id SET NOT NULL,
 ALTER COLUMN scope_grant_id DROP NOT NULL,
 ADD CONSTRAINT officer_assignments_governed_assignment_fkey
  FOREIGN KEY(governed_assignment_id) REFERENCES mass_core.user_centre_assignments(id) ON DELETE RESTRICT,
 ADD CONSTRAINT officer_assignments_governed_identity
  UNIQUE(governed_assignment_id,directory_assignment_id,starts_on);

CREATE OR REPLACE FUNCTION mass_core.guard_officer_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='verified assignment correction requires reviewed migration';
 END IF;
 IF NEW.scope_grant_id IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='legacy scope links are retired for new officer assignments';
 END IF;
 IF NOT EXISTS(
  SELECT 1
  FROM mass_core.user_centre_assignments a
  JOIN mass_core.application_users u ON u.user_id=a.user_id
  JOIN mass_core.centre_staff_assignments d ON d.centre_id=a.centre_id
  WHERE a.id=NEW.governed_assignment_id AND d.id=NEW.directory_assignment_id
   AND a.status='Active' AND u.status='Active' AND u.role_code='Cluster Officer'
   AND d.role_code='Cluster Officer'
 ) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='active governed officer-centre linkage required';
 END IF;
 RETURN NEW;
END;
$$;

-- Auth-backed staff-directory identities now belong to the single-role account
-- model. Imported staff rows keep their source provenance and NULL Auth link.
ALTER TABLE mass_core.staff_members DROP CONSTRAINT staff_members_auth_user_id_fkey;
ALTER TABLE mass_core.staff_members ADD CONSTRAINT staff_members_auth_user_id_fkey
 FOREIGN KEY(auth_user_id) REFERENCES mass_core.application_users(user_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION mass_core.guard_operational_directory_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='staff_members' THEN
  IF NEW.auth_user_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM mass_core.application_users u
   WHERE u.user_id=NEW.auth_user_id AND u.status='Active'
  ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='active application identity required';END IF;
 ELSIF NEW.verification_reference IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM mass_core.staff_members s
  JOIN mass_core.application_users u ON u.user_id=s.auth_user_id
  JOIN mass_core.user_centre_assignments a ON a.user_id=u.user_id AND a.centre_id=NEW.centre_id
  WHERE s.id=NEW.staff_member_id AND u.status='Active' AND a.status='Active'
   AND u.role_code=NEW.role_code AND u.role_code<>'Leadership'
 ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='active governed staff assignment required';END IF;
 RETURN NEW;
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
  'api_version','legacy-retired-v1','authorization_model','single-role-v1','user_id',subject,
  'role',app_role,'status','Active',
  'capabilities',jsonb_build_object(
   'read_operational',true,'write_operational',coalesce(bool_or(mass_core.can_write(c.id)),false),
   'read_profiles',true,'read_visits',mass_core.role_at_least('Cluster Officer'),
   'export',app_role='Leadership','manage_users',app_role='Leadership'),
  'centres',coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'label',c.label,'can_write',mass_core.can_write(c.id),'can_read_profiles',true
  ) ORDER BY c.label,c.id),'[]'::jsonb)
 ) INTO result FROM mass_core.centres c WHERE mass_core.can_read(c.id);
 RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION mass_api.get_visit_assignments() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF mass_core.request_user_id() IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required';
 END IF;
 RETURN coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'id',a.id,'centre_id',g.centre_id,'officer_id',d.staff_member_id,
   'shift_scope',a.shift_scope,'starts_on',a.starts_on,'ends_before',a.ends_before
  ) ORDER BY g.centre_id,a.starts_on,a.id)
  FROM mass_core.officer_assignments a
  JOIN mass_core.user_centre_assignments g ON g.id=a.governed_assignment_id
  JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
  WHERE (g.user_id=mass_core.request_user_id() OR mass_core.application_role()='Leadership')
   AND mass_core.can_record_visit(g.centre_id)
 ),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION mass_core.guard_visit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' AND mass_core.reviewed_deletion_allowed(TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF;
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='visit deletion unsupported'; END IF;
 IF NOT mass_core.can_record_visit(NEW.centre_id) OR NOT EXISTS(
  SELECT 1 FROM mass_core.officer_assignments a
  JOIN mass_core.user_centre_assignments g ON g.id=a.governed_assignment_id
  JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
  WHERE a.id=NEW.assignment_id AND (g.user_id=mass_core.request_user_id() OR mass_core.application_role()='Leadership')
   AND g.centre_id=NEW.centre_id AND d.staff_member_id=NEW.officer_id AND d.centre_id=NEW.centre_id
   AND d.role_code='Cluster Officer' AND a.shift_scope='Both shifts'
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
 IF NOT mass_core.operation_enabled('visit_entry') THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='visit entry is disabled';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visit.'||p_id::text,0));
 SELECT * INTO old FROM mass_core.cluster_officer_visits WHERE id=p_id FOR UPDATE;
 IF old.id IS NULL THEN
  SELECT g.centre_id,d.staff_member_id INTO c,officer FROM mass_core.officer_assignments a
  JOIN mass_core.user_centre_assignments g ON g.id=a.governed_assignment_id
  JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
  WHERE a.id=p_assignment AND (g.user_id=mass_core.request_user_id() OR mass_core.application_role()='Leadership');
 ELSE
  IF old.assignment_id<>p_assignment OR (mass_core.application_role()<>'Leadership' AND old.created_by<>mass_core.request_user_id()) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='visit correction authority required'; END IF;
  SELECT g.centre_id,d.staff_member_id INTO c,officer FROM mass_core.officer_assignments a
  JOIN mass_core.user_centre_assignments g ON g.id=a.governed_assignment_id
  JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
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

-- Browser self-discovery and operator mutation of the old model are obsolete.
DROP POLICY IF EXISTS self_scope_discovery ON mass_core.user_scope_grants;
REVOKE SELECT(user_id,centre_id,role_code,starts_at,ends_at,can_read_profiles)
 ON mass_core.user_scope_grants FROM authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON mass_core.user_scope_grants,mass_core.staff_operational_access FROM mass_core_admin;
REVOKE EXECUTE ON FUNCTION mass_core.staff_operational_enabled() FROM authenticated;

DO $retirement_assertions$
BEGIN
 IF EXISTS(SELECT 1 FROM mass_core.officer_assignments WHERE governed_assignment_id IS NULL) THEN
  RAISE EXCEPTION 'governed officer assignment link missing';
 END IF;
 IF has_any_column_privilege('authenticated','mass_core.user_scope_grants','SELECT') THEN
  RAISE EXCEPTION 'authenticated retains legacy grant discovery';
 END IF;
 IF has_table_privilege('mass_core_admin','mass_core.user_scope_grants','INSERT,UPDATE,DELETE')
  OR has_table_privilege('mass_core_admin','mass_core.staff_operational_access','INSERT,UPDATE,DELETE') THEN
  RAISE EXCEPTION 'administrator retains legacy authorization writes';
 END IF;
 IF has_function_privilege('authenticated','mass_core.staff_operational_enabled()','EXECUTE') THEN
  RAISE EXCEPTION 'authenticated retains obsolete override execution';
 END IF;
 IF position('staff_operational_access' IN pg_get_functiondef('mass_core.guard_operational_directory_insert()'::regprocedure))>0 THEN
  RAISE EXCEPTION 'staff directory insert still depends on the retired override';
 END IF;
 IF EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='mass_core.staff_members'::regclass AND conname='staff_members_auth_user_id_fkey'
   AND confrelid<>'mass_core.application_users'::regclass
 ) THEN RAISE EXCEPTION 'staff Auth identity does not reference governed accounts';END IF;
 IF EXISTS(
  SELECT 1 FROM pg_proc p
  WHERE p.oid IN (
   'mass_api.get_visit_assignments()'::regprocedure,
   'mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text)'::regprocedure,
   'mass_core.guard_visit()'::regprocedure,
   'mass_core.guard_officer_assignment()'::regprocedure
  ) AND position('user_scope_grants' IN p.prosrc)>0
 ) OR EXISTS(
  SELECT 1 FROM pg_proc p
  WHERE p.oid IN (
   'mass_api.get_visit_assignments()'::regprocedure,
   'mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text)'::regprocedure,
   'mass_core.guard_visit()'::regprocedure
  ) AND position('scope_grant_id' IN p.prosrc)>0
 ) THEN
  RAISE EXCEPTION 'visit runtime still depends on legacy grants';
 END IF;
END;
$retirement_assertions$;

NOTIFY pgrst,'reload schema';
COMMIT;
