-- Read-only. No personal names or row-level values are returned.
SELECT (SELECT count(*) FROM mass_core.children) students,
 (SELECT count(*) FROM mass_core.private_child_profiles) profiles,
 (SELECT count(*) FROM mass_core.enrolments) enrolments,
 (SELECT count(*) FROM mass_core.attendance_records) attendance,
 (SELECT count(*) FROM mass_core.assessment_results) assessments,
 (SELECT count(*) FROM mass_core.assessment_results WHERE assessed_on IS NULL) quarter_only_assessments,
 (SELECT count(*) FROM mass_core.morarji_outcomes) morarji,
 (SELECT count(*) FROM mass_import.receipts) receipts;
SELECT target_table,count(*) FROM mass_import.receipts GROUP BY target_table ORDER BY target_table;
SELECT count(*) malformed_or_duplicate_student_ids FROM (
 SELECT student_id FROM mass_core.children
 GROUP BY student_id HAVING count(*)>1 OR student_id !~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$'
) x;
SELECT count(*) missing_receipt_targets FROM mass_import.receipts r WHERE
 (target_table='children' AND NOT EXISTS(SELECT FROM mass_core.children WHERE id=r.target_id)) OR
 (target_table='private_child_profiles' AND NOT EXISTS(SELECT FROM mass_core.private_child_profiles WHERE id=r.target_id)) OR
 (target_table='enrolments' AND NOT EXISTS(SELECT FROM mass_core.enrolments WHERE id=r.target_id)) OR
 (target_table='attendance_records' AND NOT EXISTS(SELECT FROM mass_core.attendance_records WHERE id=r.target_id)) OR
 (target_table='assessment_results' AND NOT EXISTS(SELECT FROM mass_core.assessment_results WHERE id=r.target_id));
SELECT count(*) unsafe_table_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('mass_core','mass_foundation','mass_import') AND c.relkind='r'
 AND NOT (c.relrowsecurity AND c.relforcerowsecurity);
SELECT count(*) unsafe_import_members FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
 WHERE m.roleid='mass_data_importer'::regrole AND
 (r.rolname IN ('anon','authenticated','service_role','supabase_read_only_user') OR m.inherit_option OR m.set_option);
SELECT count(*) assumed_enrolment_receipts FROM mass_import.receipts WHERE target_table='enrolments' AND assumed_enrolment_dates;
SELECT (SELECT count(*) FROM mass_core.user_scope_grants) staff_access_grants,
 (SELECT count(*) FROM mass_core.donors) donors,
 (SELECT count(*) FROM mass_core.centres) centres,
 (SELECT count(*) FROM mass_core.staff_members) staff,
 (SELECT count(*) FROM mass_core.centre_staff_assignments) staff_assignments;
