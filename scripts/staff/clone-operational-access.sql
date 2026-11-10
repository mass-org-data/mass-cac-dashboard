-- Run with psql variables source_email, target_emails (comma-separated exact
-- Auth emails), approver_email, approval_reference. Never creates Auth accounts.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE staff_targets ON COMMIT DROP AS SELECT id,email FROM auth.users WHERE lower(email)=ANY(string_to_array(lower(:'target_emails'),','));
CREATE TEMP TABLE staff_scope_template ON COMMIT DROP AS SELECT g.* FROM mass_core.user_scope_grants g JOIN auth.users u ON u.id=g.user_id WHERE lower(u.email)=lower(:'source_email') AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at);
CREATE TEMP TABLE staff_requested_count ON COMMIT DROP AS SELECT cardinality(string_to_array(:'target_emails',',')) expected;
CREATE TEMP TABLE staff_approval ON COMMIT DROP AS SELECT id,:'approval_reference'::text reference FROM auth.users WHERE lower(email)=lower(:'approver_email');
DO $preflight$ BEGIN
 IF (SELECT count(*) FROM staff_targets)<>(SELECT expected FROM staff_requested_count) OR (SELECT count(*) FROM staff_approval)<>1 OR (SELECT count(DISTINCT role_code) FROM staff_scope_template)<>3 THEN RAISE EXCEPTION 'Exact Auth identities or verified three-role template missing';END IF;
END;$preflight$;
GRANT SELECT ON staff_targets,staff_scope_template,staff_approval TO mass_core_owner;
SET LOCAL ROLE mass_core_owner;
INSERT INTO mass_core.user_scope_grants(user_id,centre_id,role_code,starts_at,verified_by,verified_at,can_read_profiles)
 SELECT t.id,s.centre_id,s.role_code,statement_timestamp(),a.id,statement_timestamp(),s.can_read_profiles FROM staff_targets t CROSS JOIN staff_scope_template s CROSS JOIN staff_approval a
 WHERE NOT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=t.id AND g.centre_id=s.centre_id AND g.role_code=s.role_code AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at));
SET LOCAL ROLE mass_core_owner;
INSERT INTO mass_core.staff_operational_access(user_id,approval_reference,approved_by)
 SELECT t.id,a.reference,a.id FROM staff_targets t CROSS JOIN staff_approval a
 ON CONFLICT(user_id) DO UPDATE SET enabled=true,approval_reference=excluded.approval_reference,approved_by=excluded.approved_by,approved_at=clock_timestamp();
INSERT INTO mass_core.staff_members(display_name,source_name,auth_user_id)
 SELECT email,email,id FROM staff_targets ON CONFLICT(auth_user_id) DO NOTHING;
INSERT INTO mass_core.centre_staff_assignments(centre_id,staff_member_id,role_code,shift_code,verification_reference)
 SELECT g.centre_id,s.id,'Cluster Officer',NULL,a.reference FROM staff_targets t JOIN mass_core.staff_members s ON s.auth_user_id=t.id JOIN mass_core.user_scope_grants g ON g.user_id=t.id CROSS JOIN staff_approval a
 WHERE g.role_code='Cluster Officer' AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)
 ON CONFLICT(centre_id,staff_member_id,role_code,shift_code) DO NOTHING;
INSERT INTO mass_core.officer_assignments(scope_grant_id,directory_assignment_id,starts_on,shift_scope,verification_reference)
 SELECT g.id,d.id,(statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date,'Both shifts',a.reference
 FROM staff_targets t JOIN mass_core.staff_members s ON s.auth_user_id=t.id
 JOIN mass_core.user_scope_grants g ON g.user_id=t.id AND g.role_code='Cluster Officer'
 JOIN mass_core.centre_staff_assignments d ON d.staff_member_id=s.id AND d.centre_id=g.centre_id AND d.role_code='Cluster Officer'
 CROSS JOIN staff_approval a WHERE g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)
 AND NOT EXISTS(SELECT 1 FROM mass_core.officer_assignments o WHERE o.scope_grant_id=g.id AND o.directory_assignment_id=d.id);
DO $verify$ BEGIN
 IF EXISTS(SELECT 1 FROM staff_targets t CROSS JOIN staff_scope_template s WHERE NOT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=t.id AND g.centre_id=s.centre_id AND g.role_code=s.role_code AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))) THEN RAISE EXCEPTION 'Scope cloning incomplete';END IF;
END;$verify$;
COMMIT;
