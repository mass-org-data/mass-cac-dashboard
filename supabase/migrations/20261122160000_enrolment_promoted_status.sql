-- Year-end grade promotion. Owner decision (22 Nov 2026): a student who moves to the next grade after the academic year gets
-- status 'Promoted' on the closed enrolment, with the academic-year boundary (1 April) as its end date; a student who leaves mid-year
-- keeps 'Left programme' with the actual end date. 'Graduated' stays for students who finish the programme.
-- 1. Allow 'Promoted' on enrolments and per-year academic profiles. 2. Show it in the profile history.
-- 3. mass_api.promote_student closes the current enrolment and opens the next-grade enrolment atomically (gate: enrolments).
-- Run supabase/activation/seal.sql in the same transaction. Rollback: no row may use Promoted; restore the old CHECKs, drop the function.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
DO $c$
DECLARE n text;
BEGIN
 SELECT conname INTO n FROM pg_constraint WHERE conrelid='mass_core.enrolments'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%Left programme%';
 IF n IS NULL THEN RAISE EXCEPTION 'enrolment status constraint not found'; END IF;
 EXECUTE format('ALTER TABLE mass_core.enrolments DROP CONSTRAINT %I',n);
 ALTER TABLE mass_core.enrolments ADD CONSTRAINT enrolments_status_code_check CHECK(status_code IN ('Active','CAC dropout','Left programme','Promoted'));
 SELECT conname INTO n FROM pg_constraint WHERE conrelid='mass_core.student_academic_profiles'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%Dropped Out%';
 IF n IS NULL THEN RAISE EXCEPTION 'academic status constraint not found'; END IF;
 EXECUTE format('ALTER TABLE mass_core.student_academic_profiles DROP CONSTRAINT %I',n);
 ALTER TABLE mass_core.student_academic_profiles ADD CONSTRAINT student_academic_profiles_status_check CHECK(status IN ('Active','Graduated','Dropped Out','Promoted'));
END;$c$;

DO $h$
DECLARE d text; f regprocedure:=to_regprocedure('mass_api.student_academic_history(uuid)');
BEGIN
 IF f IS NULL THEN RAISE EXCEPTION 'student_academic_history is not installed'; END IF;
 d:=pg_get_functiondef(f);
 IF position('''Promoted''' IN d)>0 THEN RETURN; END IF;
 IF position('WHEN ''CAC dropout'' THEN ''Dropped Out'' ELSE NULL END status' IN d)=0 THEN RAISE EXCEPTION 'Unexpected student_academic_history body; review before installation'; END IF;
 EXECUTE replace(d,'WHEN ''CAC dropout'' THEN ''Dropped Out'' ELSE NULL END status','WHEN ''CAC dropout'' THEN ''Dropped Out'' WHEN ''Promoted'' THEN ''Promoted'' ELSE NULL END status');
END;$h$;

CREATE FUNCTION mass_api.promote_student(p_enrolment uuid,p_expected bigint,p_grade text,p_start date,p_shift text DEFAULT NULL,p_centre uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e mass_core.enrolments; old_year mass_core.academic_years; target_centre uuid; target_shift text; result uuid;
BEGIN
 SELECT * INTO e FROM mass_core.enrolments WHERE id=p_enrolment FOR UPDATE;
 IF e.id IS NULL OR NOT mass_core.can_write(e.centre_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 target_centre:=coalesce(p_centre,e.centre_id); target_shift:=coalesce(p_shift,e.shift_code);
 IF NOT mass_core.can_write(target_centre) OR NOT mass_core.can_write_child(e.child_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='verified source and destination scope required'; END IF;
 PERFORM mass_core.expected_version(e.row_version,p_expected);
 IF e.ends_before IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='the enrolment is already closed'; END IF;
 IF p_grade IS NULL OR p_grade !~ '^(10|[1-9])$' OR target_shift NOT IN ('Morning','Evening') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='grade 1-10 and a valid shift are required'; END IF;
 IF p_start IS NULL OR extract(month FROM p_start)<>4 OR extract(day FROM p_start)<>1 OR p_start<=e.starts_on THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='the new enrolment must start on 1 April, after the current one'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.starts_on=p_start) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='that academic year is not configured'; END IF;
 SELECT * INTO old_year FROM mass_core.academic_years y WHERE e.starts_on>=y.starts_on AND e.starts_on<y.ends_before;
 UPDATE mass_core.enrolments SET ends_before=p_start,status_code='Promoted' WHERE id=e.id;
 IF old_year.id IS NOT NULL THEN
  INSERT INTO mass_core.student_academic_profiles(child_id,academic_year_id,enrolment_id,grade_label,status) VALUES(e.child_id,old_year.id,e.id,e.grade_label,'Promoted')
  ON CONFLICT(child_id,academic_year_id) DO UPDATE SET status='Promoted';
 END IF;
 INSERT INTO mass_core.enrolments(child_id,centre_id,grade_label,shift_code,starts_on,status_code) VALUES(e.child_id,target_centre,p_grade,target_shift,p_start,'Active') RETURNING id INTO result;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION mass_api.promote_student(uuid,bigint,text,date,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.promote_student(uuid,bigint,text,date,text,uuid) TO authenticated;
-- seal.sql (same transaction) adds the 'enrolments' activation guard.
NOTIFY pgrst,'reload schema';
COMMIT;
