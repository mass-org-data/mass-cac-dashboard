BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='2min';

SET LOCAL ROLE mass_core_owner;
CREATE INDEX user_scope_grants_centre_idx ON mass_core.user_scope_grants(centre_id);
CREATE INDEX user_scope_grants_verified_by_idx ON mass_core.user_scope_grants(verified_by) WHERE verified_by IS NOT NULL;
CREATE INDEX centre_staff_centre_role_idx ON mass_core.centre_staff_assignments(centre_id,role_code);
CREATE INDEX activity_events_centre_date_idx ON mass_core.activity_events(centre_id,activity_date);
CREATE INDEX programme_cohorts_year_idx ON mass_core.programme_cohorts(academic_year_id) WHERE academic_year_id IS NOT NULL;
CREATE INDEX registration_requests_centre_idx ON mass_core.registration_requests(centre_id);
CREATE INDEX registration_requests_child_idx ON mass_core.registration_requests(child_id);
CREATE INDEX registration_requests_enrolment_idx ON mass_core.registration_requests(enrolment_id);
CREATE INDEX officer_assignments_directory_idx ON mass_core.officer_assignments(directory_assignment_id);
CREATE INDEX cluster_officer_visits_assignment_idx ON mass_core.cluster_officer_visits(assignment_id);

RESET ROLE;
SET LOCAL ROLE mass_foundation_owner;
CREATE INDEX audit_events_actor_user_idx ON mass_foundation.audit_events(actor_user_id) WHERE actor_user_id IS NOT NULL;

COMMIT;
