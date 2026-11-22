-- Fix: mass_api.dashboard_table_page source 'morarji_followup' failed with 42702 "column reference "result" is ambiguous".
-- The function declares a PL/pgSQL variable named result and the follow-up query orders by a column named result.
-- `#variable_conflict use_column` makes a bare `result` inside a query mean the column; INTO and RETURN keep using the variable.
-- Only where the function is installed (Preview, and Production once 20261117180000 is released). Idempotent and anchored:
-- an unexpected function body aborts the transaction instead of being rewritten blindly. Run supabase/activation/seal.sql in the
-- same transaction (it re-applies the activation guard). Rollback: re-apply 20261117180000 text of the function, then seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $fix$
DECLARE d text;
BEGIN
 IF to_regprocedure('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)') IS NULL THEN
  RAISE NOTICE 'dashboard_table_page is not installed; nothing to fix';
  RETURN;
 END IF;
 d:=pg_get_functiondef('mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)'::regprocedure);
 IF position('#variable_conflict use_column' IN d)>0 THEN
  RAISE NOTICE 'dashboard_table_page already resolves the result column; nothing to fix';
  RETURN;
 END IF;
 IF position('DECLARE result jsonb;report jsonb;' IN d)=0 THEN RAISE EXCEPTION 'Unexpected dashboard_table_page body; review before installation';END IF;
 d:=replace(d,'DECLARE result jsonb;report jsonb;','#variable_conflict use_column'||chr(10)||'DECLARE result jsonb;report jsonb;');
 EXECUTE d;
END;$fix$;
NOTIFY pgrst,'reload schema';
COMMIT;
