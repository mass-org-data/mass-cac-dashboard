-- Annual donor summary: add recorded_days (distinct dates with attendance recorded at the centre in the selected academic year).
-- Patches mass_api.dashboard_table_page in place (anchored text replacement; aborts on an unexpected body).
-- Run supabase/activation/seal.sql in the same transaction. Rollback: re-apply the previous function text, then seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $fix$
DECLARE d text;
BEGIN
 IF to_regprocedure('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)') IS NULL THEN
  RAISE NOTICE 'dashboard_table_page is not installed; nothing to change';
  RETURN;
 END IF;
 d:=pg_get_functiondef('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)'::regprocedure);
 IF position('recorded_days' IN d)>0 THEN RAISE NOTICE 'already patched'; RETURN; END IF;
 IF position('count(DISTINCT m.month_key)loaded FROM mass_core.centres c' IN d)=0
    OR position('''percentage'',''loaded'') THEN RAISE EXCEPTION USING ERRCODE=''22023'',MESSAGE=''unsupported annual sort''' IN d)=0
    OR position('CASE WHEN p_sort=''loaded'' AND NOT p_reverse' IN d)=0 THEN
  RAISE EXCEPTION 'Unexpected dashboard_table_page body; review before installation';
 END IF;
 d:=replace(d,'count(DISTINCT m.month_key)loaded FROM mass_core.centres c',
  'count(DISTINCT m.month_key)loaded,(SELECT count(DISTINCT ar.attendance_date) FROM mass_core.attendance_records ar JOIN mass_core.academic_years yr ON yr.id=(p_context->>''year'')::uuid WHERE ar.centre_id=c.id AND ar.attendance_date>=yr.starts_on AND ar.attendance_date<yr.ends_before)::integer recorded_days FROM mass_core.centres c');
 d:=replace(d,'''percentage'',''loaded'') THEN RAISE EXCEPTION USING ERRCODE=''22023'',MESSAGE=''unsupported annual sort''',
  '''percentage'',''loaded'',''days'') THEN RAISE EXCEPTION USING ERRCODE=''22023'',MESSAGE=''unsupported annual sort''');
 d:=replace(d,'CASE WHEN p_sort=''loaded'' AND NOT p_reverse',
  'CASE WHEN p_sort=''days'' AND NOT p_reverse THEN recorded_days END ASC NULLS LAST,CASE WHEN p_sort=''days'' AND p_reverse THEN recorded_days END DESC NULLS LAST,'||chr(10)||'   CASE WHEN p_sort=''loaded'' AND NOT p_reverse');
 EXECUTE d;
END;$fix$;
NOTIFY pgrst,'reload schema';
COMMIT;
