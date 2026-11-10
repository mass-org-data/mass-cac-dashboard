-- Additive update: explicit clearing with immutable history and roster names
-- only inside the already authorized writable attendance roster.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
LOCK TABLE mass_core.attendance_records IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE attendance_update_baseline ON COMMIT DROP AS SELECT
 (SELECT md5(string_agg(md5(to_jsonb(a)::text),'' ORDER BY a.id)) FROM mass_core.attendance_records a) attendance,
 (SELECT md5(string_agg(md5(to_jsonb(g)::text),'' ORDER BY g.id)) FROM mass_core.user_scope_grants g) grants;
DO $guard$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('mass_core.guard_attendance_register()'::regprocedure);
 IF position('r.operation=''DELETE''' IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized attendance guard';END IF;
 EXECUTE replace(definition,'r.operation=''DELETE''','r.operation IN (''DELETE'',''SAVE'')');
END;$guard$;
ALTER POLICY owner_register_delete ON mass_core.attendance_records USING(
 mass_core.can_write(centre_id) AND EXISTS(SELECT 1 FROM mass_core.attendance_register_actions r
 WHERE r.transaction_id=txid_current() AND r.actor_user_id=mass_core.request_user_id() AND r.operation IN ('DELETE','SAVE')
 AND r.before_records @> jsonb_build_array(to_jsonb(attendance_records))));
CREATE OR REPLACE FUNCTION mass_api.read_attendance_register(p_centre uuid,p_shift text,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE roster jsonb; marks jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centre IS NULL OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned write scope required';END IF;
 IF p_date IS NULL OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='observed date and shift required';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'student_id',c.student_id,'name',p.full_name,'grade',e.grade_label) ORDER BY c.student_id,e.id),'[]'::jsonb) INTO roster
 FROM mass_core.enrolments e JOIN mass_core.children c ON c.id=e.child_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.centre_id=p_centre AND e.shift_code=p_shift AND e.starts_on<=p_date AND (e.ends_before IS NULL OR p_date<e.ends_before);
 marks:=mass_core.attendance_register_snapshot(p_centre,p_shift,p_date);
 RETURN jsonb_build_object('roster',roster,'marks',(SELECT coalesce(jsonb_agg(jsonb_build_object('enrolment',x->>'enrolment_id','code',x->>'code','version',x->'row_version')),'[]'::jsonb) FROM jsonb_array_elements(marks) x),'token',md5(marks::text),'recorded',jsonb_array_length(marks));
END;$$;

CREATE OR REPLACE FUNCTION mass_api.save_attendance_register(p_request uuid,p_centre uuid,p_shift text,p_date date,p_token text,p_rows jsonb,p_reason text DEFAULT 'Attendance entered') RETURNS integer
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
 -- Install an immutable receipt before any clear operation. RLS and the
 -- attendance-only guard require its exact original row in this transaction.
 SELECT count(*) INTO n FROM jsonb_array_elements(p_rows) x
 LEFT JOIN jsonb_array_elements(before_rows) b ON b->>'enrolment_id'=x->>'enrolment'
 WHERE b->>'code' IS DISTINCT FROM x->>'code';
 INSERT INTO mass_core.attendance_register_actions(request_id,actor_user_id,centre_id,shift_code,attendance_date,operation,reason,signature,before_records,changed_count)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,'SAVE',p_reason,signature,before_rows,n);
 n:=0;
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY x->>'enrolment' LOOP
  e:=mass_core.writable_enrolment((r->>'enrolment')::uuid);
  IF e.centre_id<>p_centre OR e.shift_code<>p_shift OR p_date<e.starts_on OR (e.ends_before IS NOT NULL AND p_date>=e.ends_before) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='mark outside register roster';END IF;
  IF NOT (r ? 'code') OR (r->>'code' IS NOT NULL AND r->>'code' NOT IN ('P','A','L','MM','WO')) OR (r->>'code'='WO' AND extract(isodow FROM p_date)<>7) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='approved attendance code required';END IF;
  SELECT * INTO old FROM mass_core.attendance_records WHERE child_id=e.child_id AND centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date FOR UPDATE;
  IF r->>'code' IS NULL THEN
   IF old.id IS NOT NULL THEN
    IF old.enrolment_id<>e.id THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance episode conflict';END IF;
    DELETE FROM mass_core.attendance_records WHERE id=old.id;n:=n+1;
   END IF;
  ELSIF old.id IS NULL THEN
   INSERT INTO mass_core.attendance_records(child_id,centre_id,shift_code,enrolment_id,attendance_date,code) VALUES(e.child_id,p_centre,p_shift,e.id,p_date,r->>'code');n:=n+1;
  ELSE
   IF old.enrolment_id<>e.id THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance episode conflict';END IF;
   IF old.code IS DISTINCT FROM r->>'code' THEN UPDATE mass_core.attendance_records SET code=r->>'code' WHERE id=old.id;n:=n+1;END IF;
  END IF;
 END LOOP;
 IF n<>(SELECT changed_count FROM mass_core.attendance_register_actions WHERE request_id=p_request) THEN RAISE EXCEPTION 'Attendance change count mismatch';END IF;
 RETURN n;
END;$$;

CREATE FUNCTION mass_api.attendance_register_summary_v2(p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS TABLE(centre_id uuid,shift_code text,attendance_date date,present bigint,eligible bigint,recorded bigint,percentage numeric,total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN QUERY SELECT o.*,(SELECT count(DISTINCT e.child_id) FROM mass_core.enrolments e
 LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id
 WHERE e.centre_id=o.centre_id AND e.shift_code=o.shift_code AND e.starts_on<=o.attendance_date
 AND (e.ends_before IS NULL OR o.attendance_date<e.ends_before)
 AND (p_grade IS NULL OR e.grade_label=p_grade)
 AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender))
 FROM mass_api.attendance_register_summary(p_centres,p_from,p_until,p_shift,p_grade,p_gender) o;
END;$$;
REVOKE ALL ON FUNCTION mass_api.attendance_register_summary_v2(uuid[],date,date,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.attendance_register_summary_v2(uuid[],date,date,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',2,'enabled',coalesce((SELECT enabled FROM mass_core.attendance_register_control),false));
END;$$;
DO $preserve$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM attendance_update_baseline b WHERE b.attendance IS NOT DISTINCT FROM
 (SELECT md5(string_agg(md5(to_jsonb(a)::text),'' ORDER BY a.id)) FROM mass_core.attendance_records a)
 AND b.grants IS NOT DISTINCT FROM (SELECT md5(string_agg(md5(to_jsonb(g)::text),'' ORDER BY g.id)) FROM mass_core.user_scope_grants g)) THEN RAISE EXCEPTION 'Attendance update preservation check failed';END IF;
END;$preserve$;
NOTIFY pgrst,'reload schema';
COMMIT;
