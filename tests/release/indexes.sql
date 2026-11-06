SELECT core_test.assert_true(
 (SELECT count(*)=11 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='i' AND n.nspname IN ('mass_core','mass_foundation') AND c.relname IN (
   'user_scope_grants_centre_idx','user_scope_grants_verified_by_idx','centre_staff_centre_role_idx',
   'activity_events_centre_date_idx','programme_cohorts_year_idx','registration_requests_centre_idx',
   'registration_requests_child_idx','registration_requests_enrolment_idx','officer_assignments_directory_idx',
   'cluster_officer_visits_assignment_idx','audit_events_actor_user_idx')),
 'query and foreign-key support indexes installed');
