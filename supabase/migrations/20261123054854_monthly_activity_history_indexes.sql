BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE INDEX monthly_activity_enrolment_fk ON mass_import.monthly_activity_history(enrolment_id,child_id,centre_id,shift_code);
CREATE INDEX monthly_activity_child ON mass_import.monthly_activity_history(child_id);
RESET ROLE;
COMMIT;
