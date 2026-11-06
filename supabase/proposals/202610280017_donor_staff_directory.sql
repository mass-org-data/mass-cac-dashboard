-- PROPOSAL ONLY - MASS 017 donor and staff directory; not approved for production.
-- No funding amount or funding period is present in the source workbook.
-- No login, app-user grant, or student record is created.
BEGIN;
SET LOCAL ROLE mass_core_owner;

CREATE TABLE mass_core.donors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) > 0),
 normalized_name text GENERATED ALWAYS AS (lower(btrim(name))) STORED UNIQUE,
 row_version bigint NOT NULL DEFAULT 1
);

ALTER TABLE mass_core.centres
 ADD COLUMN donor_id uuid REFERENCES mass_core.donors(id);
-- Only assign donor_id after explicitly resolving village/centre identity,
-- including the Masaraguppi duplication in regional source labels.

CREATE TABLE mass_core.staff_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
 row_version bigint NOT NULL DEFAULT 1
);
-- Names are labels, not unique identities. Do not deduplicate staff on names alone.

CREATE TABLE mass_core.centre_staff_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id),
 staff_id uuid NOT NULL REFERENCES mass_core.staff_members(id),
 staff_role text NOT NULL CHECK (staff_role IN ('Teacher','Cluster Officer')),
 shift_code text CHECK (shift_code IN ('Morning','Evening')),
 starts_on date,
 ends_before date,
 row_version bigint NOT NULL DEFAULT 1,
 CONSTRAINT valid_assignment_window CHECK (
  ends_before IS NULL OR starts_on IS NULL OR ends_before > starts_on
 )
);
CREATE INDEX centre_staff_assignments_centre_idx ON mass_core.centre_staff_assignments(centre_id);
CREATE INDEX centre_staff_assignments_staff_idx ON mass_core.centre_staff_assignments(staff_id);

-- Directory/assignment data is not a substitute for managed Supabase Auth.
-- Keep new tables inaccessible to browser roles until dedicated audited
-- read/write APIs, centre-scoped policies and staff-verification workflow exist.
ALTER TABLE mass_core.donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.donors FORCE ROW LEVEL SECURITY;
ALTER TABLE mass_core.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.staff_members FORCE ROW LEVEL SECURITY;
ALTER TABLE mass_core.centre_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.centre_staff_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY owner_access ON mass_core.donors FOR ALL TO mass_core_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_access ON mass_core.staff_members FOR ALL TO mass_core_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_access ON mass_core.centre_staff_assignments FOR ALL TO mass_core_owner USING (true) WITH CHECK (true);

REVOKE ALL ON mass_core.donors,mass_core.staff_members,mass_core.centre_staff_assignments FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
