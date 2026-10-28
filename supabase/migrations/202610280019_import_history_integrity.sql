-- Preserve documented quarters without inventing assessment dates.
BEGIN;
SET LOCAL ROLE mass_core_owner;
ALTER TABLE mass_core.assessment_results ALTER COLUMN assessed_on DROP NOT NULL;
CREATE OR REPLACE FUNCTION mass_core.guard_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE allowed text[]; e mass_core.enrolments; day date; p uuid;
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN
 RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core records cannot be deleted or truncated'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.row_version<>1 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='initial revision required'; END IF;
 ELSE
  allowed:=CASE TG_TABLE_NAME
   WHEN 'enrolments' THEN ARRAY['ends_before','status_code']
   WHEN 'attendance_records' THEN ARRAY['code']
   WHEN 'assessment_results' THEN ARRAY['score']
   WHEN 'activity_participation' THEN ARRAY['participated']
   WHEN 'morarji_outcomes' THEN ARRAY['applied','attended','passed','school_name']
   WHEN 'user_scope_grants' THEN ARRAY['ends_at']
   ELSE ARRAY[]::text[] END;
  IF cardinality(allowed)=0 OR NEW.row_version<>OLD.row_version OR
   (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN
   RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='immutable identity, assignment or metadata'; END IF;
  NEW.row_version:=OLD.row_version+1;
 END IF;
 IF TG_TABLE_NAME IN ('attendance_records','cac_sessions') THEN
  IF TG_TABLE_NAME='attendance_records' THEN day:=NEW.attendance_date; ELSE day:=NEW.session_date; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.centre_id::text||NEW.shift_code||day::text,0));
 END IF;
 IF TG_TABLE_NAME IN ('attendance_records','assessment_results','activity_participation') THEN
  -- FOR SHARE invokes UPDATE policies and would require a fictitious staff JWT
  -- during an administrative import. A shared transaction advisory lock with
  -- enrolment closure preserves serialization while a plain read uses owner_read.
  PERFORM pg_advisory_xact_lock(hashtextextended('mass.enrolment.'||NEW.enrolment_id::text,0));
  SELECT * INTO e FROM mass_core.enrolments WHERE id=NEW.enrolment_id;
  -- A source-backed quarter may be known while its exact assessment date is not.
  -- NULL remains NULL; only full containment in the enrolment is accepted.
  IF TG_TABLE_NAME='assessment_results' THEN
   IF NEW.assessed_on IS NULL THEN
   IF NOT EXISTS(SELECT 1 FROM mass_core.assessment_definitions d
    JOIN mass_core.assessment_periods q ON q.id=d.period_id
    JOIN mass_core.academic_years y ON y.id=q.academic_year_id
    WHERE d.id=NEW.definition_id AND e.id IS NOT NULL
     AND e.starts_on <= (y.starts_on+(q.quarter-1)*interval '3 months')::date
     AND (e.ends_before IS NULL OR e.ends_before >= (y.starts_on+q.quarter*interval '3 months')::date)) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='assessment period outside verified enrolment'; END IF;
   RETURN NEW;
   END IF;
  END IF;
  IF TG_TABLE_NAME='attendance_records' THEN day:=NEW.attendance_date;
  ELSIF TG_TABLE_NAME='assessment_results' THEN
   day:=NEW.assessed_on;
   SELECT period_id INTO p FROM mass_core.assessment_definitions WHERE id=NEW.definition_id;
   IF NOT mass_core.period_contains(p,day) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='assessment date outside approved quarter'; END IF;
  ELSE SELECT activity_date INTO day FROM mass_core.activity_events WHERE id=NEW.event_id;
  END IF;
  IF e.id IS NULL OR day IS NULL OR day<e.starts_on OR (e.ends_before IS NOT NULL AND day>=e.ends_before) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='fact outside verified enrolment interval'; END IF;
  IF TG_TABLE_NAME='attendance_records' THEN
   IF NEW.code IN ('P','A','L') AND EXISTS
   (SELECT 1 FROM mass_core.cac_sessions s WHERE s.centre_id=NEW.centre_id AND s.shift_code=NEW.shift_code
    AND s.session_date=day AND NOT s.is_scheduled) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='attendance conflicts with confirmed holiday'; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='enrolments' AND TG_OP='UPDATE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('mass.enrolment.'||NEW.id::text,0));
  IF NEW.ends_before IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM mass_core.assessment_results r
   JOIN mass_core.assessment_definitions d ON d.id=r.definition_id
   JOIN mass_core.assessment_periods q ON q.id=d.period_id
   JOIN mass_core.academic_years y ON y.id=q.academic_year_id
   WHERE r.enrolment_id=NEW.id AND r.assessed_on IS NULL
    AND (y.starts_on+q.quarter*interval '3 months')::date>NEW.ends_before) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='closure would invalidate recorded assessment period'; END IF;
  IF EXISTS(SELECT 1 FROM mass_core.attendance_records WHERE enrolment_id=NEW.id AND attendance_date>=NEW.ends_before)
   OR EXISTS(SELECT 1 FROM mass_core.assessment_results WHERE enrolment_id=NEW.id AND assessed_on>=NEW.ends_before)
   OR EXISTS(SELECT 1 FROM mass_core.activity_participation a JOIN mass_core.activity_events v ON v.id=a.event_id
     WHERE a.enrolment_id=NEW.id AND v.activity_date>=NEW.ends_before) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='closure would invalidate recorded history'; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='cac_sessions' THEN
  IF NOT NEW.is_scheduled AND EXISTS
  (SELECT 1 FROM mass_core.attendance_records a WHERE a.centre_id=NEW.centre_id AND a.shift_code=NEW.shift_code
   AND a.attendance_date=NEW.session_date AND a.code IN ('P','A','L')) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='holiday conflicts with recorded attendance'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
COMMIT;
