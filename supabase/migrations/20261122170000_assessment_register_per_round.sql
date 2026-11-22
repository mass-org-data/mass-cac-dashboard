-- Assessment register (chart/table 4.9): one row per centre + shift + round instead of one row per observed date.
-- assessment_date is the latest observed date in the group; students are summed (one result per child per round) and the
-- average is weighted by students. Patches mass_api.dashboard_table_page in place (anchored; aborts on an unexpected body).
-- Run supabase/activation/seal.sql in the same transaction. Rollback: re-apply the previous function text, then seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $fix$
DECLARE d text; f regprocedure:=to_regprocedure('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)');
 a1 text:=$a$SELECT a.*,c.label centre_label FROM mass_api.assessment_register_summary($a$;
 b1 text:=$b$SELECT a.centre_id,a.shift_code,max(a.assessment_date) assessment_date,a.quarter,sum(a.students)::bigint students,sum(a.average_score*a.students)/nullif(sum(a.students),0) average_score,min(a.created_by) created_by,max(a.last_edited_by) last_edited_by,max(a.last_edited_at) last_edited_at,c.label centre_label FROM mass_api.assessment_register_summary($b$;
 a2 text:=$a$nullif(p_context->>'gender',''))a JOIN mass_core.centres c ON c.id=a.centre_id)$a$;
 b2 text:=$b$nullif(p_context->>'gender',''))a JOIN mass_core.centres c ON c.id=a.centre_id GROUP BY a.centre_id,a.shift_code,a.quarter,c.label)$b$;
BEGIN
 IF f IS NULL THEN RAISE NOTICE 'dashboard_table_page is not installed; nothing to change'; RETURN; END IF;
 d:=pg_get_functiondef(f);
 IF position('GROUP BY a.centre_id,a.shift_code,a.quarter,c.label' IN d)>0 THEN RAISE NOTICE 'already patched'; RETURN; END IF;
 IF position(a1 IN d)=0 OR position(a2 IN d)=0 THEN RAISE EXCEPTION 'Unexpected dashboard_table_page body; review before installation'; END IF;
 EXECUTE replace(replace(d,a1,b1),a2,b2);
END;$fix$;
NOTIFY pgrst,'reload schema';
COMMIT;
