BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.attendance_codes (
 code text PRIMARY KEY CHECK(code IN ('P','A','L','WO','MM')),
 meaning text NOT NULL,
 row_version bigint NOT NULL DEFAULT 1
);
INSERT INTO mass_core.attendance_codes(code,meaning) VALUES
 ('P','Present'),('A','Absent'),('L','Leave'),('WO','Sunday'),('MM','Monthly Meeting');
-- Explicit confirmed calendar entries only. Absence of a row proves nothing.
CREATE TABLE mass_core.cac_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),
 session_date date NOT NULL,
 is_scheduled boolean NOT NULL,
 confirmation_ref uuid NOT NULL,
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(centre_id,shift_code,session_date)
);
CREATE TABLE mass_core.attendance_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 child_id uuid NOT NULL,
 centre_id uuid NOT NULL,
 shift_code text NOT NULL,
 enrolment_id uuid NOT NULL,
 attendance_date date NOT NULL,
 code text NOT NULL REFERENCES mass_core.attendance_codes(code) ON DELETE RESTRICT,
 row_version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(enrolment_id,child_id,centre_id,shift_code) REFERENCES mass_core.enrolments(id,child_id,centre_id,shift_code) ON DELETE RESTRICT,
 UNIQUE(child_id,centre_id,shift_code,attendance_date)
);
CREATE INDEX attendance_enrolment ON mass_core.attendance_records(enrolment_id);
CREATE INDEX attendance_scope_date ON mass_core.attendance_records(centre_id,attendance_date);
GRANT SELECT,INSERT ON mass_core.cac_sessions TO mass_core_admin;

COMMIT;
