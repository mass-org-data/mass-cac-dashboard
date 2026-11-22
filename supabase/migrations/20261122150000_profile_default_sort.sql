-- Student profile list: composite default sort key 'default' = centre A-Z, Morning before Evening, grade 1..10, then name.
-- Patches mass_api.student_profile_page in place (anchored text replacement; aborts on an unexpected body).
-- Header-click sorting keeps the existing single keys. Run supabase/activation/seal.sql in the same transaction.
-- Rollback: re-apply the previous function text (20261118140000), then seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $fix$
DECLARE d text; f text:='mass_api.student_profile_page(uuid[],date,text,text,text,text,text,integer,integer,text)';
BEGIN
 IF to_regprocedure(f) IS NULL THEN RAISE NOTICE 'student_profile_page is not installed; nothing to change'; RETURN; END IF;
 d:=pg_get_functiondef(to_regprocedure(f));
 IF position('''default''' IN d)>0 THEN RAISE NOTICE 'already patched'; RETURN; END IF;
 IF position('''name'',''id'',''centre'',''grade'',''gender'',''shift'',''newest''' IN d)=0
    OR position('   CASE WHEN p_sort=''id'' THEN student_id END,' IN d)=0 THEN
  RAISE EXCEPTION 'Unexpected student_profile_page body; review before installation';
 END IF;
 d:=replace(d,'''name'',''id'',''centre'',''grade'',''gender'',''shift'',''newest''','''name'',''id'',''centre'',''grade'',''gender'',''shift'',''newest'',''default''');
 d:=replace(d,'   CASE WHEN p_sort=''id'' THEN student_id END,',
  '   CASE WHEN p_sort=''default'' THEN lower(centre_name) END,CASE WHEN p_sort=''default'' THEN CASE shift_code WHEN ''Morning'' THEN 0 ELSE 1 END END,CASE WHEN p_sort=''default'' THEN grade_label::integer END,'||chr(10)||'   CASE WHEN p_sort=''id'' THEN student_id END,');
 EXECUTE d;
END;$fix$;
NOTIFY pgrst,'reload schema';
COMMIT;
