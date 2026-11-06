BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.programme_cohorts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 120),
 academic_year_id uuid REFERENCES mass_core.academic_years(id) ON DELETE RESTRICT,
 row_version bigint NOT NULL DEFAULT 1
);
CREATE TABLE mass_core.cohort_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cohort_id uuid NOT NULL REFERENCES mass_core.programme_cohorts(id) ON DELETE RESTRICT,
 child_id uuid NOT NULL,
 centre_id uuid NOT NULL,
 shift_code text NOT NULL,
 enrolment_id uuid NOT NULL,
 row_version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(enrolment_id,child_id,centre_id,shift_code) REFERENCES mass_core.enrolments(id,child_id,centre_id,shift_code) ON DELETE RESTRICT,
 UNIQUE(cohort_id,child_id),UNIQUE(id,centre_id)
);
CREATE TABLE mass_core.morarji_outcomes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 membership_id uuid NOT NULL UNIQUE,
 centre_id uuid NOT NULL,
 applied boolean,
 attended boolean,
 passed boolean,
 school_name text CHECK(length(school_name)<=160),
 row_version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(membership_id,centre_id) REFERENCES mass_core.cohort_memberships(id,centre_id) ON DELETE RESTRICT
);
CREATE INDEX cohort_membership_enrolment ON mass_core.cohort_memberships(enrolment_id);
CREATE INDEX morarji_scope ON mass_core.morarji_outcomes(centre_id);
GRANT SELECT,INSERT ON mass_core.programme_cohorts TO mass_core_admin;
-- No source cohort-year invention, additional outcomes or flag implication constraints.

COMMIT;
