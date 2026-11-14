-- Students per shift for the Overview "Students by shift" chart (request-reduction Phase C1).
-- The chart needs two integers (distinct children enrolled on the reporting day in the Morning shift and in the Evening shift).
-- It used to run two full reviewed_chart_metrics reports (population, attendance, assessments, Morarji, activities...) for them.
-- Same population rule as reviewed_chart_metrics with no grade or gender filter: enrolments active on p_on in the readable centres,
-- counting each child once per shift. Counts only; no names or profile fields. Sealed behind reviewed_reads (supabase/activation/seal.sql).
-- Rollback: DROP FUNCTION mass_api.reviewed_shift_counts(uuid[],date); then re-run seal.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_api.reviewed_shift_counts(p_centres uuid[],p_on date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog SET jit=off AS $$
DECLARE result jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='bounded readable centre scope required'; END IF;
 IF p_on IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='reporting day required'; END IF;
 SELECT jsonb_build_object('Morning',count(DISTINCT e.child_id) FILTER(WHERE e.shift_code='Morning'),'Evening',count(DISTINCT e.child_id) FILTER(WHERE e.shift_code='Evening'))
 INTO result FROM mass_core.enrolments e WHERE e.centre_id=ANY(p_centres) AND e.starts_on<=p_on AND (e.ends_before IS NULL OR p_on<e.ends_before);
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION mass_api.reviewed_shift_counts(uuid[],date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_api.reviewed_shift_counts(uuid[],date) TO authenticated;
COMMIT;
