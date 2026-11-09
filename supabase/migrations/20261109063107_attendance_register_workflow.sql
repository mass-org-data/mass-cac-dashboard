-- Attendance register API. Installation alone leaves writes disabled.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
LOCK TABLE mass_core.attendance_records IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE attendance_register_install_baseline ON COMMIT DROP AS
 SELECT (SELECT md5(string_agg(md5(to_jsonb(a)::text),'' ORDER BY a.id)) FROM mass_core.attendance_records a) attendance,
 (SELECT md5(string_agg(md5(to_jsonb(g)::text),'' ORDER BY g.id)) FROM mass_core.user_scope_grants g) grants,
 md5(pg_get_functiondef('mass_core.guard_record()'::regprocedure)) guard;
CREATE TABLE mass_core.attendance_register_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 approval_reference text,
 CHECK(NOT enabled OR length(btrim(approval_reference)) BETWEEN 1 AND 160 AND approval_reference IS NOT NULL)
);
INSERT INTO mass_core.attendance_register_control DEFAULT VALUES;
CREATE TABLE mass_core.attendance_register_actions (
 request_id uuid PRIMARY KEY,
 actor_user_id uuid NOT NULL,
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id),
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),
 attendance_date date NOT NULL,
 operation text NOT NULL CHECK(operation IN ('SAVE','DELETE')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 300),
 signature text NOT NULL,
 before_records jsonb NOT NULL,
 changed_count integer NOT NULL,
 transaction_id bigint NOT NULL DEFAULT txid_current(),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mass_core.attendance_register_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.attendance_register_control FORCE ROW LEVEL SECURITY;
ALTER TABLE mass_core.attendance_register_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.attendance_register_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_control ON mass_core.attendance_register_control TO mass_core_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_read ON mass_core.attendance_register_actions FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_append ON mass_core.attendance_register_actions FOR INSERT TO mass_core_owner WITH CHECK(true);
CREATE TRIGGER immutable_action BEFORE UPDATE OR DELETE ON mass_core.attendance_register_actions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_core.attendance_register_actions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
REVOKE ALL ON mass_core.attendance_register_control,mass_core.attendance_register_actions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mass_core.attendance_register_snapshot(p_centre uuid,p_shift text,p_date date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
 FROM mass_core.attendance_records a WHERE a.centre_id=p_centre AND a.shift_code=p_shift AND a.attendance_date=p_date
$$;
REVOKE ALL ON FUNCTION mass_core.attendance_register_snapshot(uuid,text,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',1,'enabled',coalesce((SELECT enabled FROM mass_core.attendance_register_control),false));
END;$$;

CREATE FUNCTION mass_api.attendance_register_summary(p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS TABLE(centre_id uuid,shift_code text,attendance_date date,present bigint,eligible bigint,recorded bigint,percentage numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 200 OR p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>366 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded register scope required';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_centres) c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned read scope required';END IF;
 RETURN QUERY SELECT a.centre_id,a.shift_code,a.attendance_date,
 count(*) FILTER(WHERE a.code='P'),count(*) FILTER(WHERE a.code IN ('P','A','L')),count(*),
 round(100.0*count(*) FILTER(WHERE a.code='P')/nullif(count(*) FILTER(WHERE a.code IN ('P','A','L')),0),1)
 FROM mass_core.attendance_records a JOIN mass_core.enrolments e ON e.id=a.enrolment_id
 LEFT JOIN mass_core.private_child_profiles p ON p.child_id=a.child_id
 WHERE a.centre_id=ANY(p_centres) AND a.attendance_date>=p_from AND a.attendance_date<p_until
 AND (p_shift IS NULL OR a.shift_code=p_shift) AND (p_grade IS NULL OR e.grade_label=p_grade)
 AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender)
 GROUP BY a.centre_id,a.shift_code,a.attendance_date ORDER BY a.attendance_date DESC,a.centre_id,a.shift_code;
END;$$;

CREATE FUNCTION mass_api.read_attendance_register(p_centre uuid,p_shift text,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE roster jsonb; marks jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centre IS NULL OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned write scope required';END IF;
 IF p_date IS NULL OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='observed date and shift required';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'student_id',c.student_id,'name',CASE WHEN mass_core.can_read_profile(e.child_id) THEN p.full_name ELSE NULL END,'grade',e.grade_label) ORDER BY c.student_id,e.id),'[]'::jsonb) INTO roster
 FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.centre_id=p_centre AND e.shift_code=p_shift AND e.starts_on<=p_date AND (e.ends_before IS NULL OR p_date<e.ends_before);
 marks:=mass_core.attendance_register_snapshot(p_centre,p_shift,p_date);
 RETURN jsonb_build_object('roster',roster,'marks',(SELECT coalesce(jsonb_agg(jsonb_build_object('enrolment',x->>'enrolment_id','code',x->>'code','version',x->'row_version')),'[]'::jsonb) FROM jsonb_array_elements(marks) x),'token',md5(marks::text),'recorded',jsonb_array_length(marks));
END;$$;

-- Only attendance's delete guard is specialized. All existing insert/update
-- validation is copied byte-for-byte from the installed authoritative guard.
DO $guard$
DECLARE definition text;needle text;
BEGIN
 definition:=pg_get_functiondef('mass_core.guard_record()'::regprocedure);
 needle:='IF TG_OP IN (''DELETE'',''TRUNCATE'') THEN';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized record guard; installation held';END IF;
 definition:=replace(definition,'FUNCTION mass_core.guard_record()','FUNCTION mass_core.guard_attendance_register()');
 definition:=replace(definition,needle,$body$
 IF TG_OP='DELETE' AND TG_TABLE_SCHEMA='mass_core' AND TG_TABLE_NAME='attendance_records' AND EXISTS(
  SELECT 1 FROM mass_core.attendance_register_actions r WHERE r.transaction_id=txid_current()
   AND r.actor_user_id=mass_core.request_user_id() AND r.operation='DELETE'
   AND r.centre_id=OLD.centre_id AND r.shift_code=OLD.shift_code AND r.attendance_date=OLD.attendance_date
   AND r.before_records @> jsonb_build_array(to_jsonb(OLD))) THEN RETURN OLD; END IF;
 IF TG_OP IN ('DELETE','TRUNCATE') THEN
 $body$);
 EXECUTE definition;
END;$guard$;
REVOKE ALL ON FUNCTION mass_core.guard_attendance_register() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER guard_write ON mass_core.attendance_records;
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.attendance_records FOR EACH ROW EXECUTE FUNCTION mass_core.guard_attendance_register();
-- No direct client DELETE privilege. The private receipt is required by RLS too.
CREATE POLICY owner_register_delete ON mass_core.attendance_records FOR DELETE TO mass_core_owner USING(
 mass_core.can_write(centre_id) AND EXISTS(SELECT 1 FROM mass_core.attendance_register_actions r
 WHERE r.transaction_id=txid_current() AND r.actor_user_id=mass_core.request_user_id() AND r.operation='DELETE'
 AND r.before_records @> jsonb_build_array(to_jsonb(attendance_records))));

CREATE FUNCTION mass_api.save_attendance_register(p_request uuid,p_centre uuid,p_shift text,p_date date,p_token text,p_rows jsonb,p_reason text DEFAULT 'Attendance entered') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE before_rows jsonb; r jsonb; e mass_core.enrolments; old mass_core.attendance_records; signature text; previous mass_core.attendance_register_actions; n integer:=0;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT coalesce((SELECT enabled FROM mass_core.attendance_register_control),false) OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='attendance register write not authorized';END IF;
 IF p_request IS NULL OR p_date IS NULL OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid attendance context required';END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x GROUP BY x->>'enrolment' HAVING count(*)>1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded unique marks required';END IF;
 signature:=md5(jsonb_build_array(p_centre,p_shift,p_date,p_token,p_rows,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('attendance-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.attendance_register_actions WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.signature<>signature OR previous.operation<>'SAVE' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN previous.changed_count;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_centre::text||p_shift||p_date::text,0));
 before_rows:=mass_core.attendance_register_snapshot(p_centre,p_shift,p_date);
 IF p_token IS DISTINCT FROM md5(before_rows::text) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance changed; reload the register';END IF;
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY x->>'enrolment' LOOP
  e:=mass_core.writable_enrolment((r->>'enrolment')::uuid);
  IF e.centre_id<>p_centre OR e.shift_code<>p_shift OR p_date<e.starts_on OR (e.ends_before IS NOT NULL AND p_date>=e.ends_before) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='mark outside register roster';END IF;
  IF r->>'code' IS NULL OR r->>'code' NOT IN ('P','A','L','MM','WO') OR (r->>'code'='WO' AND extract(isodow FROM p_date)<>7) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='approved attendance code required';END IF;
  SELECT * INTO old FROM mass_core.attendance_records WHERE child_id=e.child_id AND centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date FOR UPDATE;
  IF old.id IS NULL THEN
   INSERT INTO mass_core.attendance_records(child_id,centre_id,shift_code,enrolment_id,attendance_date,code) VALUES(e.child_id,p_centre,p_shift,e.id,p_date,r->>'code');n:=n+1;
  ELSE
   IF old.enrolment_id<>e.id THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance episode conflict';END IF;
   IF old.code IS DISTINCT FROM r->>'code' THEN UPDATE mass_core.attendance_records SET code=r->>'code' WHERE id=old.id;n:=n+1;END IF;
  END IF;
 END LOOP;
 INSERT INTO mass_core.attendance_register_actions(request_id,actor_user_id,centre_id,shift_code,attendance_date,operation,reason,signature,before_records,changed_count)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,'SAVE',p_reason,signature,before_rows,n);
 RETURN n;
END;$$;

CREATE FUNCTION mass_api.delete_attendance_register(p_request uuid,p_centre uuid,p_shift text,p_date date,p_token text,p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE before_rows jsonb; signature text; previous mass_core.attendance_register_actions; n integer;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT coalesce((SELECT enabled FROM mass_core.attendance_register_control),false) OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='attendance register delete not authorized';END IF;
 IF p_request IS NULL OR p_date IS NULL OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='context and deletion reason required';END IF;
 signature:=md5(jsonb_build_array(p_centre,p_shift,p_date,p_token,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('attendance-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.attendance_register_actions WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.signature<>signature OR previous.operation<>'DELETE' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN previous.changed_count;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_centre::text||p_shift||p_date::text,0));
 before_rows:=mass_core.attendance_register_snapshot(p_centre,p_shift,p_date);n:=jsonb_array_length(before_rows);
 IF p_token IS DISTINCT FROM md5(before_rows::text) OR n=0 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance changed; reload the register';END IF;
 INSERT INTO mass_core.attendance_register_actions(request_id,actor_user_id,centre_id,shift_code,attendance_date,operation,reason,signature,before_records,changed_count)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,'DELETE',p_reason,signature,before_rows,n);
 DELETE FROM mass_core.attendance_records WHERE centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date;
 IF (SELECT count(*) FROM mass_core.attendance_records WHERE centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date)<>0 THEN RAISE EXCEPTION 'Register deletion incomplete';END IF;
 RETURN n;
END;$$;

REVOKE ALL ON FUNCTION mass_api.get_attendance_register_capabilities(),mass_api.attendance_register_summary(uuid[],date,date,text,text,text),mass_api.read_attendance_register(uuid,text,date),mass_api.save_attendance_register(uuid,uuid,text,date,text,jsonb,text),mass_api.delete_attendance_register(uuid,uuid,text,date,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.get_attendance_register_capabilities(),mass_api.attendance_register_summary(uuid[],date,date,text,text,text),mass_api.read_attendance_register(uuid,text,date),mass_api.save_attendance_register(uuid,uuid,text,date,text,jsonb,text),mass_api.delete_attendance_register(uuid,uuid,text,date,text,text) TO authenticated;
DO $preserve$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM attendance_register_install_baseline b WHERE
 b.attendance IS NOT DISTINCT FROM (SELECT md5(string_agg(md5(to_jsonb(a)::text),'' ORDER BY a.id)) FROM mass_core.attendance_records a)
 AND b.grants IS NOT DISTINCT FROM (SELECT md5(string_agg(md5(to_jsonb(g)::text),'' ORDER BY g.id)) FROM mass_core.user_scope_grants g)
 AND b.guard=md5(pg_get_functiondef('mass_core.guard_record()'::regprocedure))) THEN RAISE EXCEPTION 'Attendance installation preservation check failed';END IF;
END;$preserve$;
NOTIFY pgrst,'reload schema';
COMMIT;
