BEGIN;
SET LOCAL ROLE mass_core_owner;

CREATE FUNCTION mass_api.historical_visit_summary(
  p_centres uuid[],
  p_month date,
  p_shift text DEFAULT NULL,
  p_officer uuid DEFAULT NULL
)
RETURNS TABLE(centre_id uuid, shift_code text, recorded_visits bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  IF mass_core.request_user_id() IS NULL
    OR p_centres IS NULL
    OR cardinality(p_centres) NOT BETWEEN 1 AND 100
    OR EXISTS (
      SELECT 1 FROM unnest(p_centres) AS requested(centre)
      WHERE requested.centre IS NULL OR mass_core.can_read(requested.centre) IS DISTINCT FROM TRUE
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Verified centre read scope required';
  END IF;

  IF p_month IS NULL OR NOT isfinite(p_month) OR extract(day FROM p_month) <> 1
    OR (p_shift IS NOT NULL AND p_shift NOT IN ('Morning', 'Evening'))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid historical visit filter';
  END IF;

  RETURN QUERY
  SELECT v.centre_id, v.shift_code, count(*)
  FROM mass_import.historical_officer_visits AS v
  WHERE v.centre_id = ANY(p_centres)
    AND v.reporting_month = p_month
    AND (p_shift IS NULL OR v.shift_code = p_shift)
    AND (p_officer IS NULL OR v.officer_id = p_officer)
  GROUP BY v.centre_id, v.shift_code
  ORDER BY v.centre_id, v.shift_code;
END;
$$;

COMMENT ON FUNCTION mass_api.historical_visit_summary(uuid[], date, text, uuid)
  IS 'Centre-scoped counts of dated source entries by reporting month and shift. Operational completion is measured separately.';
REVOKE ALL ON FUNCTION mass_api.historical_visit_summary(uuid[], date, text, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION mass_api.historical_visit_summary(uuid[], date, text, uuid) TO authenticated;

RESET ROLE;
COMMIT;
