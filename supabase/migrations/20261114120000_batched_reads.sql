-- Batched read functions that replace per-centre request loops in the new interface (request-reduction Phase B).
-- Additive only: every existing function is unchanged and stays available as the client's fallback.
--   visit_coverage                   one call for the monthly visit summary AND per-officer rows of up to 100 centres
--   read_visits_v2                   the caller's own visit log for several centres in one bounded, paged call
--   morarji_followup                 cohort memberships + outcomes + student id/name for several centres in one paged call
--   student_profile_page_v3          student_profile_page_v2 plus the details of the (at most 100) rows on the page
--   reviewed_attendance_by_centre_month  P/A/L/excluded and children per centre and month for a year (annual donor page)
-- Scope is checked once for the whole array exactly as the single-centre functions check it; any unreadable centre rejects the call.
-- reviewed_attendance_by_centre_month is sealed behind reviewed_reads (supabase/activation/seal.sql), like reviewed_attendance_series.
-- Rollback: DROP FUNCTION mass_api.visit_coverage(uuid[],date,date,uuid), mass_api.read_visits_v2(uuid[],date,date,integer,integer),
--   mass_api.morarji_followup(uuid[],uuid,integer,integer), mass_api.student_profile_page_v3(uuid[],date,text,text,text,text,text,integer,integer,text,boolean),
--   mass_api.reviewed_attendance_by_centre_month(uuid[],uuid,date,text,text,text);  (then re-run seal.sql so capabilities stop advertising them)
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE FUNCTION mass_api.visit_coverage(p_centres uuid[],p_from date,p_until date,p_officer uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE summary jsonb; officers jsonb;
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required'; END IF;
 IF p_from IS NULL OR p_until IS NULL OR extract(day FROM p_from)<>1 OR p_until<>(p_from+interval '1 month')::date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='one calendar month required'; END IF;
 WITH sc AS MATERIALIZED(SELECT DISTINCT c id FROM unnest(p_centres)c),
 eligible AS MATERIALIZED(SELECT sc.id FROM sc WHERE p_officer IS NULL OR EXISTS(
   SELECT 1 FROM mass_core.officer_assignments a JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id
   WHERE d.centre_id=sc.id AND d.staff_member_id=p_officer AND a.starts_on<p_until AND (a.ends_before IS NULL OR a.ends_before>p_from))),
 counts AS(SELECT v.centre_id,count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Morning') m,count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Evening') e,count(*) n
   FROM mass_core.cluster_officer_visits v JOIN eligible el ON el.id=v.centre_id
   WHERE v.visit_date>=p_from AND v.visit_date<p_until AND (p_officer IS NULL OR v.officer_id=p_officer) GROUP BY v.centre_id)
 SELECT coalesce(jsonb_agg(jsonb_build_object('centre_id',el.id,'morning',coalesce(c.m,0),'evening',coalesce(c.e,0),'target_morning',2,'target_evening',2,
   'achieved',coalesce(c.m,0)>=2 AND coalesce(c.e,0)>=2,'recorded_count',coalesce(c.n,0)) ORDER BY el.id),'[]'::jsonb)
 INTO summary FROM eligible el LEFT JOIN counts c ON c.centre_id=el.id;
 WITH sc AS MATERIALIZED(SELECT DISTINCT c id FROM unnest(p_centres)c),
 counts AS(SELECT v.centre_id,v.officer_id,count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Morning') m,count(*) FILTER(WHERE v.status='Completed' AND v.shift_code='Evening') e,count(*) n
   FROM mass_core.cluster_officer_visits v JOIN sc ON sc.id=v.centre_id WHERE v.visit_date>=p_from AND v.visit_date<p_until GROUP BY v.centre_id,v.officer_id),
 officer_rows AS(SELECT d.centre_id,d.staff_member_id,s.display_name FROM mass_core.officer_assignments a
   JOIN mass_core.centre_staff_assignments d ON d.id=a.directory_assignment_id JOIN mass_core.staff_members s ON s.id=d.staff_member_id JOIN sc ON sc.id=d.centre_id
   WHERE a.starts_on<p_until AND (a.ends_before IS NULL OR a.ends_before>p_from) GROUP BY d.centre_id,d.staff_member_id,s.display_name)
 SELECT coalesce(jsonb_agg(jsonb_build_object('centre_id',o.centre_id,'officer_id',o.staff_member_id,'label',o.display_name,'morning',coalesce(c.m,0),'evening',coalesce(c.e,0),
   'target_morning',2,'target_evening',2,'recorded_count',coalesce(c.n,0)) ORDER BY o.centre_id,o.staff_member_id),'[]'::jsonb)
 INTO officers FROM officer_rows o LEFT JOIN counts c ON c.centre_id=o.centre_id AND c.officer_id=o.staff_member_id;
 RETURN jsonb_build_object('summary',summary,'officers',officers);
END;$$;

CREATE FUNCTION mass_api.read_visits_v2(p_centres uuid[],p_from date,p_until date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS SETOF mass_core.cluster_officer_visits LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_staff_session();
 IF p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_until-p_from>366 OR p_limit IS NULL OR p_offset IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bounded visit window required'; END IF;
 IF p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_record_visit(c)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='officer detail scope required'; END IF;
 RETURN QUERY SELECT v.* FROM mass_core.cluster_officer_visits v WHERE v.centre_id=ANY(p_centres) AND v.created_by=mass_core.request_user_id() AND v.visit_date>=p_from AND v.visit_date<p_until ORDER BY v.visit_date,v.id LIMIT p_limit OFFSET p_offset;
END;$$;

CREATE FUNCTION mass_api.morarji_followup(p_centres uuid[],p_cohort uuid DEFAULT NULL,p_limit integer DEFAULT 500,p_offset integer DEFAULT 0)
RETURNS TABLE(membership_id uuid,cohort_id uuid,child_id uuid,enrolment_id uuid,centre_id uuid,shift_code text,outcome_id uuid,applied boolean,attended boolean,passed boolean,school_name text,row_version bigint,student_id text,full_name text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_user<>'authenticated' OR mass_core.request_user_id() IS NULL OR p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100
  OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre read required'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid pagination'; END IF;
 RETURN QUERY SELECT m.id,m.cohort_id,m.child_id,m.enrolment_id,m.centre_id,m.shift_code,o.id,o.applied,o.attended,o.passed,o.school_name,o.row_version,c.student_id,p.full_name
 FROM mass_core.cohort_memberships m LEFT JOIN mass_core.morarji_outcomes o ON o.membership_id=m.id AND o.centre_id=m.centre_id
 LEFT JOIN mass_core.children c ON c.id=m.child_id LEFT JOIN mass_core.private_child_profiles p ON p.child_id=m.child_id
 WHERE m.centre_id=ANY(p_centres) AND (p_cohort IS NULL OR m.cohort_id=p_cohort)
 ORDER BY m.centre_id,m.cohort_id,m.child_id,m.id LIMIT p_limit OFFSET p_offset;
END;$$;

CREATE FUNCTION mass_api.student_profile_page_v3(p_centres uuid[],p_on date,p_query text DEFAULT '',p_sort text DEFAULT 'name',p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 10,p_id_query text DEFAULT '',p_reverse boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE page jsonb;
BEGIN
 -- Scope, profile permission, filters, sorting and paging are decided by v2; details are read only for the ids it returned.
 page:=mass_api.student_profile_page_v2(p_centres,p_on,p_query,p_sort,p_grade,p_shift,p_gender,p_offset,p_limit,p_id_query,p_reverse);
 RETURN page||jsonb_build_object('rows',coalesce((
  SELECT jsonb_agg(jsonb_build_object('child_id',c.id,'student_id',c.student_id,'enrolment_id',e.id,'centre_id',e.centre_id,'grade_label',e.grade_label,'shift_code',e.shift_code,'starts_on',e.starts_on,
   'status_code',e.status_code,'row_version',e.row_version,'full_name',pr.full_name,'gender_code',pr.gender_code,'class10_board_passed',pr.class10_board_passed) ORDER BY x.ord)
  FROM jsonb_array_elements_text(page->'ids') WITH ORDINALITY AS x(id,ord)
  JOIN mass_core.enrolments e ON e.id=x.id::uuid JOIN mass_core.children c ON c.id=e.child_id LEFT JOIN mass_core.private_child_profiles pr ON pr.child_id=c.id),'[]'::jsonb));
END;$$;

CREATE FUNCTION mass_api.reviewed_attendance_by_centre_month(p_centres uuid[],p_year uuid,p_today date,p_grade text DEFAULT NULL,p_shift text DEFAULT NULL,p_gender text DEFAULT NULL)
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
 -- Same population and exclusion rules as reviewed_attendance_series, kept per centre. Counts only: percentages are never averaged.
 WITH y AS MATERIALIZED(SELECT starts_on,ends_before FROM mass_core.academic_years WHERE id=p_year),
 scope AS MATERIALIZED(SELECT DISTINCT unnest(p_centres) id),
 months AS MATERIALIZED(
  SELECT m::date m_from,(m+interval '1 month')::date m_until,least((m+interval '1 month')::date-1,p_today) on_day
  FROM y CROSS JOIN LATERAL generate_series(y.starts_on,date_trunc('month',least(p_today,y.ends_before-1))::date,interval '1 month') m
  WHERE p_today>=y.starts_on),
 pop AS MATERIALIZED(
  SELECT mo.m_from,mo.m_until,e.centre_id,e.id enrolment_id
  FROM months mo JOIN mass_core.enrolments e ON e.starts_on<=mo.on_day AND (e.ends_before IS NULL OR mo.on_day<e.ends_before)
  JOIN scope c ON c.id=e.centre_id LEFT JOIN mass_core.private_child_profiles pr ON pr.child_id=e.child_id
  WHERE (p_shift IS NULL OR e.shift_code=p_shift)
   AND (p_gender IS NULL OR pr.gender_code=p_gender OR p_gender='Unknown' AND pr.gender_code IS NULL)
   AND (p_grade IS NULL OR e.grade_label=p_grade)),
 marks AS(
  SELECT p.m_from,p.centre_id,a.code,EXISTS(SELECT 1 FROM mass_core.cac_sessions c WHERE c.centre_id=a.centre_id AND c.shift_code=a.shift_code AND c.session_date=a.attendance_date AND NOT c.is_scheduled) holiday
  FROM pop p JOIN mass_core.attendance_records a ON a.enrolment_id=p.enrolment_id AND a.attendance_date>=p.m_from AND a.attendance_date<p.m_until),
 agg AS(
  SELECT m_from,centre_id,count(*) FILTER(WHERE code='P' AND NOT holiday) p,count(*) FILTER(WHERE code='A' AND NOT holiday) a,count(*) FILTER(WHERE code='L' AND NOT holiday) l,
   count(*) FILTER(WHERE holiday OR code IN ('WO','MM')) excluded
  FROM marks GROUP BY m_from,centre_id),
 kids AS(SELECT m_from,centre_id,count(*) n FROM pop GROUP BY m_from,centre_id)
 SELECT coalesce(jsonb_agg(jsonb_build_object('month',to_char(mo.m_from,'YYYY-MM'),'centre_id',s.id,'children',coalesce(k.n,0),'p',coalesce(g.p,0),'a',coalesce(g.a,0),'l',coalesce(g.l,0),'excluded',coalesce(g.excluded,0))
  ORDER BY mo.m_from,s.id),'[]'::jsonb)
 INTO result FROM months mo CROSS JOIN scope s LEFT JOIN agg g ON g.m_from=mo.m_from AND g.centre_id=s.id LEFT JOIN kids k ON k.m_from=mo.m_from AND k.centre_id=s.id;
 RETURN result;
END;$$;

REVOKE ALL ON FUNCTION mass_api.visit_coverage(uuid[],date,date,uuid),mass_api.read_visits_v2(uuid[],date,date,integer,integer),mass_api.morarji_followup(uuid[],uuid,integer,integer),
 mass_api.student_profile_page_v3(uuid[],date,text,text,text,text,text,integer,integer,text,boolean),mass_api.reviewed_attendance_by_centre_month(uuid[],uuid,date,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_api.visit_coverage(uuid[],date,date,uuid),mass_api.read_visits_v2(uuid[],date,date,integer,integer),mass_api.morarji_followup(uuid[],uuid,integer,integer),
 mass_api.student_profile_page_v3(uuid[],date,text,text,text,text,text,integer,integer,text,boolean),mass_api.reviewed_attendance_by_centre_month(uuid[],uuid,date,text,text,text) TO authenticated;
COMMIT;
