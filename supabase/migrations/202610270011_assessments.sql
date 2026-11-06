BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.assessment_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 period_id uuid NOT NULL REFERENCES mass_core.assessment_periods(id) ON DELETE RESTRICT,
 max_score numeric NOT NULL DEFAULT 25 CHECK(max_score=25),
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(period_id)
);
CREATE TABLE mass_core.assessment_results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 child_id uuid NOT NULL,
 centre_id uuid NOT NULL,
 shift_code text NOT NULL,
 enrolment_id uuid NOT NULL,
 definition_id uuid NOT NULL REFERENCES mass_core.assessment_definitions(id) ON DELETE RESTRICT,
 assessed_on date NOT NULL,
 score numeric NOT NULL CHECK(score BETWEEN 0 AND 25),
 row_version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(enrolment_id,child_id,centre_id,shift_code) REFERENCES mass_core.enrolments(id,child_id,centre_id,shift_code) ON DELETE RESTRICT,
 UNIQUE(child_id,definition_id)
);
CREATE INDEX assessment_result_enrolment ON mass_core.assessment_results(enrolment_id);
CREATE INDEX assessment_result_definition ON mass_core.assessment_results(definition_id);
CREATE INDEX assessment_result_scope ON mass_core.assessment_results(centre_id);
GRANT SELECT,INSERT ON mass_core.assessment_definitions TO mass_core_admin;
-- Numeric preserves possible decimal source observations; UI precision policy remains pending.
-- Only actual recorded scores are canonical here: missing is no row, never zero/Absent.

COMMIT;
