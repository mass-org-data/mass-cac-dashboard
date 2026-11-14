-- Read-only batched monthly attendance series for the Overview line chart.
-- Replaces up to eleven all-centre reviewed_chart_metrics calls (each also computes
-- assessment, activity and Morarji sections the chart never shows) with one request.
-- The attendance calculation is identical to reviewed_chart_metrics: population = enrolments
-- active on the reporting day, optional shift/gender/grade filters, marks inside the month,
-- confirmed-holiday sessions excluded, percentage = P / (P + A + L).
-- Gated by the reviewed_reads control through supabase/activation/seal.sql, like its sibling.
-- Rollback: DROP FUNCTION mass_api.reviewed_attendance_series(uuid[],uuid,date,text,text,text);
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_api.reviewed_attendance_series(p_centres uuid[],p_year uuid,p_today date,p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog SET jit=off AS $$
DECLARE result jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='bounded readable centre scope required'; END IF;
 IF p_today IS NULL OR NOT EXISTS(SELECT 1 FROM mass_core.academic_years y WHERE y.id=p_year) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valid reporting date and academic year required'; END IF;
 IF (p_grade IS NOT NULL AND p_grade NOT IN ('1','2','3','4','5','6','7','8','9','10')) OR (p_shift IS NOT NULL AND p_shift NOT IN ('Morning','Evening')) OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy','Unknown')) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unsupported reporting filter'; END IF;
 WITH y AS MATERIALIZED(SELECT starts_on,ends_before FROM mass_core.academic_years WHERE id=p_year),
 scope AS MATERIALIZED(SELECT DISTINCT unnest(p_centres) id),
 months AS MATERIALIZED(
  SELECT m::date m_from,(m+interval '1 month')::date m_until,least((m+interval '1 month')::date-1,p_today) on_day
  FROM y CROSS JOIN LATERAL generate_series(y.starts_on,date_trunc('month',least(p_today,y.ends_before-1))::date,interval '1 month') m
  WHERE p_today>=y.starts_on),
 pop AS MATERIALIZED(
  SELECT mo.m_from,mo.m_until,e.id enrolment_id
  FROM months mo JOIN mass_core.enrolments e ON e.starts_on<=mo.on_day AND (e.ends_before IS NULL OR mo.on_day<e.ends_before)
  JOIN scope c ON c.id=e.centre_id LEFT JOIN mass_core.private_child_profiles pr ON pr.child_id=e.child_id
  WHERE (p_shift IS NULL OR e.shift_code=p_shift)
   AND (p_gender IS NULL OR pr.gender_code=p_gender OR p_gender='Unknown' AND pr.gender_code IS NULL)
   AND (p_grade IS NULL OR e.grade_label=p_grade)),
 marks AS(
  SELECT p.m_from,a.code,EXISTS(SELECT 1 FROM mass_core.cac_sessions c WHERE c.centre_id=a.centre_id AND c.shift_code=a.shift_code AND c.session_date=a.attendance_date AND NOT c.is_scheduled) holiday
  FROM pop p JOIN mass_core.attendance_records a ON a.enrolment_id=p.enrolment_id AND a.attendance_date>=p.m_from AND a.attendance_date<p.m_until),
 agg AS(
  SELECT m_from,count(*) FILTER(WHERE code='P' AND NOT holiday) p,count(*) FILTER(WHERE code='A' AND NOT holiday) a,count(*) FILTER(WHERE code='L' AND NOT holiday) l,
   count(*) FILTER(WHERE holiday OR code IN ('WO','MM')) excluded
  FROM marks GROUP BY m_from)
 SELECT coalesce(jsonb_agg(jsonb_build_object('month',to_char(mo.m_from,'YYYY-MM'),'p',coalesce(g.p,0),'a',coalesce(g.a,0),'l',coalesce(g.l,0),'excluded',coalesce(g.excluded,0),
  'percentage',100.0*coalesce(g.p,0)/nullif(coalesce(g.p,0)+coalesce(g.a,0)+coalesce(g.l,0),0)) ORDER BY mo.m_from),'[]'::jsonb)
 INTO result FROM months mo LEFT JOIN agg g ON g.m_from=mo.m_from;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION mass_api.reviewed_attendance_series(uuid[],uuid,date,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_api.reviewed_attendance_series(uuid[],uuid,date,text,text,text) TO authenticated;
COMMIT;
