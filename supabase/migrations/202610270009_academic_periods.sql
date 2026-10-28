BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.academic_years (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 starts_on date NOT NULL UNIQUE CHECK(extract(month FROM starts_on)=4 AND extract(day FROM starts_on)=1),
 ends_before date GENERATED ALWAYS AS ((starts_on + interval '1 year')::date) STORED,
 row_version bigint NOT NULL DEFAULT 1
);
CREATE TABLE mass_core.assessment_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 academic_year_id uuid NOT NULL REFERENCES mass_core.academic_years(id) ON DELETE RESTRICT,
 quarter smallint NOT NULL CHECK(quarter BETWEEN 1 AND 4),
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(academic_year_id,quarter)
);
GRANT SELECT,INSERT ON mass_core.academic_years,mass_core.assessment_periods TO mass_core_admin;
CREATE FUNCTION mass_core.period_contains(p uuid,d date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.assessment_periods q JOIN mass_core.academic_years y ON y.id=q.academic_year_id
 WHERE q.id=p AND d>= (y.starts_on + (q.quarter-1)*interval '3 months')::date
 AND d<(y.starts_on+q.quarter*interval '3 months')::date)
$$;
GRANT EXECUTE ON FUNCTION mass_core.period_contains(uuid,date) TO authenticated;

COMMIT;
