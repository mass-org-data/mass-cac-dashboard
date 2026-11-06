-- Verified officer linkage, visits and restricted revision history; no staff grants/data.
BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.officer_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 scope_grant_id uuid NOT NULL REFERENCES mass_core.user_scope_grants(id) ON DELETE RESTRICT,
 directory_assignment_id uuid NOT NULL REFERENCES mass_core.centre_staff_assignments(id) ON DELETE RESTRICT,
 starts_on date NOT NULL,ends_before date CHECK(ends_before>starts_on),
 shift_scope text NOT NULL CHECK(shift_scope='Both shifts'),
 verification_reference text NOT NULL CHECK(length(btrim(verification_reference)) BETWEEN 1 AND 160),
 UNIQUE(scope_grant_id,directory_assignment_id,starts_on)
);
CREATE FUNCTION mass_core.guard_officer_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='verified assignment correction requires reviewed migration'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g JOIN mass_core.centre_staff_assignments d ON d.centre_id=g.centre_id
 WHERE g.id=NEW.scope_grant_id AND d.id=NEW.directory_assignment_id AND g.role_code='Cluster Officer' AND d.role_code='Cluster Officer') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='verified officer-centre linkage required'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER verified_link BEFORE INSERT OR UPDATE OR DELETE ON mass_core.officer_assignments FOR EACH ROW EXECUTE FUNCTION mass_core.guard_officer_assignment();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_core.officer_assignments FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TABLE mass_core.cluster_officer_visits(
 id uuid PRIMARY KEY,
 assignment_id uuid NOT NULL REFERENCES mass_core.officer_assignments(id) ON DELETE RESTRICT,
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 officer_id uuid NOT NULL REFERENCES mass_core.staff_members(id) ON DELETE RESTRICT,
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),
 visit_date date NOT NULL,status text NOT NULL CHECK(status IN ('Planned','Completed')),
 feedback text NOT NULL DEFAULT '' CHECK(length(feedback)<=2000),
 next_action text NOT NULL DEFAULT '' CHECK(length(next_action)<=2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 row_version bigint NOT NULL DEFAULT 1 CHECK(row_version>0),
 created_by uuid NOT NULL,last_updated_by uuid NOT NULL,
 CHECK(status<>'Completed' OR length(btrim(feedback))>0)
);
CREATE INDEX visit_scope_month ON mass_core.cluster_officer_visits(centre_id,visit_date,shift_code,status);
CREATE INDEX visit_officer_month ON mass_core.cluster_officer_visits(officer_id,visit_date);
CREATE TABLE mass_core.visit_revisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),visit_id uuid NOT NULL REFERENCES mass_core.cluster_officer_visits(id) ON DELETE RESTRICT,
 operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE')),previous_values jsonb,new_values jsonb NOT NULL,
 actor_user_id uuid NOT NULL,changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),revision bigint NOT NULL,
 correction_reason text CHECK(length(correction_reason)<=500),UNIQUE(visit_id,revision),
 CHECK(operation<>'UPDATE' OR length(btrim(correction_reason))>0)
);
CREATE FUNCTION mass_core.can_record_visit(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mass_core.can_write(c) AND EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=mass_core.request_user_id() AND g.centre_id=c AND g.role_code='Cluster Officer' AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
$$;
CREATE FUNCTION mass_core.guard_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='visit deletion unsupported'; END IF;
 IF NOT mass_core.can_record_visit(NEW.centre_id) OR NOT EXISTS(
 SELECT 1 FROM mass_core.officer_assignments a JOIN mass_core.user_scope_grants g ON g.id=a.scope_grant_id
 JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
 WHERE a.id=NEW.assignment_id AND g.user_id=mass_core.request_user_id() AND g.centre_id=NEW.centre_id
 AND d.staff_member_id=NEW.officer_id AND d.centre_id=NEW.centre_id AND g.role_code='Cluster Officer' AND d.role_code='Cluster Officer'
 AND a.shift_scope='Both shifts' AND a.starts_on<=NEW.visit_date AND (a.ends_before IS NULL OR NEW.visit_date<a.ends_before)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified dated officer assignment required'; END IF;
 IF NEW.status='Completed' AND NEW.visit_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='completed visit cannot be future'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.created_by<>mass_core.request_user_id() OR (to_jsonb(NEW)-ARRAY['status','feedback','next_action','visit_date','shift_code','last_updated_by','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','feedback','next_action','visit_date','shift_code','last_updated_by','updated_at']) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='visit identity immutable'; END IF;
  NEW.row_version:=OLD.row_version+1;
 ELSIF NEW.row_version<>1 OR NEW.created_by<>mass_core.request_user_id() THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='initial visit actor/revision required'; END IF;
 NEW.last_updated_by:=mass_core.request_user_id();NEW.updated_at:=clock_timestamp();RETURN NEW;
END;
$$;
CREATE TRIGGER guard_visit BEFORE INSERT OR UPDATE OR DELETE ON mass_core.cluster_officer_visits FOR EACH ROW EXECUTE FUNCTION mass_core.guard_visit();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_core.cluster_officer_visits FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON mass_core.visit_revisions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_core.visit_revisions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['officer_assignments','cluster_officer_visits','visit_revisions'] LOOP
 EXECUTE format('ALTER TABLE mass_core.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE mass_core.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_access ON mass_core.%I TO mass_core_owner USING(true) WITH CHECK(true)',t);
END LOOP;END;$$;
-- No direct API/table access, no anonymous grants, no raw Leadership visit notes.
CREATE FUNCTION mass_api.get_visit_assignments() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF mass_core.request_user_id() IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'centre_id',g.centre_id,'officer_id',d.staff_member_id,'shift_scope',a.shift_scope,'starts_on',a.starts_on,'ends_before',a.ends_before))
 FROM mass_core.officer_assignments a JOIN mass_core.user_scope_grants g ON g.id=a.scope_grant_id JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
 WHERE g.user_id=mass_core.request_user_id() AND mass_core.can_record_visit(g.centre_id)),'[]'::jsonb);
END;
$$;
CREATE FUNCTION mass_api.record_visit(p_id uuid,p_assignment uuid,p_shift text,p_date date,p_status text,p_feedback text,p_next_action text,p_expected bigint,p_reason text DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old mass_core.cluster_officer_visits; n mass_core.cluster_officer_visits; c uuid; officer uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_id IS NULL OR p_date IS NULL OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_status IS NULL OR p_status NOT IN ('Planned','Completed') OR p_feedback IS NULL OR length(p_feedback)>2000 OR p_next_action IS NULL OR length(p_next_action)>2000 OR (p_status='Completed' AND length(btrim(p_feedback))=0) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='valid visit fields and completed feedback required';END IF;
 SELECT g.centre_id,d.staff_member_id INTO c,officer FROM mass_core.officer_assignments a JOIN mass_core.user_scope_grants g ON g.id=a.scope_grant_id JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id WHERE a.id=p_assignment AND g.user_id=mass_core.request_user_id();
 IF c IS NULL OR NOT mass_core.can_record_visit(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified officer scope required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visit.'||p_id::text,0));
 SELECT * INTO old FROM mass_core.cluster_officer_visits WHERE id=p_id FOR UPDATE;
 IF old.id IS NOT NULL AND old.created_by<>mass_core.request_user_id() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='visit author correction required'; END IF;
 -- Retry of an identical initial request returns existing revision, never a duplicate.
 IF old.id IS NOT NULL AND p_expected=0 AND old.row_version=1 AND old.assignment_id=p_assignment AND old.shift_code=p_shift AND old.visit_date=p_date AND old.status=p_status AND old.feedback=p_feedback AND old.next_action=p_next_action THEN RETURN old.row_version; END IF;
 PERFORM mass_core.expected_version(old.row_version,p_expected);
 IF old.id IS NULL THEN
  INSERT INTO mass_core.cluster_officer_visits(id,assignment_id,centre_id,officer_id,shift_code,visit_date,status,feedback,next_action,created_by,last_updated_by)
  VALUES(p_id,p_assignment,c,officer,p_shift,p_date,p_status,p_feedback,p_next_action,mass_core.request_user_id(),mass_core.request_user_id()) RETURNING * INTO n;
 ELSE
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500 OR old.assignment_id<>p_assignment THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='correction reason and original assignment required'; END IF;
  UPDATE mass_core.cluster_officer_visits SET shift_code=p_shift,visit_date=p_date,status=p_status,feedback=p_feedback,next_action=p_next_action WHERE id=p_id RETURNING * INTO n;
 END IF;
 INSERT INTO mass_core.visit_revisions(visit_id,operation,previous_values,new_values,actor_user_id,revision,correction_reason)
 VALUES(p_id,CASE WHEN old.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old) END,to_jsonb(n),mass_core.request_user_id(),n.row_version,p_reason);
 INSERT INTO mass_foundation.audit_events(actor_database_principal,actor_database_role,actor_user_id,entity_type,entity_id,operation,change_metadata)
 VALUES(session_user,current_setting('role'),mass_core.request_user_id(),'core.cluster_officer_visits',p_id,CASE WHEN old.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,jsonb_build_object('revision',n.row_version));
 RETURN n.row_version;
END;
$$;
CREATE FUNCTION mass_api.read_visits(p_centre uuid,p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS SETOF mass_core.cluster_officer_visits LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>366 OR p_limit NOT BETWEEN 1 AND 100 OR p_offset NOT BETWEEN 0 AND 100000 OR p_limit IS NULL OR p_offset IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded visit window required'; END IF;
 IF NOT mass_core.can_record_visit(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer detail scope required'; END IF;
 RETURN QUERY SELECT * FROM mass_core.cluster_officer_visits v WHERE v.centre_id=p_centre AND v.created_by=mass_core.request_user_id() AND v.visit_date>=p_from AND v.visit_date<p_until ORDER BY v.visit_date,v.id LIMIT p_limit OFFSET p_offset;
END;
$$;
CREATE FUNCTION mass_api.read_visit_history(p_visit uuid) RETURNS SETOF mass_core.visit_revisions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT EXISTS(SELECT 1 FROM mass_core.cluster_officer_visits v WHERE v.id=p_visit AND v.created_by=mass_core.request_user_id() AND mass_core.can_record_visit(v.centre_id)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer history scope required'; END IF;
 RETURN QUERY SELECT * FROM mass_core.visit_revisions WHERE visit_id=p_visit ORDER BY revision;
END;
$$;
-- Aggregate only: no feedback, next-action, account identity or private profiles.
CREATE FUNCTION mass_api.visit_summary(p_centre uuid,p_from date,p_until date,p_officer uuid DEFAULT NULL)
RETURNS TABLE(centre_id uuid,morning bigint,evening bigint,target_morning integer,target_evening integer,achieved boolean,recorded_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE eligible boolean;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_read(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required'; END IF;
 IF p_from IS NULL OR p_until IS NULL OR extract(day FROM p_from)<>1 OR p_until<>(p_from+interval '1 month')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='one calendar month required'; END IF;
 eligible:=p_officer IS NULL OR EXISTS(SELECT 1 FROM mass_core.officer_assignments a JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id WHERE d.centre_id=p_centre AND d.staff_member_id=p_officer AND a.starts_on<p_until AND (a.ends_before IS NULL OR a.ends_before>p_from));
 IF NOT eligible THEN RETURN; END IF;
 RETURN QUERY SELECT p_centre,count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Morning'),count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Evening'),2,2,
 count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Morning')>=2 AND count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Evening')>=2,count(*)
 FROM mass_core.cluster_officer_visits v WHERE v.centre_id=p_centre AND v.visit_date>=p_from AND v.visit_date<p_until AND (p_officer IS NULL OR v.officer_id=p_officer);
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.get_visit_assignments(),mass_api.record_visit(uuid,uuid,text,date,text,text,text,bigint,text),mass_api.read_visits(uuid,date,date,integer,integer),mass_api.read_visit_history(uuid),mass_api.visit_summary(uuid,date,date,uuid) TO authenticated;
CREATE FUNCTION mass_api.visit_officer_summary(p_centre uuid,p_from date,p_until date)
RETURNS TABLE(officer_id uuid,label text,morning bigint,evening bigint,target_morning integer,target_evening integer,recorded_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_read(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required';END IF;
 IF p_from IS NULL OR p_until IS NULL OR extract(day FROM p_from)<>1 OR p_until<>(p_from+interval '1 month')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='one calendar month required';END IF;
 RETURN QUERY SELECT d.staff_member_id,s.display_name,
 (SELECT count(*) FROM mass_core.cluster_officer_visits v WHERE v.officer_id=d.staff_member_id AND v.centre_id=p_centre AND v.visit_date>=p_from AND v.visit_date<p_until AND v.status='Completed' AND v.shift_code='Morning'),
 (SELECT count(*) FROM mass_core.cluster_officer_visits v WHERE v.officer_id=d.staff_member_id AND v.centre_id=p_centre AND v.visit_date>=p_from AND v.visit_date<p_until AND v.status='Completed' AND v.shift_code='Evening'),2,2,(SELECT count(*) FROM mass_core.cluster_officer_visits v WHERE v.officer_id=d.staff_member_id AND v.centre_id=p_centre AND v.visit_date>=p_from AND v.visit_date<p_until)
 FROM mass_core.officer_assignments a JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id JOIN mass_core.staff_members s ON s.id=d.staff_member_id
 WHERE d.centre_id=p_centre AND a.starts_on<p_until AND (a.ends_before IS NULL OR a.ends_before>p_from) GROUP BY d.staff_member_id,s.display_name;
END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.visit_officer_summary(uuid,date,date) TO authenticated;
RESET ROLE;
SET LOCAL ROLE mass_foundation_owner;
DO $$ DECLARE def text;BEGIN
 SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conrelid='mass_foundation.audit_events'::regclass AND conname='audit_events_entity_type_check';
 EXECUTE 'ALTER TABLE mass_foundation.audit_events DROP CONSTRAINT audit_events_entity_type_check';
 EXECUTE 'ALTER TABLE mass_foundation.audit_events ADD CONSTRAINT audit_events_entity_type_check CHECK (('||substring(def FROM 8 FOR length(def)-8)||') OR entity_type=''core.cluster_officer_visits'')';
END;$$;
NOTIFY pgrst,'reload schema';
COMMIT;
