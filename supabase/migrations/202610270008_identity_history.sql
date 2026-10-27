BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.children (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 -- Nonsemantic permanent display representation; no unapproved sequential format.
 student_id text GENERATED ALWAYS AS (upper(id::text)) STORED UNIQUE,
 row_version bigint NOT NULL DEFAULT 1
);
CREATE TABLE mass_core.private_child_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 child_id uuid NOT NULL UNIQUE REFERENCES mass_core.children(id) ON DELETE RESTRICT,
 full_name text NOT NULL CHECK(length(btrim(full_name)) BETWEEN 1 AND 160),
 gender_code text CHECK(gender_code IN ('Girl','Boy')),
 class10_board_passed boolean,
 row_version bigint NOT NULL DEFAULT 1
);
CREATE TABLE mass_core.enrolments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 child_id uuid NOT NULL REFERENCES mass_core.children(id) ON DELETE RESTRICT,
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 grade_label text NOT NULL CHECK(grade_label IN ('1','2','3','4','5','6','7','8','9','10')),
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),
 starts_on date NOT NULL,
 ends_before date CHECK(ends_before>starts_on),
 status_code text NOT NULL CHECK(status_code IN ('Active','CAC dropout','Left programme')),
 CHECK(status_code='Active' OR ends_before IS NOT NULL),
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(child_id,centre_id,shift_code,starts_on),
 UNIQUE(id,child_id,centre_id,shift_code)
);
CREATE INDEX enrolments_scope ON mass_core.enrolments(centre_id,child_id,starts_on,ends_before);
CREATE INDEX enrolments_child ON mass_core.enrolments(child_id);
CREATE FUNCTION mass_core.can_read_child(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.enrolments e WHERE e.child_id=c AND mass_core.can_read(e.centre_id))
$$;
CREATE FUNCTION mass_core.can_write_child(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.enrolments e WHERE e.child_id=c AND mass_core.can_write(e.centre_id))
$$;
GRANT EXECUTE ON FUNCTION mass_core.can_read_child(uuid),mass_core.can_write_child(uuid) TO authenticated;

COMMIT;
