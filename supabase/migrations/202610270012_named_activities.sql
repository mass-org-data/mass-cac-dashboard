BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.activity_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),
 activity_date date NOT NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(id,centre_id,shift_code)
);
CREATE TABLE mass_core.activity_participation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL,
 child_id uuid NOT NULL,
 centre_id uuid NOT NULL,
 shift_code text NOT NULL,
 enrolment_id uuid NOT NULL,
 participated boolean,
 row_version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(event_id,centre_id,shift_code) REFERENCES mass_core.activity_events(id,centre_id,shift_code) ON DELETE RESTRICT,
 FOREIGN KEY(enrolment_id,child_id,centre_id,shift_code) REFERENCES mass_core.enrolments(id,child_id,centre_id,shift_code) ON DELETE RESTRICT,
 UNIQUE(event_id,child_id)
);
CREATE INDEX activity_participation_enrolment ON mass_core.activity_participation(enrolment_id);
CREATE INDEX activity_participation_scope ON mass_core.activity_participation(centre_id);
-- No invented activity catalogue, category/engagement rule, Saturday dates or forced four-event count.

COMMIT;
