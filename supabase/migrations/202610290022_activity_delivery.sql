-- Staff-observed delivery remains separate from the confirmed schedule.
BEGIN;
SET LOCAL ROLE mass_core_owner;
ALTER TABLE mass_core.activity_events ADD COLUMN category text CHECK(category IN ('Cultural','Sports')),
 ADD COLUMN delivery_status text CHECK(delivery_status IN ('Planned','Held','Cancelled'));
CREATE FUNCTION mass_core.guard_activity_detail() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='activity removal unsupported'; END IF;
 IF TG_OP='UPDATE' THEN
 IF NEW.row_version<>OLD.row_version OR (to_jsonb(NEW)-ARRAY['name','category','delivery_status']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['name','category','delivery_status']) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='activity context immutable'; END IF;
 NEW.row_version:=OLD.row_version+1;
 ELSIF NEW.row_version<>1 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='initial revision required'; END IF;
 IF TG_OP='UPDATE' AND NEW.delivery_status IN ('Planned','Cancelled') AND EXISTS(SELECT 1 FROM mass_core.activity_participation WHERE event_id=NEW.id AND participated IS NOT NULL) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='delivery correction conflicts with participation';END IF;
 IF NEW.delivery_status='Held' AND NEW.activity_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='held activity cannot be future'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER guard_write ON mass_core.activity_events;
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.activity_events FOR EACH ROW EXECUTE FUNCTION mass_core.guard_activity_detail();
CREATE FUNCTION mass_core.guard_participation_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.participated IS NOT NULL AND EXISTS(SELECT 1 FROM mass_core.activity_events WHERE id=NEW.event_id AND delivery_status IN ('Planned','Cancelled')) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='participation requires observed activity delivery';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER participation_delivery BEFORE INSERT OR UPDATE ON mass_core.activity_participation FOR EACH ROW EXECUTE FUNCTION mass_core.guard_participation_delivery();
CREATE TABLE mass_core.cac_delivery_records(
 id uuid PRIMARY KEY,centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),session_date date NOT NULL,
 status text NOT NULL CHECK(status IN ('Planned','Held','Cancelled')),row_version bigint NOT NULL DEFAULT 1,
 created_by uuid NOT NULL,updated_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(centre_id,shift_code,session_date)
);
ALTER TABLE mass_core.cac_delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.cac_delivery_records FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.cac_delivery_records TO mass_core_owner USING(true) WITH CHECK(true);
CREATE POLICY scoped_read ON mass_core.cac_delivery_records FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.cac_delivery_records TO authenticated;
CREATE FUNCTION mass_core.guard_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='delivery removal unsupported'; END IF;
 IF NOT mass_core.can_write(NEW.centre_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 IF TG_OP='UPDATE' THEN
 IF NEW.row_version<>OLD.row_version OR (to_jsonb(NEW)-ARRAY['status','updated_by','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_by','updated_at']) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='delivery context immutable'; END IF;NEW.row_version:=OLD.row_version+1;
 END IF;
 IF NEW.status='Held' AND NEW.session_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='held session cannot be future'; END IF;
 IF NEW.status='Held' AND EXISTS(SELECT 1 FROM mass_core.cac_sessions WHERE centre_id=NEW.centre_id AND shift_code=NEW.shift_code AND session_date=NEW.session_date AND NOT is_scheduled) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='held session conflicts with confirmed holiday'; END IF;
 NEW.updated_by:=mass_core.request_user_id();NEW.updated_at:=clock_timestamp();RETURN NEW;
END;
$$;
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.cac_delivery_records FOR EACH ROW EXECUTE FUNCTION mass_core.guard_delivery();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_core.cac_delivery_records FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE FUNCTION mass_api.record_cac_delivery(p_id uuid,p_centre uuid,p_shift text,p_date date,p_status text,p_expected bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.cac_delivery_records; n bigint;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('delivery.'||p_centre::text||p_shift||p_date::text,0));
 SELECT * INTO r FROM mass_core.cac_delivery_records WHERE centre_id=p_centre AND shift_code=p_shift AND session_date=p_date FOR UPDATE;
 IF r.id=p_id AND r.row_version=1 AND p_expected=0 AND r.status=p_status AND r.created_by=mass_core.request_user_id() THEN RETURN 1;END IF;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NULL THEN INSERT INTO mass_core.cac_delivery_records(id,centre_id,shift_code,session_date,status,created_by,updated_by) VALUES(p_id,p_centre,p_shift,p_date,p_status,mass_core.request_user_id(),mass_core.request_user_id()) RETURNING row_version INTO n;
 ELSE IF r.id<>p_id THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='reload delivery identity';END IF;UPDATE mass_core.cac_delivery_records SET status=p_status WHERE id=p_id RETURNING row_version INTO n;END IF;
 INSERT INTO mass_foundation.audit_events(actor_database_principal,actor_database_role,actor_user_id,entity_type,entity_id,operation,change_metadata) VALUES(session_user,current_setting('role'),mass_core.request_user_id(),'core.cac_delivery_records',p_id,CASE WHEN r.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,jsonb_build_object('revision',n));
 RETURN n;
END;
$$;
CREATE FUNCTION mass_api.record_activity_detail(p_id uuid,p_centre uuid,p_shift text,p_date date,p_name text,p_category text,p_status text,p_expected bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.activity_events;n bigint;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('activity.'||p_id::text,0));
 SELECT * INTO r FROM mass_core.activity_events WHERE id=p_id FOR UPDATE;
 IF r.id IS NOT NULL AND (r.centre_id<>p_centre OR r.shift_code<>p_shift OR r.activity_date<>p_date) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='activity context immutable'; END IF;
 IF r.id IS NOT NULL AND p_expected=0 AND r.row_version=1 AND r.name=p_name AND r.category IS NOT DISTINCT FROM p_category AND r.delivery_status IS NOT DISTINCT FROM p_status THEN RETURN 1;END IF;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NULL THEN INSERT INTO mass_core.activity_events(id,centre_id,shift_code,activity_date,name,category,delivery_status) VALUES(p_id,p_centre,p_shift,p_date,p_name,p_category,p_status) RETURNING row_version INTO n;
 ELSE UPDATE mass_core.activity_events SET name=p_name,category=p_category,delivery_status=p_status WHERE id=p_id RETURNING row_version INTO n;END IF;
 RETURN n;
END;
$$;
CREATE FUNCTION mass_api.read_activity_details(p_centre uuid,p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS SETOF mass_core.activity_events LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded dates required';END IF;
 RETURN QUERY SELECT * FROM mass_core.activity_events WHERE centre_id=p_centre AND activity_date>=p_from AND activity_date<p_until ORDER BY activity_date,id LIMIT p_limit OFFSET p_offset;END;
$$;
CREATE FUNCTION mass_api.read_delivery(p_centre uuid,p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS SETOF mass_core.cac_delivery_records LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset,p_from,p_until);
 IF p_from IS NULL OR p_until IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded dates required';END IF;
 RETURN QUERY SELECT * FROM mass_core.cac_delivery_records WHERE centre_id=p_centre AND session_date>=p_from AND session_date<p_until ORDER BY session_date,id LIMIT p_limit OFFSET p_offset;END;
$$;
CREATE OR REPLACE FUNCTION mass_api.get_original_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN PERFORM mass_core.require_staff_session();IF NOT EXISTS(SELECT 1 FROM mass_core.centres) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned scope required';END IF;
 RETURN jsonb_build_object('original_workflows',20,'period_assessments',true,'operational_details',22);END;
$$;
GRANT EXECUTE ON FUNCTION mass_api.record_cac_delivery(uuid,uuid,text,date,text,bigint),mass_api.record_activity_detail(uuid,uuid,text,date,text,text,text,bigint),mass_api.read_activity_details(uuid,date,date,integer,integer),mass_api.read_delivery(uuid,date,date,integer,integer) TO authenticated;
RESET ROLE;
SET LOCAL ROLE mass_foundation_owner;
DO $$ DECLARE def text;BEGIN SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conrelid='mass_foundation.audit_events'::regclass AND conname='audit_events_entity_type_check';
 ALTER TABLE mass_foundation.audit_events DROP CONSTRAINT audit_events_entity_type_check;
 EXECUTE 'ALTER TABLE mass_foundation.audit_events ADD CONSTRAINT audit_events_entity_type_check CHECK (('||substring(def FROM 8 FOR length(def)-8)||') OR entity_type=''core.cac_delivery_records'')';END;$$;
NOTIFY pgrst,'reload schema';
COMMIT;
