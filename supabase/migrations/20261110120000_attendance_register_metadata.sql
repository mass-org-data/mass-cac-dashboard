-- Additive register metadata. No grants, feature gates, marks or historical actions change.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
ALTER TABLE mass_core.attendance_register_actions ADD COLUMN notes text CHECK(notes IS NULL OR length(notes)<=2000);
-- Match the existing form/client rule at the database boundary, without
-- inferring unknown earlier stages or rewriting historical source observations.
ALTER TABLE mass_core.morarji_outcomes ADD CONSTRAINT morarji_confirmed_stages_consistent
 CHECK (NOT ((attended IS TRUE AND applied IS FALSE) OR
 (passed IS TRUE AND (applied IS FALSE OR attended IS FALSE)))) NOT VALID;

CREATE FUNCTION mass_api.save_attendance_register_v3(p_request uuid,p_centre uuid,p_shift text,p_date date,p_token text,p_rows jsonb,p_reason text DEFAULT 'Attendance entered',p_notes text DEFAULT '') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE before_rows jsonb; r jsonb; e mass_core.enrolments; old mass_core.attendance_records; signature text; previous mass_core.attendance_register_actions; n integer:=0; note_revision uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF NOT coalesce((SELECT enabled FROM mass_core.attendance_register_control),false) OR NOT mass_core.can_write(p_centre) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='attendance register write not authorized';END IF;
 IF p_request IS NULL OR p_date IS NULL OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date OR p_shift IS NULL OR p_shift NOT IN ('Morning','Evening') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 OR p_notes IS NULL OR length(p_notes)>2000 OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid attendance context required';END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 0 AND 500 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x GROUP BY x->>'enrolment' HAVING count(*)>1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded unique marks required';END IF;
 signature:=md5(jsonb_build_array(p_centre,p_shift,p_date,p_token,p_rows,p_reason,p_notes)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('attendance-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.attendance_register_actions WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.signature<>signature OR previous.operation<>'SAVE' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN previous.changed_count;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_centre::text||p_shift||p_date::text,0));
 before_rows:=mass_core.attendance_register_snapshot(p_centre,p_shift,p_date);
 SELECT a.request_id INTO note_revision FROM mass_core.attendance_register_actions a WHERE a.centre_id=p_centre AND a.shift_code=p_shift AND a.attendance_date=p_date AND a.operation='SAVE' AND a.notes IS NOT NULL AND a.changed_at>coalesce((SELECT max(d.changed_at) FROM mass_core.attendance_register_actions d WHERE d.centre_id=p_centre AND d.shift_code=p_shift AND d.attendance_date=p_date AND d.operation='DELETE'),'-infinity'::timestamptz) ORDER BY a.changed_at DESC,a.request_id DESC LIMIT 1;
 IF jsonb_array_length(p_rows)=0 AND jsonb_array_length(before_rows)=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='notes require a saved attendance register';END IF;
 IF p_token IS DISTINCT FROM md5(jsonb_build_array(md5(before_rows::text),note_revision)::text) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance changed; reload the register';END IF;
 -- Install an immutable receipt before any clear operation. RLS and the
 -- attendance-only guard require its exact original row in this transaction.
 SELECT count(*) INTO n FROM jsonb_array_elements(p_rows) x
 LEFT JOIN jsonb_array_elements(before_rows) b ON b->>'enrolment_id'=x->>'enrolment'
 WHERE b->>'code' IS DISTINCT FROM x->>'code';
 INSERT INTO mass_core.attendance_register_actions(request_id,actor_user_id,centre_id,shift_code,attendance_date,operation,reason,signature,before_records,changed_count,notes)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,'SAVE',p_reason,signature,before_rows,n,p_notes);
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

CREATE FUNCTION mass_api.delete_attendance_register_v3(p_request uuid,p_centre uuid,p_shift text,p_date date,p_token text,p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE before_rows jsonb; signature text; previous mass_core.attendance_register_actions; n integer; note_revision uuid;
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
 SELECT a.request_id INTO note_revision FROM mass_core.attendance_register_actions a WHERE a.centre_id=p_centre AND a.shift_code=p_shift AND a.attendance_date=p_date AND a.operation='SAVE' AND a.notes IS NOT NULL AND a.changed_at>coalesce((SELECT max(d.changed_at) FROM mass_core.attendance_register_actions d WHERE d.centre_id=p_centre AND d.shift_code=p_shift AND d.attendance_date=p_date AND d.operation='DELETE'),'-infinity'::timestamptz) ORDER BY a.changed_at DESC,a.request_id DESC LIMIT 1;
 IF p_token IS DISTINCT FROM md5(jsonb_build_array(md5(before_rows::text),note_revision)::text) OR n=0 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance changed; reload the register';END IF;
 INSERT INTO mass_core.attendance_register_actions(request_id,actor_user_id,centre_id,shift_code,attendance_date,operation,reason,signature,before_records,changed_count)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,'DELETE',p_reason,signature,before_rows,n);
 DELETE FROM mass_core.attendance_records WHERE centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date;
 IF (SELECT count(*) FROM mass_core.attendance_records WHERE centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date)<>0 THEN RAISE EXCEPTION 'Register deletion incomplete';END IF;
 RETURN n;
END;$$;

CREATE FUNCTION mass_api.read_attendance_register_v3(p_centre uuid,p_shift text,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE value jsonb; note text; note_revision uuid;
BEGIN
 -- Existing roster API enforces the staff session, writable centre, shift and observed date.
 value:=mass_api.read_attendance_register(p_centre,p_shift,p_date);
 SELECT a.notes,a.request_id INTO note,note_revision FROM mass_core.attendance_register_actions a
 WHERE a.centre_id=p_centre AND a.shift_code=p_shift AND a.attendance_date=p_date AND a.operation='SAVE' AND a.notes IS NOT NULL
 AND a.changed_at>coalesce((SELECT max(d.changed_at) FROM mass_core.attendance_register_actions d WHERE d.centre_id=p_centre AND d.shift_code=p_shift AND d.attendance_date=p_date AND d.operation='DELETE'),'-infinity'::timestamptz)
 ORDER BY a.changed_at DESC,a.request_id DESC LIMIT 1;
 RETURN value||jsonb_build_object('notes',coalesce(note,''),'marks_token',value->>'token','token',md5(jsonb_build_array(value->>'token',note_revision)::text));
END;$$;

CREATE FUNCTION mass_api.attendance_register_summary_v3(p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS TABLE(centre_id uuid,shift_code text,attendance_date date,present bigint,eligible bigint,recorded bigint,percentage numeric,total bigint,created_by text,last_edited_by text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 -- Delegate every authorization check and approved count to the installed v2 API.
 RETURN QUERY SELECT o.*,coalesce(first_actor.label,'Source import / not recorded'),coalesce(last_actor.label,'Source import / not recorded')
 FROM mass_api.attendance_register_summary_v2(p_centres,p_from,p_until,p_shift,p_grade,p_gender) o
 LEFT JOIN LATERAL (SELECT CASE WHEN a.before_records<>'[]'::jsonb THEN 'Source import / not recorded' ELSE coalesce((SELECT min(s.display_name) FROM mass_core.staff_members s WHERE s.auth_user_id=a.actor_user_id),'Authorized staff account') END label
 FROM mass_core.attendance_register_actions a WHERE a.centre_id=o.centre_id AND a.shift_code=o.shift_code AND a.attendance_date=o.attendance_date AND a.operation='SAVE' AND a.changed_at>coalesce((SELECT max(d.changed_at) FROM mass_core.attendance_register_actions d WHERE d.centre_id=o.centre_id AND d.shift_code=o.shift_code AND d.attendance_date=o.attendance_date AND d.operation='DELETE'),'-infinity'::timestamptz)
 ORDER BY a.changed_at,a.request_id LIMIT 1) first_actor ON true
 LEFT JOIN LATERAL (SELECT coalesce((SELECT min(s.display_name) FROM mass_core.staff_members s WHERE s.auth_user_id=a.actor_user_id),'Authorized staff account') label
 FROM mass_core.attendance_register_actions a WHERE a.centre_id=o.centre_id AND a.shift_code=o.shift_code AND a.attendance_date=o.attendance_date AND a.operation='SAVE' AND a.changed_at>coalesce((SELECT max(d.changed_at) FROM mass_core.attendance_register_actions d WHERE d.centre_id=o.centre_id AND d.shift_code=o.shift_code AND d.attendance_date=o.attendance_date AND d.operation='DELETE'),'-infinity'::timestamptz)
 ORDER BY a.changed_at DESC,a.request_id DESC LIMIT 1) last_actor ON true;
END;$$;
REVOKE ALL ON FUNCTION mass_api.delete_attendance_register_v3(uuid,uuid,text,date,text,text),mass_api.save_attendance_register_v3(uuid,uuid,text,date,text,jsonb,text,text),mass_api.read_attendance_register_v3(uuid,text,date),mass_api.attendance_register_summary_v3(uuid[],date,date,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.delete_attendance_register_v3(uuid,uuid,text,date,text,text),mass_api.save_attendance_register_v3(uuid,uuid,text,date,text,jsonb,text,text),mass_api.read_attendance_register_v3(uuid,text,date),mass_api.attendance_register_summary_v3(uuid[],date,date,text,text,text) TO authenticated;
-- Bounded server-side profile search/sort before paging. Only existing
-- writable-centre roster names may participate; private fields stay protected.
CREATE FUNCTION mass_api.student_profile_page(p_centres uuid[],p_on date,p_query text DEFAULT '',p_sort text DEFAULT 'name',p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid; value jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_on IS NULL OR p_on>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_query IS NULL OR length(p_query)>160 OR p_sort IS NULL OR p_sort NOT IN ('name','id','centre','grade','gender','shift','newest') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded profile selection required'; END IF;
 FOREACH c IN ARRAY p_centres LOOP
  IF c IS NULL OR NOT mass_core.can_write(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned operational roster required';END IF;
 END LOOP;
 WITH roster AS (
  SELECT e.id,e.grade_label,e.shift_code,e.starts_on,ch.student_id,co.label centre_name,coalesce(pr.full_name,ch.student_id) student_name,
   CASE WHEN mass_core.can_read_profile(ch.id) THEN pr.gender_code END gender
  FROM mass_core.enrolments e JOIN mass_core.children ch ON ch.id=e.child_id JOIN mass_core.centres co ON co.id=e.centre_id
  LEFT JOIN mass_core.private_child_profiles pr ON pr.child_id=ch.id
  WHERE e.centre_id=ANY(p_centres) AND e.starts_on<=p_on AND (e.ends_before IS NULL OR p_on<e.ends_before)
 ), matching AS (
  SELECT * FROM roster WHERE (p_grade IS NULL OR grade_label=p_grade) AND (p_shift IS NULL OR shift_code=p_shift)
   AND (p_gender IS NULL OR coalesce(gender,'Unknown')=p_gender)
   AND (p_query='' OR position(lower(btrim(p_query)) IN lower(concat_ws(' ',student_name,student_id,centre_name)))>0)
 ), ranked AS (
  SELECT id,row_number() OVER(ORDER BY
   CASE WHEN p_sort='id' THEN student_id END,
   CASE WHEN p_sort='centre' THEN lower(centre_name) END,
   CASE WHEN p_sort='grade' THEN grade_label::integer END,
   CASE WHEN p_sort='gender' THEN coalesce(gender,'') END,
   CASE WHEN p_sort='shift' THEN shift_code END,
   CASE WHEN p_sort='newest' THEN starts_on END DESC,
   lower(student_name),student_id,id) ordinal FROM matching
 ) SELECT jsonb_build_object('total',(SELECT count(*) FROM matching),'ids',coalesce((SELECT jsonb_agg(id ORDER BY ordinal) FROM (SELECT * FROM ranked ORDER BY ordinal LIMIT p_limit OFFSET p_offset) page),'[]'::jsonb)) INTO value;
 RETURN value;
END;$$;
REVOKE ALL ON FUNCTION mass_api.student_profile_page(uuid[],date,text,text,text,text,text,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.student_profile_page(uuid[],date,text,text,text,text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',3,'profile_pages',true,'enabled',coalesce((SELECT enabled FROM mass_core.attendance_register_control),false));
END;$$;
NOTIFY pgrst,'reload schema';
COMMIT;
