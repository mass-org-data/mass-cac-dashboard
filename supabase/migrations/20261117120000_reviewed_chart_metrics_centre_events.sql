-- Re-apply the centre-event report patch of 20261111120000 after 20261114130000 replaced reviewed_chart_metrics.
-- 20261114130000 rebuilds the function from the reviewed proposal text, which has no centre-event handling, so on a database that
-- applied both (in file order) the report would count Monthly meetings as activities and ignore Both-shifts events again.
-- This file is idempotent and works in any order: it changes the function only when it is installed, the event_kind column exists
-- and the patch is not already present; otherwise it does nothing. The expected source text is asserted before replacing, so an
-- unexpected function aborts the transaction instead of being rewritten blindly.
-- The activation guard is re-applied by supabase/activation/seal.sql: run seal.sql in the same transaction.
-- Rollback: re-run 20261114130000_reviewed_chart_metrics_efficiency.sql (no centre-event handling) and seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $reports$
DECLARE d text;
BEGIN
 IF to_regprocedure('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='mass_core' AND table_name='activity_events' AND column_name='event_kind') THEN
  RAISE NOTICE 'reviewed_chart_metrics or activity_events.event_kind is not installed; nothing to patch';
  RETURN;
 END IF;
 d:=pg_get_functiondef('mass_api.reviewed_chart_metrics(uuid[],date,date,date,uuid,text,text,text,integer,integer)'::regprocedure);
 IF position('e.event_kind=''Activity''' IN d)>0 THEN
  RAISE NOTICE 'reviewed_chart_metrics already handles centre events; nothing to patch';
  RETURN;
 END IF;
 IF position('e.delivery_status=''Held'' AND (p_shift IS NULL OR e.shift_code=p_shift)' IN d)=0 OR position('p.shift_code=e.shift_code AND e.activity_date' IN d)=0 THEN RAISE EXCEPTION 'Unexpected reviewed event calculation; review before installation';END IF;
 d:=replace(d,'e.delivery_status=''Held'' AND (p_shift IS NULL OR e.shift_code=p_shift)','e.delivery_status=''Held'' AND e.event_kind=''Activity'' AND (p_shift IS NULL OR e.shift_code=p_shift OR e.shift_code=''Both shifts'')');
 d:=replace(d,'p.shift_code=e.shift_code AND e.activity_date','(p.shift_code=e.shift_code OR e.shift_code=''Both shifts'') AND e.activity_date');
 EXECUTE d;
END;$reports$;
NOTIFY pgrst,'reload schema';
COMMIT;
