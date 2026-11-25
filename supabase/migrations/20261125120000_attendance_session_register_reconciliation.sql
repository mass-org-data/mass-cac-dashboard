-- List every attendance-backed session in the saved register and permit an
-- explicitly audited, concurrency-checked correction of its session type.
-- This migration installs contracts only; the existing attendance_entry gate
-- remains authoritative and no hosted data is changed by installation.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE FUNCTION mass_api.attendance_register_page_v3(
 p_centres uuid[],p_from date,p_until date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL,
 p_offset integer DEFAULT 0,p_limit integer DEFAULT 10,p_sort text DEFAULT 'date',p_reverse boolean DEFAULT true,p_query text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;c uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>31
  OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_reverse IS NULL
  OR p_query IS NULL OR length(p_query)>160 OR p_sort NOT IN ('centre','shift','date','session','present','percentage','last_edited_at') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded register page required';END IF;
 FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre required';END IF;END LOOP;
 WITH all_rows AS MATERIALIZED(
  SELECT a.centre_id,a.shift_code,a.attendance_date,a.present,a.eligible,a.recorded,a.percentage,a.total,a.created_by,
   CASE WHEN converted.changed_at>a.last_edited_at OR a.last_edited_at IS NULL THEN converted.label ELSE a.last_edited_by END AS last_edited_by,
   greatest(a.last_edited_at,converted.changed_at) AS last_edited_at,c.label AS centre_label,'Classroom'::text AS session_type,NULL::text AS session_subtype
  FROM mass_api.attendance_register_summary_v4(p_centres,p_from,p_until,p_shift,p_grade,p_gender)a JOIN mass_core.centres c ON c.id=a.centre_id
  LEFT JOIN LATERAL(SELECT x.changed_at,coalesce((SELECT min(m.display_name) FROM mass_core.staff_members m WHERE m.auth_user_id=x.actor_user_id),'Staff account '||left(md5(x.actor_user_id::text),8))label FROM mass_core.attendance_session_conversion_actions x WHERE x.centre_id=a.centre_id AND x.shift_code=a.shift_code AND x.session_date=a.attendance_date AND x.to_type='Classroom' ORDER BY x.changed_at DESC,x.request_id DESC LIMIT 1)converted ON true
  UNION ALL
  SELECT s.centre_id,s.shift_code,s.session_date,0::bigint,0::bigint,0::bigint,NULL::numeric,
   (SELECT count(*) FROM mass_core.enrolments e LEFT JOIN mass_core.private_child_profiles p ON p.child_id=e.child_id WHERE e.centre_id=s.centre_id AND e.shift_code=s.shift_code AND e.starts_on<=s.session_date AND (e.ends_before IS NULL OR s.session_date<e.ends_before) AND (p_grade IS NULL OR e.grade_label=p_grade) AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender)),
   coalesce(actor.label,'Source import / not recorded'),coalesce(actor.label,'Source import / not recorded'),actor.changed_at,c.label,'Holiday'::text,NULL::text
  FROM mass_core.cac_sessions s JOIN mass_core.centres c ON c.id=s.centre_id
  LEFT JOIN LATERAL(SELECT changed_at,coalesce((SELECT min(m.display_name) FROM mass_core.staff_members m WHERE m.auth_user_id=r.actor_user_id),'Staff account '||left(md5(r.actor_user_id::text),8))label FROM mass_core.attendance_register_actions r WHERE r.centre_id=s.centre_id AND r.shift_code=s.shift_code AND r.attendance_date=s.session_date ORDER BY changed_at DESC LIMIT 1)actor ON true
  WHERE s.centre_id=ANY(p_centres) AND NOT s.is_scheduled AND s.session_date>=p_from AND s.session_date<p_until AND (p_shift IS NULL OR s.shift_code=p_shift)
   AND NOT EXISTS(SELECT 1 FROM mass_core.attendance_records a WHERE a.centre_id=s.centre_id AND a.shift_code=s.shift_code AND a.attendance_date=s.session_date AND a.session_type='Classroom')
  UNION ALL
  SELECT a.centre_id,a.shift_code,a.attendance_date,
   count(*) FILTER(WHERE a.code IN ('MMP','ADP'))::bigint,
   roster.eligible,
   count(*)::bigint,
   round(100.0*count(*) FILTER(WHERE a.code IN ('MMP','ADP'))/nullif(count(*),0),1),
   roster.eligible,
   coalesce(actor.label,'Source import / not recorded'),coalesce(actor.label,'Source import / not recorded'),actor.changed_at,c.label,a.session_type,a.session_subtype
  FROM mass_core.attendance_records a
  JOIN mass_core.enrolments e ON e.id=a.enrolment_id
  LEFT JOIN mass_core.private_child_profiles p ON p.child_id=a.child_id
  JOIN mass_core.centres c ON c.id=a.centre_id
  LEFT JOIN LATERAL(SELECT count(*)::bigint eligible FROM mass_core.enrolments re LEFT JOIN mass_core.private_child_profiles rp ON rp.child_id=re.child_id WHERE re.centre_id=a.centre_id AND re.shift_code=a.shift_code AND re.starts_on<=a.attendance_date AND (re.ends_before IS NULL OR a.attendance_date<re.ends_before) AND (p_grade IS NULL OR re.grade_label=p_grade) AND (p_gender IS NULL OR coalesce(rp.gender_code,'Unknown')=p_gender))roster ON true
  LEFT JOIN LATERAL(SELECT x.changed_at,coalesce((SELECT min(m.display_name) FROM mass_core.staff_members m WHERE m.auth_user_id=x.actor_user_id),'Staff account '||left(md5(x.actor_user_id::text),8))label FROM (
   SELECT s.request_id,s.actor_user_id,s.changed_at FROM mass_core.student_session_actions s WHERE s.centre_id=a.centre_id AND s.shift_code=a.shift_code AND s.session_date=a.attendance_date AND s.session_type=a.session_type AND s.session_subtype IS NOT DISTINCT FROM a.session_subtype
   UNION ALL
   SELECT v.request_id,v.actor_user_id,v.changed_at FROM mass_core.attendance_session_conversion_actions v WHERE v.centre_id=a.centre_id AND v.shift_code=a.shift_code AND v.session_date=a.attendance_date AND v.to_type=a.session_type AND v.to_subtype IS NOT DISTINCT FROM a.session_subtype
  )x ORDER BY x.changed_at DESC,x.request_id DESC LIMIT 1)actor ON true
  WHERE a.session_type IN ('Monthly Meeting','Activity Day') AND a.centre_id=ANY(p_centres) AND a.attendance_date>=p_from AND a.attendance_date<p_until
   AND (p_shift IS NULL OR a.shift_code=p_shift) AND (p_grade IS NULL OR e.grade_label=p_grade) AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender)
  GROUP BY a.centre_id,a.shift_code,a.attendance_date,a.session_type,a.session_subtype,roster.eligible,actor.label,actor.changed_at,c.label
 ),filtered AS MATERIALIZED(SELECT * FROM all_rows WHERE p_query='' OR centre_label ILIKE '%'||p_query||'%' OR shift_code ILIKE '%'||p_query||'%' OR attendance_date::text ILIKE '%'||p_query||'%' OR session_type ILIKE '%'||p_query||'%' OR coalesce(session_subtype,'') ILIKE '%'||p_query||'%'),
 page AS(SELECT * FROM filtered ORDER BY
  CASE WHEN p_sort='centre' AND NOT p_reverse THEN lower(centre_label) END ASC NULLS LAST,CASE WHEN p_sort='centre' AND p_reverse THEN lower(centre_label) END DESC NULLS LAST,
  CASE WHEN p_sort='shift' AND NOT p_reverse THEN shift_code END ASC NULLS LAST,CASE WHEN p_sort='shift' AND p_reverse THEN shift_code END DESC NULLS LAST,
  CASE WHEN p_sort='date' AND NOT p_reverse THEN attendance_date END ASC NULLS LAST,CASE WHEN p_sort='date' AND p_reverse THEN attendance_date END DESC NULLS LAST,
  CASE WHEN p_sort='session' AND NOT p_reverse THEN lower(session_type||coalesce(session_subtype,'')) END ASC NULLS LAST,CASE WHEN p_sort='session' AND p_reverse THEN lower(session_type||coalesce(session_subtype,'')) END DESC NULLS LAST,
  CASE WHEN p_sort='present' AND NOT p_reverse THEN present END ASC NULLS LAST,CASE WHEN p_sort='present' AND p_reverse THEN present END DESC NULLS LAST,
  CASE WHEN p_sort='percentage' AND NOT p_reverse THEN percentage END ASC NULLS LAST,CASE WHEN p_sort='percentage' AND p_reverse THEN percentage END DESC NULLS LAST,
  CASE WHEN p_sort='last_edited_at' AND NOT p_reverse THEN last_edited_at END ASC NULLS LAST,CASE WHEN p_sort='last_edited_at' AND p_reverse THEN last_edited_at END DESC NULLS LAST,
  attendance_date DESC,centre_id,shift_code,session_type,session_subtype OFFSET p_offset LIMIT p_limit)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)-'centre_label') FROM page x),'[]'::jsonb)) INTO result;
 RETURN result;
END;$$;

CREATE FUNCTION mass_core.attendance_session_snapshot(p_centre uuid,p_shift text,p_date date,p_type text,p_subtype text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
 FROM mass_core.attendance_records a
 WHERE a.centre_id=p_centre AND a.shift_code=p_shift AND a.attendance_date=p_date AND a.session_type=p_type AND a.session_subtype IS NOT DISTINCT FROM p_subtype
$$;
REVOKE ALL ON FUNCTION mass_core.attendance_session_snapshot(uuid,text,date,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE mass_core.attendance_session_conversion_actions(
 request_id uuid PRIMARY KEY,actor_user_id uuid NOT NULL,centre_id uuid NOT NULL REFERENCES mass_core.centres(id),
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),session_date date NOT NULL,
 from_type text NOT NULL,from_subtype text,to_type text NOT NULL,to_subtype text,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 300),signature text NOT NULL,before_records jsonb NOT NULL,
 changed_count integer NOT NULL,transaction_id bigint NOT NULL DEFAULT txid_current(),changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(from_type IN ('Classroom','Monthly Meeting','Activity Day') AND to_type IN ('Classroom','Monthly Meeting','Activity Day')),
 CHECK((from_type='Classroom' AND from_subtype IS NULL) OR (from_type='Monthly Meeting' AND from_subtype IS NULL) OR (from_type='Activity Day' AND from_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2'))),
 CHECK((to_type='Classroom' AND to_subtype IS NULL) OR (to_type='Monthly Meeting' AND to_subtype IS NULL) OR (to_type='Activity Day' AND to_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2')))
);
ALTER TABLE mass_core.attendance_session_conversion_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.attendance_session_conversion_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY attendance_session_conversion_owner ON mass_core.attendance_session_conversion_actions TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER immutable_attendance_session_conversion BEFORE UPDATE OR DELETE ON mass_core.attendance_session_conversion_actions FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate_attendance_session_conversion BEFORE TRUNCATE ON mass_core.attendance_session_conversion_actions FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
REVOKE ALL ON mass_core.attendance_session_conversion_actions FROM PUBLIC,anon,authenticated,service_role;

-- The attendance trigger otherwise permits only the established mutable fields.
-- A conversion may change only code/type/subtype/row_version and only after the
-- immutable receipt for this transaction has captured the exact old row.
DO $conversion_guard$
DECLARE d text;needle text;
BEGIN
 d:=pg_get_functiondef('mass_core.guard_attendance_register()'::regprocedure);
 needle:='IF TG_OP=''DELETE'' AND TG_TABLE_SCHEMA=''mass_core'' AND TG_TABLE_NAME=''attendance_records'' AND EXISTS(';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Unexpected attendance guard; conversion installation held';END IF;
 d:=replace(d,needle,$guard$
 IF TG_OP='UPDATE' AND TG_TABLE_SCHEMA='mass_core' AND TG_TABLE_NAME='attendance_records' AND EXISTS(
  SELECT 1 FROM mass_core.attendance_session_conversion_actions r WHERE r.transaction_id=txid_current()
   AND r.actor_user_id=mass_core.request_user_id() AND r.centre_id=OLD.centre_id AND r.shift_code=OLD.shift_code AND r.session_date=OLD.attendance_date
   AND r.from_type=OLD.session_type AND r.from_subtype IS NOT DISTINCT FROM OLD.session_subtype
   AND r.to_type=NEW.session_type AND r.to_subtype IS NOT DISTINCT FROM NEW.session_subtype
   AND r.before_records @> jsonb_build_array(to_jsonb(OLD))) THEN
  IF (to_jsonb(NEW)-ARRAY['code','session_type','session_subtype','row_version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['code','session_type','session_subtype','row_version']) THEN
   RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='session conversion cannot change attendance identity';END IF;
  NEW.row_version:=OLD.row_version+1;RETURN NEW;
 END IF;
 IF TG_OP='DELETE' AND TG_TABLE_SCHEMA='mass_core' AND TG_TABLE_NAME='attendance_records' AND EXISTS($guard$);
 EXECUTE d;
END;$conversion_guard$;

CREATE FUNCTION mass_api.convert_attendance_session_register(
 p_request uuid,p_centre uuid,p_shift text,p_date date,p_from_type text,p_from_subtype text,p_to_type text,p_to_subtype text,p_token text,p_rows jsonb,p_reason text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE before_rows jsonb;r jsonb;e mass_core.enrolments;old mass_core.attendance_records;previous mass_core.attendance_session_conversion_actions;signature text;n integer:=0;expected integer;stored_code text;source_lock text;target_lock text;
BEGIN
 PERFORM mass_core.require_staff_session();
 PERFORM mass_core.require_operation_enabled('attendance_entry');
 IF p_request IS NULL OR p_centre IS NULL OR NOT mass_core.can_write(p_centre) OR p_shift NOT IN ('Morning','Evening') OR p_date IS NULL OR p_date>(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
  OR NOT ((p_from_type='Classroom' AND p_from_subtype IS NULL) OR (p_from_type='Monthly Meeting' AND p_from_subtype IS NULL) OR (p_from_type='Activity Day' AND p_from_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2')))
  OR NOT ((p_to_type='Classroom' AND p_to_subtype IS NULL) OR (p_to_type='Monthly Meeting' AND p_to_subtype IS NULL) OR (p_to_type='Activity Day' AND p_to_subtype IN ('Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2')))
  OR (p_from_type=p_to_type AND p_from_subtype IS NOT DISTINCT FROM p_to_subtype)
  OR (p_to_type='Classroom' AND EXISTS(SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=p_centre AND s.shift_code=p_shift AND s.session_date=p_date AND NOT s.is_scheduled))
  OR p_token IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows)x GROUP BY x->>'enrolment' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows)x WHERE x->>'code' NOT IN ('P','A')) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid complete attendance session conversion required';END IF;
 signature:=md5(jsonb_build_array(p_centre,p_shift,p_date,p_from_type,p_from_subtype,p_to_type,p_to_subtype,p_token,p_rows,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('attendance-session-conversion-request.'||p_request::text,0));
 SELECT * INTO previous FROM mass_core.attendance_session_conversion_actions WHERE request_id=p_request;
 IF previous.request_id IS NOT NULL THEN
  IF previous.actor_user_id IS DISTINCT FROM mass_core.request_user_id() OR previous.signature<>signature THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='request identity conflict';END IF;
  RETURN previous.changed_count;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_centre::text||p_shift||p_date::text,0));
 source_lock:='student-session.'||p_centre||'.'||p_shift||'.'||p_date||'.'||p_from_type||'.'||coalesce(p_from_subtype,'');
 target_lock:='student-session.'||p_centre||'.'||p_shift||'.'||p_date||'.'||p_to_type||'.'||coalesce(p_to_subtype,'');
 PERFORM pg_advisory_xact_lock(hashtextextended(least(source_lock,target_lock),0));
 PERFORM pg_advisory_xact_lock(hashtextextended(greatest(source_lock,target_lock),0));
 before_rows:=mass_core.attendance_session_snapshot(p_centre,p_shift,p_date,p_from_type,p_from_subtype);
 IF p_token IS DISTINCT FROM md5(before_rows::text) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='attendance session changed; reload the register';END IF;
 SELECT count(*) INTO expected FROM mass_core.enrolments x WHERE x.centre_id=p_centre AND x.shift_code=p_shift AND x.starts_on<=p_date AND (x.ends_before IS NULL OR p_date<x.ends_before);
 IF jsonb_array_length(p_rows)<>expected OR jsonb_array_length(before_rows)<>expected
  OR EXISTS(SELECT 1 FROM mass_core.enrolments x WHERE x.centre_id=p_centre AND x.shift_code=p_shift AND x.starts_on<=p_date AND (x.ends_before IS NULL OR p_date<x.ends_before) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows)j WHERE j->>'enrolment'=x.id::text)) THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='student roster changed or saved session is incomplete; reload the register';END IF;
 IF jsonb_array_length(mass_core.attendance_session_snapshot(p_centre,p_shift,p_date,p_to_type,p_to_subtype))<>0 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='target attendance session already exists';END IF;
 INSERT INTO mass_core.attendance_session_conversion_actions(request_id,actor_user_id,centre_id,shift_code,session_date,from_type,from_subtype,to_type,to_subtype,reason,signature,before_records,changed_count)
 VALUES(p_request,mass_core.request_user_id(),p_centre,p_shift,p_date,p_from_type,p_from_subtype,p_to_type,p_to_subtype,btrim(p_reason),signature,before_rows,expected);
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows)x ORDER BY x->>'enrolment' LOOP
  e:=mass_core.writable_enrolment((r->>'enrolment')::uuid);
  IF e.centre_id<>p_centre OR e.shift_code<>p_shift OR p_date<e.starts_on OR (e.ends_before IS NOT NULL AND p_date>=e.ends_before) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='mark outside attendance session roster';END IF;
  SELECT * INTO old FROM mass_core.attendance_records WHERE enrolment_id=e.id AND centre_id=p_centre AND shift_code=p_shift AND attendance_date=p_date AND session_type=p_from_type AND session_subtype IS NOT DISTINCT FROM p_from_subtype FOR UPDATE;
  IF old.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='saved attendance session changed; reload the register';END IF;
  stored_code:=CASE WHEN p_to_type='Classroom' THEN r->>'code' WHEN p_to_type='Monthly Meeting' AND r->>'code'='P' THEN 'MMP' WHEN p_to_type='Monthly Meeting' THEN 'MMA' WHEN r->>'code'='P' THEN 'ADP' ELSE 'ADA' END;
  UPDATE mass_core.attendance_records SET code=stored_code,session_type=p_to_type,session_subtype=p_to_subtype WHERE id=old.id;
  n:=n+1;
 END LOOP;
 IF n<>expected THEN RAISE EXCEPTION 'attendance session conversion count mismatch';END IF;
 RETURN n;
END;$$;

CREATE OR REPLACE FUNCTION mass_api.get_attendance_register_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 RETURN jsonb_build_object('version',8,'holiday_code',true,'profile_pages',true,'assessment_register',true,'register_timestamps',true,'profile_sort_v2',true,'register_paging',true,'present_distribution',true,'session_entry',true,'student_sessions',true,'all_session_registers',true,'session_conversion',true,'academic_history',true,'enabled',coalesce((SELECT enabled FROM mass_core.attendance_register_control),false));
END;$$;

REVOKE ALL ON FUNCTION mass_api.attendance_register_page_v3(uuid[],date,date,text,text,text,integer,integer,text,boolean,text),mass_api.convert_attendance_session_register(uuid,uuid,text,date,text,text,text,text,text,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.attendance_register_page_v3(uuid[],date,date,text,text,text,integer,integer,text,boolean,text),mass_api.convert_attendance_session_register(uuid,uuid,text,date,text,text,text,text,text,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
