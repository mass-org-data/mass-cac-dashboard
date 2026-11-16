-- One centre event can serve both shifts. Existing identities and observations stay intact.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
ALTER TABLE mass_core.activity_events DROP CONSTRAINT activity_events_shift_code_check;
ALTER TABLE mass_core.activity_events ADD CONSTRAINT activity_events_shift_code_check CHECK(shift_code IN ('Morning','Evening','Both shifts'));
ALTER TABLE mass_core.activity_events ADD COLUMN event_kind text NOT NULL DEFAULT 'Activity' CHECK(event_kind IN ('Activity','Monthly meeting'));
ALTER TABLE mass_core.activity_events ADD CONSTRAINT centre_event_identity UNIQUE(id,centre_id);
DO $fk$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='mass_core.activity_participation'::regclass AND confrelid='mass_core.activity_events'::regclass AND contype='f' LOOP
  EXECUTE format('ALTER TABLE mass_core.activity_participation DROP CONSTRAINT %I',c.conname);
 END LOOP;
END;$fk$;
ALTER TABLE mass_core.activity_participation ADD CONSTRAINT participation_centre_event FOREIGN KEY(event_id,centre_id) REFERENCES mass_core.activity_events(id,centre_id) ON DELETE RESTRICT;
-- Retain the separate enrolment/child/centre/actual-shift FK unchanged.
CREATE UNIQUE INDEX centre_monthly_meeting_once ON mass_core.activity_events(centre_id,(date_trunc('month',activity_date::timestamp))) WHERE event_kind='Monthly meeting' AND delivery_status IS DISTINCT FROM 'Cancelled';
CREATE UNIQUE INDEX centre_activity_once ON mass_core.activity_events(centre_id,activity_date,(lower(btrim(name)))) WHERE shift_code='Both shifts' AND event_kind='Activity' AND delivery_status IS DISTINCT FROM 'Cancelled';
CREATE FUNCTION mass_core.guard_centre_event_scope() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM mass_core.activity_events e WHERE e.id=NEW.event_id AND e.centre_id=NEW.centre_id AND (e.shift_code='Both shifts' OR e.shift_code=NEW.shift_code)) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='participation must match the centre and event shift scope';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER centre_event_scope BEFORE INSERT OR UPDATE ON mass_core.activity_participation FOR EACH ROW EXECUTE FUNCTION mass_core.guard_centre_event_scope();
CREATE FUNCTION mass_core.guard_centre_event_kind() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.event_kind='Monthly meeting' AND (NEW.shift_code<>'Both shifts' OR NEW.category IS NOT NULL) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='monthly meeting covers both shifts and has no activity category';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER centre_event_kind BEFORE INSERT OR UPDATE ON mass_core.activity_events FOR EACH ROW EXECUTE FUNCTION mass_core.guard_centre_event_kind();
-- Extend only the installed event-scope predicate. Keep its staff/activation/revision guards.
DO $participation$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('mass_api.record_participation(uuid,uuid,boolean,bigint)'::regprocedure);
 IF position('AND shift_code=e.shift_code)' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected participation API; review before installation';END IF;
 EXECUTE replace(definition,'AND shift_code=e.shift_code)','AND (shift_code=e.shift_code OR shift_code=''Both shifts''))');
END;$participation$;
-- New register saves must not use MM as a classroom mark. Keep all history readable.
DO $classroom$
DECLARE d text;
BEGIN
 IF to_regprocedure('mass_api.save_attendance_register_v3(uuid,uuid,text,date,text,jsonb,text,text)') IS NOT NULL THEN
  d:=pg_get_functiondef('mass_api.save_attendance_register_v3(uuid,uuid,text,date,text,jsonb,text,text)'::regprocedure);
  IF position('NOT IN (''A'',''P'',''H'',''MM'')' IN d)=0 THEN RAISE EXCEPTION 'Unexpected register code validation';END IF;
  EXECUTE replace(d,'NOT IN (''A'',''P'',''H'',''MM'')','NOT IN (''A'',''P'',''H'')');
 END IF;
END;$classroom$;
CREATE FUNCTION mass_api.get_centre_event_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',1,'activities_per_centre_month',4,'meetings_per_centre_month',1);
END;$$;
CREATE FUNCTION mass_api.record_centre_event(p_id uuid,p_centre uuid,p_date date,p_kind text,p_name text,p_category text,p_status text,p_expected bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r mass_core.activity_events;n bigint;
BEGIN
 PERFORM mass_core.require_staff_session();
 PERFORM mass_core.require_operation_enabled('activities');
 IF NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required';END IF;
 IF p_id IS NULL OR p_date IS NULL OR p_kind IS NULL OR p_kind NOT IN ('Activity','Monthly meeting') OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR p_status IS NULL OR p_status NOT IN ('Planned','Held','Cancelled') OR (p_category IS NOT NULL AND p_category NOT IN ('Cultural','Sports')) OR (p_kind='Monthly meeting' AND p_category IS NOT NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid centre event required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('centre-event.'||p_centre::text||date_trunc('month',p_date::timestamp)::text,0));
 SELECT * INTO r FROM mass_core.activity_events WHERE id=p_id FOR UPDATE;
 IF r.id IS NOT NULL AND (r.centre_id<>p_centre OR r.activity_date<>p_date OR r.shift_code<>'Both shifts' OR r.event_kind<>p_kind) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='event identity, kind, date and scope are immutable';END IF;
 IF r.id IS NOT NULL AND p_expected=0 AND r.row_version=1 AND r.name=btrim(p_name) AND r.category IS NOT DISTINCT FROM p_category AND r.delivery_status=p_status THEN RETURN 1;END IF;
 PERFORM mass_core.expected_version(r.row_version,p_expected);
 IF r.id IS NULL THEN INSERT INTO mass_core.activity_events(id,centre_id,shift_code,activity_date,event_kind,name,category,delivery_status) VALUES(p_id,p_centre,'Both shifts',p_date,p_kind,btrim(p_name),p_category,p_status) RETURNING row_version INTO n;
 ELSE UPDATE mass_core.activity_events SET name=btrim(p_name),category=p_category,delivery_status=p_status WHERE id=p_id RETURNING row_version INTO n;END IF;
 RETURN n;
END;$$;
-- Centre-level counts are independent of student grade/gender/shift filters.
CREATE FUNCTION mass_api.centre_event_summary(p_centres uuid[],p_from date,p_until date)
RETURNS TABLE(centre_id uuid,activity_planned integer,activity_held bigint,meeting_planned integer,meeting_held bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='bounded readable centre scope required';END IF;
 IF p_from IS NULL OR p_until IS NULL OR extract(day FROM p_from)<>1 OR p_until<>(p_from+interval '1 month')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='one calendar month required';END IF;
 RETURN QUERY SELECT c.id,4,count(e.id) FILTER(WHERE e.event_kind='Activity' AND e.delivery_status='Held' AND e.shift_code='Both shifts'),1,count(e.id) FILTER(WHERE e.event_kind='Monthly meeting' AND e.delivery_status='Held') FROM (SELECT DISTINCT unnest(p_centres) id)c LEFT JOIN mass_core.activity_events e ON e.centre_id=c.id AND e.activity_date>=p_from AND e.activity_date<p_until GROUP BY c.id;
END;$$;
REVOKE ALL ON FUNCTION mass_api.get_centre_event_capabilities(),mass_api.record_centre_event(uuid,uuid,date,text,text,text,text,bigint),mass_api.centre_event_summary(uuid[],date,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.get_centre_event_capabilities(),mass_api.record_centre_event(uuid,uuid,date,text,text,text,text,bigint),mass_api.centre_event_summary(uuid[],date,date) TO authenticated;
-- Installed reporting must include both-shift activity participation, excluding MM.
-- Local fixtures that install reviewed024 afterwards apply the same guarded patch afterwards.
DO $reports$
DECLARE d text;
BEGIN
 IF to_regprocedure('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)') IS NOT NULL THEN
  d:=pg_get_functiondef('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)'::regprocedure);
  IF position('e.delivery_status=''Held'' AND (p_shift IS NULL OR e.shift_code=p_shift)' IN d)=0 OR position('p.shift_code=e.shift_code AND e.activity_date' IN d)=0 THEN RAISE EXCEPTION 'Unexpected reviewed event calculation; review before installation';END IF;
  d:=replace(d,'e.delivery_status=''Held'' AND (p_shift IS NULL OR e.shift_code=p_shift)','e.delivery_status=''Held'' AND e.event_kind=''Activity'' AND (p_shift IS NULL OR e.shift_code=p_shift OR e.shift_code=''Both shifts'')');
  d:=replace(d,'p.shift_code=e.shift_code AND e.activity_date','(p.shift_code=e.shift_code OR e.shift_code=''Both shifts'') AND e.activity_date');
  EXECUTE d;
 END IF;
END;$reports$;
REVOKE ALL ON FUNCTION mass_core.guard_centre_event_scope(),mass_core.guard_centre_event_kind() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
