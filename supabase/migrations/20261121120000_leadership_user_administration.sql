-- Phase 7. The Edge Function connects as an explicitly provisioned member of
-- mass_user_admin_bridge. No administration endpoint is exposed in mass_api.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE ROLE mass_user_admin_bridge NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE mass_user_admin_auth NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT mass_user_admin_auth TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
GRANT USAGE ON SCHEMA mass_core TO mass_user_admin_bridge, mass_user_admin_auth;
GRANT USAGE ON SCHEMA auth TO mass_user_admin_auth;
GRANT SELECT (id, email, email_confirmed_at, banned_until) ON auth.users TO mass_user_admin_auth;

SET LOCAL ROLE mass_core_owner;

ALTER TABLE mass_core.application_users ADD COLUMN require_current_auth_session boolean NOT NULL DEFAULT false;

CREATE TABLE mass_core.user_administration_requests (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL,
 subject_id uuid,
 action text NOT NULL CHECK (action IN ('invite','link','role','assign','unassign','deactivate','reactivate')),
 input jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('pending','retry','complete','failed')),
 failure text CHECK (failure IN ('auth_unavailable','invite_needs_review','auth_sync_failed')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE UNIQUE INDEX one_pending_administration_per_account
 ON mass_core.user_administration_requests(subject_id) WHERE state IN ('pending','retry') AND subject_id IS NOT NULL;
CREATE UNIQUE INDEX one_pending_invite_per_address
 ON mass_core.user_administration_requests((input->>'email')) WHERE action='invite' AND state='pending';

CREATE TABLE mass_core.administration_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES mass_core.user_administration_requests(id),
 actor_id uuid NOT NULL,
 subject_id uuid,
 action text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 outcome text NOT NULL CHECK (outcome IN ('started','complete','retry','failed')),
 failure text CHECK (failure IN ('auth_unavailable','invite_needs_review','auth_sync_failed')),
 changes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(changes)='object')
);
ALTER TABLE mass_core.user_administration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.user_administration_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE mass_core.administration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.administration_events FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_requests ON mass_core.user_administration_requests TO mass_core_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_events_read ON mass_core.administration_events FOR SELECT TO mass_core_owner USING (true);
CREATE POLICY owner_events_insert ON mass_core.administration_events FOR INSERT TO mass_core_owner WITH CHECK (true);
CREATE TRIGGER administration_events_immutable BEFORE UPDATE OR DELETE ON mass_core.administration_events
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER administration_events_no_truncate BEFORE TRUNCATE ON mass_core.administration_events
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
REVOKE ALL ON mass_core.user_administration_requests,mass_core.administration_events
 FROM PUBLIC,anon,authenticated,service_role,mass_user_admin_bridge;

-- Keep both directions of the invariant under a common account-row lock.
-- Updating the parent on assignment changes also invalidates stale role forms.
CREATE OR REPLACE FUNCTION mass_core.guard_centre_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE account mass_core.application_users;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.user_id<>OLD.user_id OR NEW.centre_id<>OLD.centre_id) THEN
  RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='assignment identity immutable';
 END IF;
 UPDATE mass_core.application_users SET row_version=row_version+1
 WHERE user_id=NEW.user_id RETURNING * INTO account;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='application user required';
 END IF;
 IF NEW.status='Active' THEN
  IF account.status<>'Active' OR account.role_code='Leadership' THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='active assignment requires active centre-scoped user';
  END IF;
  IF account.role_code='Teacher' AND EXISTS (
   SELECT 1 FROM mass_core.user_centre_assignments a
   WHERE a.user_id=NEW.user_id AND a.status='Active' AND (TG_OP='INSERT' OR a.id<>NEW.id)
  ) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Teacher may have only one active centre';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE FUNCTION mass_core.guard_administration_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE active_count bigint;
BEGIN
 SELECT count(*) INTO active_count FROM mass_core.user_centre_assignments
  WHERE user_id=NEW.user_id AND status='Active';
 IF active_count>0 AND (NEW.status='Inactive' OR NEW.role_code='Leadership'
                       OR (NEW.role_code='Teacher' AND active_count>1)) THEN
  RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='current assignments conflict with account change';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_administration_account BEFORE UPDATE OF role_code,status ON mass_core.application_users
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_administration_account();
DO $existing_assignments$ BEGIN
 IF EXISTS (
  SELECT 1 FROM mass_core.application_users u
  JOIN mass_core.user_centre_assignments a ON a.user_id=u.user_id AND a.status='Active'
  GROUP BY u.user_id,u.role_code,u.status
  HAVING u.status<>'Active' OR u.role_code='Leadership' OR (u.role_code='Teacher' AND count(*)>1)
 ) THEN RAISE EXCEPTION 'Resolve existing assignment conflicts before installing Phase 7'; END IF;
END $existing_assignments$;

CREATE FUNCTION mass_core.require_administration_leader(p_actor uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM mass_core.application_users
                 WHERE user_id=p_actor AND status='Active' AND role_code='Leadership') THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='active Leadership required';
 END IF;
END;
$$;

CREATE FUNCTION mass_core.administration_directory(p_actor uuid,p_search text,p_offset integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_administration_leader(p_actor);
 IF p_search IS NULL OR length(p_search)>254 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid directory filter';
 END IF;
 RETURN (
  WITH page AS (
   SELECT u.user_id,u.role_code,u.status,u.row_version,h.email,h.confirmed
   FROM mass_core.application_users u CROSS JOIN LATERAL mass_core.administration_auth_account(u.user_id,NULL) h
   WHERE position(lower(btrim(p_search)) IN lower(coalesce(h.email,'')))>0 OR btrim(p_search)=''
   ORDER BY lower(h.email) NULLS LAST,u.user_id LIMIT 21 OFFSET p_offset
  ), ranked AS (
   SELECT *,row_number() OVER (ORDER BY lower(email) NULLS LAST,user_id) AS ordinal FROM page
  )
  SELECT jsonb_build_object('more',count(*)>20,
   'pendingInvites',coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'email',q.input->>'email') ORDER BY q.created_at)
      FROM (SELECT * FROM mass_core.user_administration_requests
            WHERE action='invite' AND state='pending' ORDER BY created_at LIMIT 20) q),'[]'::jsonb),
   'users',coalesce(jsonb_agg(
   jsonb_build_object('id',r.user_id,'email',r.email,'emailConfirmed',r.confirmed,'role',r.role_code,'status',r.status,'version',r.row_version,
    'pending',(SELECT jsonb_build_object('id',q.id,'action',q.action,'state',q.state,'failure',q.failure)
       FROM mass_core.user_administration_requests q WHERE q.subject_id=r.user_id AND q.state IN ('pending','retry')),
    'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',a.id,'centre',a.centre_id,'label',c.label,'status',a.status,
      'startsAt',a.starts_at,'endsAt',a.ends_at,'version',a.row_version)
      ORDER BY (a.status='Active') DESC,a.starts_at DESC,a.id)
      FROM mass_core.user_centre_assignments a JOIN mass_core.centres c ON c.id=a.centre_id
      WHERE a.user_id=r.user_id),'[]'::jsonb)
   ) ORDER BY r.ordinal) FILTER (WHERE r.ordinal<=20),'[]'::jsonb)) FROM ranked r
 );
END;
$$;

CREATE FUNCTION mass_core.administration_prepare(p_actor uuid,p_id uuid,p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 req mass_core.user_administration_requests;
 subject mass_core.application_users;
 operation_subject uuid;
 assignment_id uuid;
 target_centre uuid;
 target_email text;
 target_role text;
 expected bigint;
 result jsonb:='{"state":"complete"}';
 changes jsonb:='{}';
BEGIN
 -- Serialize account/role edits, including concurrent administrators attempting
 -- to demote each other. Verify the actor after acquiring the lock.
 PERFORM pg_advisory_xact_lock(1935181321,7);
 PERFORM mass_core.require_administration_leader(p_actor);
 IF p_id IS NULL OR p_action IS NULL OR p_action NOT IN ('invite','link','role','assign','unassign','deactivate','reactivate')
    OR p_input IS NULL OR jsonb_typeof(p_input)<>'object' THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid administration request';
 END IF;
 SELECT * INTO req FROM mass_core.user_administration_requests WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF req.action IS DISTINCT FROM p_action OR req.input IS DISTINCT FROM p_input
     OR (req.actor_id<>p_actor AND req.state NOT IN ('pending','retry')) THEN
   RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='request identity conflict';
  END IF;
  IF req.state IN ('complete','failed') THEN RETURN req.result; END IF;
  RETURN jsonb_build_object('state','pending','subject',req.subject_id);
 END IF;

 target_role:=p_input->>'role';
 IF p_action IN ('invite','link','role') AND coalesce(target_role,'') NOT IN ('Teacher','Cluster Officer','Leadership') THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='choose one application role';
 END IF;
 IF p_action IN ('invite','link') THEN
  target_email:=p_input->>'email';
  IF target_email IS NULL OR length(target_email)>254 OR target_email<>lower(btrim(target_email))
     OR target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
   RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='valid email required';
  END IF;
  IF p_action='link' THEN
   SELECT (array_agg(h.id))[1] INTO operation_subject FROM mass_core.administration_auth_account(NULL,target_email) h
    HAVING count(*)=1 AND bool_and(h.confirmed AND NOT h.banned);
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='verified unbanned Auth account required'; END IF;
   IF EXISTS (SELECT 1 FROM mass_core.application_users WHERE user_id=operation_subject) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Auth account already linked';
   END IF;
   INSERT INTO mass_core.application_users(user_id,role_code,status,starts_at,approval_reference,approved_by,approved_at)
   VALUES(operation_subject,target_role,'Active',statement_timestamp(),'Leadership linked Auth account',p_actor,statement_timestamp());
   changes:=jsonb_build_object('role',target_role,'status','Active');
  ELSIF EXISTS (SELECT 1 FROM mass_core.administration_auth_account(NULL,target_email)) THEN
   RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='existing Auth account; review before linking';
  END IF;
 ELSE
  operation_subject:=(p_input->>'subject')::uuid;
  expected:=(p_input->>'version')::bigint;
  SELECT * INTO subject FROM mass_core.application_users WHERE user_id=operation_subject FOR UPDATE;
  IF NOT FOUND OR expected IS DISTINCT FROM subject.row_version THEN
   RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='account changed; reload';
  END IF;
  IF p_actor=operation_subject AND p_action IN ('role','deactivate') THEN
   RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='cannot change own role or deactivate own account';
  END IF;
  IF EXISTS (SELECT 1 FROM mass_core.user_administration_requests
              WHERE subject_id=operation_subject AND state IN ('pending','retry')) THEN
   RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='finish pending Auth action first';
  END IF;
  CASE p_action
   WHEN 'role' THEN
    UPDATE mass_core.application_users SET role_code=target_role,row_version=row_version+1 WHERE user_id=operation_subject;
    changes:=jsonb_build_object('fromRole',subject.role_code,'role',target_role);
   WHEN 'assign' THEN
    target_centre:=(p_input->>'centre')::uuid;
    INSERT INTO mass_core.user_centre_assignments(user_id,centre_id,status,starts_at,approval_reference,approved_by,approved_at)
    VALUES(operation_subject,target_centre,'Active',clock_timestamp(),'Leadership centre assignment',p_actor,statement_timestamp())
    RETURNING id INTO assignment_id;
    changes:=jsonb_build_object('centre',target_centre,'assignment',assignment_id);
   WHEN 'unassign' THEN
    assignment_id:=(p_input->>'assignment')::uuid;
    UPDATE mass_core.user_centre_assignments SET status='Inactive',
      ends_at=greatest(clock_timestamp(),starts_at+interval '1 microsecond'),row_version=row_version+1
     WHERE id=assignment_id AND user_id=operation_subject AND status='Active'
       AND row_version=(p_input->>'assignmentVersion')::bigint RETURNING centre_id INTO target_centre;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='assignment changed; reload'; END IF;
    changes:=jsonb_build_object('centre',target_centre,'assignment',assignment_id);
   WHEN 'deactivate' THEN
    IF subject.status<>'Active' THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='account already inactive'; END IF;
    UPDATE mass_core.user_centre_assignments SET status='Inactive',
      ends_at=greatest(clock_timestamp(),starts_at+interval '1 microsecond'),row_version=row_version+1
      WHERE user_id=operation_subject AND status='Active';
    UPDATE mass_core.application_users SET status='Inactive',require_current_auth_session=true,row_version=row_version+1 WHERE user_id=operation_subject;
    changes:=jsonb_build_object('status','Inactive');
   WHEN 'reactivate' THEN
    IF subject.status<>'Inactive' THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='account already active'; END IF;
  END CASE;
 END IF;

 IF p_action IN ('invite','deactivate','reactivate') THEN
  result:=jsonb_build_object('state','pending','subject',operation_subject);
 END IF;
 INSERT INTO mass_core.user_administration_requests(id,actor_id,subject_id,action,input,state,result)
 VALUES(p_id,p_actor,operation_subject,p_action,p_input,result->>'state',result);
 INSERT INTO mass_core.administration_events(request_id,actor_id,subject_id,action,outcome,changes)
 VALUES(p_id,p_actor,operation_subject,p_action,CASE result->>'state' WHEN 'pending' THEN 'started' ELSE 'complete' END,changes);
 RETURN result;
END;
$$;

CREATE FUNCTION mass_core.administration_finish(p_actor uuid,p_id uuid,p_auth_subject uuid,p_failure text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE req mass_core.user_administration_requests; outcome_json jsonb; step text; event_subject uuid; changes jsonb:='{}';
BEGIN
 PERFORM pg_advisory_xact_lock(1935181321,7);
 PERFORM mass_core.require_administration_leader(p_actor);
 SELECT * INTO req FROM mass_core.user_administration_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR req.state NOT IN ('pending','retry') OR req.action NOT IN ('invite','deactivate','reactivate') THEN
  RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='no pending Auth operation';
 END IF;
 event_subject:=req.subject_id;
 IF p_failure IS NOT NULL THEN
  IF p_failure NOT IN ('auth_unavailable','invite_needs_review','auth_sync_failed') THEN
   RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid sanitized Auth outcome';
  END IF;
  step:=CASE WHEN req.action='invite' THEN 'failed' ELSE 'retry' END;
 ELSIF req.action='invite' THEN
  IF NOT EXISTS (SELECT 1 FROM mass_core.administration_auth_account(p_auth_subject,req.input->>'email')) THEN
   RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invited Auth account mismatch';
  END IF;
  event_subject:=p_auth_subject;
  INSERT INTO mass_core.application_users(user_id,role_code,status,starts_at,approval_reference,approved_by,approved_at)
  VALUES(event_subject,req.input->>'role','Active',statement_timestamp(),'Leadership email invite',p_actor,statement_timestamp());
  changes:=jsonb_build_object('role',req.input->>'role','status','Active');
  step:='complete';
 ELSE
  IF req.subject_id IS DISTINCT FROM p_auth_subject THEN
   RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Auth account mismatch';
  END IF;
  IF req.action='deactivate' THEN
   IF NOT EXISTS (SELECT 1 FROM mass_core.administration_auth_account(req.subject_id,NULL) WHERE banned) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Auth ban has not completed';
   END IF;
   PERFORM mass_core.administration_revoke_auth_sessions(req.subject_id);
  ELSE
   IF NOT EXISTS (SELECT 1 FROM mass_core.administration_auth_account(req.subject_id,NULL) WHERE NOT banned) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Auth unban has not completed';
   END IF;
   UPDATE mass_core.application_users SET status='Active',row_version=row_version+1
    WHERE user_id=req.subject_id AND status='Inactive';
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='application account changed'; END IF;
   changes:='{"status":"Active"}';
  END IF;
  step:='complete';
 END IF;
 outcome_json:=jsonb_build_object('state',step,'failure',p_failure);
 UPDATE mass_core.user_administration_requests SET subject_id=event_subject,state=step,failure=p_failure,result=outcome_json
 WHERE id=p_id;
 INSERT INTO mass_core.administration_events(request_id,actor_id,subject_id,action,outcome,failure,changes)
 VALUES(p_id,p_actor,event_subject,req.action,step,p_failure,changes);
 RETURN outcome_json;
END;
$$;

CREATE FUNCTION mass_core.administration_retry_input(p_actor uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE req mass_core.user_administration_requests;
BEGIN
 PERFORM mass_core.require_administration_leader(p_actor);
 SELECT * INTO req FROM mass_core.user_administration_requests
  WHERE id=p_id AND action IN ('invite','deactivate','reactivate') AND state IN ('pending','retry');
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='no pending Auth operation'; END IF;
 RETURN jsonb_build_object('action',req.action,'input',req.input);
END;
$$;

REVOKE ALL ON FUNCTION mass_core.guard_administration_account(),mass_core.require_administration_leader(uuid),
 mass_core.administration_directory(uuid,text,integer),mass_core.administration_prepare(uuid,uuid,text,jsonb),
 mass_core.administration_finish(uuid,uuid,uuid,text),mass_core.administration_retry_input(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_core.administration_directory(uuid,text,integer),
 mass_core.administration_prepare(uuid,uuid,text,jsonb),mass_core.administration_finish(uuid,uuid,uuid,text),
 mass_core.administration_retry_input(uuid,uuid) TO mass_user_admin_bridge;

-- GoTrue's global sign-out API requires a target access token. The user-id
-- equivalent is the same narrow session-row deletion GoTrue performs itself.
-- Keep its managed-table grant on an isolated, non-login function owner.
GRANT CREATE ON SCHEMA mass_core TO mass_user_admin_auth;
RESET ROLE;
GRANT SELECT (id,user_id),DELETE ON auth.sessions TO mass_user_admin_auth;
SET LOCAL ROLE mass_user_admin_auth;
CREATE FUNCTION mass_core.administration_auth_account(p_subject uuid,p_email text)
RETURNS TABLE(id uuid,email text,confirmed boolean,banned boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id,u.email::text,u.email_confirmed_at IS NOT NULL,coalesce(u.banned_until>statement_timestamp(),false)
 FROM auth.users u
 WHERE (p_subject IS NOT NULL OR p_email IS NOT NULL)
 AND (p_subject IS NULL OR u.id=p_subject) AND (p_email IS NULL OR lower(u.email)=p_email)
 ORDER BY u.id LIMIT 2
$$;
CREATE FUNCTION mass_core.administration_session_is_current(p_subject uuid,p_session text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
  WHERE s.user_id=p_subject AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
    AND s.id=CASE WHEN p_session ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_session::uuid END
 )
$$;
CREATE FUNCTION mass_core.administration_revoke_auth_sessions(p_subject uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DELETE FROM auth.sessions WHERE user_id=p_subject
$$;
REVOKE ALL ON FUNCTION mass_core.administration_revoke_auth_sessions(uuid),mass_core.administration_auth_account(uuid,text),
 mass_core.administration_session_is_current(uuid,text) FROM PUBLIC,anon,authenticated,service_role,mass_user_admin_bridge;
GRANT EXECUTE ON FUNCTION mass_core.administration_revoke_auth_sessions(uuid),mass_core.administration_auth_account(uuid,text),
 mass_core.administration_session_is_current(uuid,text) TO mass_core_owner;
SET LOCAL ROLE mass_core_owner;
REVOKE CREATE ON SCHEMA mass_core FROM mass_user_admin_auth;

-- After reactivation PostgREST can still validate a previously issued JWT.
-- Require a live Auth session for accounts that have been through revocation.
CREATE OR REPLACE FUNCTION mass_core.application_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.role_code FROM mass_core.application_users u
 WHERE u.user_id=mass_core.request_user_id() AND u.status='Active'
 AND (NOT u.require_current_auth_session OR mass_core.administration_session_is_current(u.user_id,
     nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id'))
$$;
CREATE OR REPLACE FUNCTION mass_core.governed_can_read(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN r.role='Leadership' THEN true
   WHEN r.role IS NOT NULL THEN EXISTS(SELECT 1 FROM mass_core.user_centre_assignments a
    WHERE a.user_id=mass_core.request_user_id() AND a.centre_id=c AND a.status='Active')
   ELSE false END
 FROM (SELECT mass_core.application_role() AS role) r
$$;
RESET ROLE;

-- Fail installation if the current managed Auth schema cannot revoke refresh
-- tokens with its sessions. The migration never changes Supabase Auth tables.
DO $auth_contract$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c
  WHERE c.contype='f' AND c.conrelid='auth.refresh_tokens'::regclass
    AND c.confrelid='auth.sessions'::regclass AND c.confdeltype='c'
    AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (session_id)%') THEN
  RAISE EXCEPTION 'Auth session/refresh token cascade must be verified before installing Phase 7';
 END IF;
END $auth_contract$;
COMMIT;
