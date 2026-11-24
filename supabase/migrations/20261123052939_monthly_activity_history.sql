-- Monthly source evidence is separate from dated events. No invented Saturdays.
BEGIN;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_import.monthly_activity_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_row_id uuid NOT NULL UNIQUE REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 payload_hmac text NOT NULL CHECK(payload_hmac ~ '^[0-9a-f]{64}$'),
 reporting_month date NOT NULL CHECK(extract(day FROM reporting_month)=1),
 child_id uuid NOT NULL,
 enrolment_id uuid NOT NULL,
 centre_id uuid NOT NULL,
 shift_code text NOT NULL CHECK(shift_code IN ('Morning','Evening')),
 grade_label text NOT NULL CHECK(grade_label ~ '^(10|[1-9])$'),
 cultural_1 boolean, cultural_2 boolean, sports_1 boolean, sports_2 boolean,
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 imported_by name NOT NULL DEFAULT session_user,
 UNIQUE(reporting_month,child_id),
 FOREIGN KEY(enrolment_id,child_id,centre_id,shift_code)
  REFERENCES mass_core.enrolments(id,child_id,centre_id,shift_code) ON DELETE RESTRICT
);
ALTER TABLE mass_import.monthly_activity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_import.monthly_activity_history FORCE ROW LEVEL SECURITY;
CREATE POLICY monthly_history_owner_read ON mass_import.monthly_activity_history FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY monthly_history_import_read ON mass_import.monthly_activity_history FOR SELECT TO mass_data_importer USING(true);
CREATE POLICY monthly_history_import_append ON mass_import.monthly_activity_history FOR INSERT TO mass_data_importer WITH CHECK(true);
REVOKE ALL ON mass_import.monthly_activity_history FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON mass_import.monthly_activity_history TO mass_data_importer;
CREATE FUNCTION mass_import.guard_monthly_activity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE allowed boolean:=false;
BEGIN
 IF TG_OP='DELETE' AND to_regprocedure('mass_core.reviewed_deletion_allowed(text,jsonb)') IS NOT NULL THEN
  EXECUTE 'SELECT mass_core.reviewed_deletion_allowed($1,$2)' INTO allowed USING 'monthly_activity_history',to_jsonb(OLD);
  IF allowed THEN RETURN OLD;END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Historical monthly activity evidence is immutable';END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_core.enrolments e WHERE e.id=NEW.enrolment_id AND e.child_id=NEW.child_id
  AND e.centre_id=NEW.centre_id AND e.shift_code=NEW.shift_code AND e.grade_label=NEW.grade_label
  AND e.starts_on<=NEW.reporting_month AND (e.ends_before IS NULL OR e.ends_before>=(NEW.reporting_month+interval '1 month')::date)) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Monthly activity evidence requires a verified full-month enrolment';END IF;
 IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_rows r JOIN mass_foundation.source_sheets s ON s.id=r.sheet_id
  JOIN mass_foundation.source_files f ON f.id=s.file_id WHERE r.id=NEW.source_row_id AND f.sha256=NEW.source_sha256) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Monthly activity source fingerprint mismatch';END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION mass_import.guard_monthly_activity_history() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_import.guard_monthly_activity_history() TO mass_data_importer;
CREATE TRIGGER monthly_activity_validate BEFORE INSERT ON mass_import.monthly_activity_history FOR EACH ROW EXECUTE FUNCTION mass_import.guard_monthly_activity_history();
CREATE TRIGGER monthly_activity_immutable BEFORE UPDATE OR DELETE ON mass_import.monthly_activity_history FOR EACH ROW EXECUTE FUNCTION mass_import.guard_monthly_activity_history();
CREATE TRIGGER monthly_activity_no_truncate BEFORE TRUNCATE ON mass_import.monthly_activity_history FOR EACH STATEMENT EXECUTE FUNCTION mass_import.guard_monthly_activity_history();
CREATE INDEX monthly_activity_scope ON mass_import.monthly_activity_history(centre_id,reporting_month,shift_code);
-- Aggregate-only read. Raw history and source references are never exposed to app roles.
CREATE FUNCTION mass_api.monthly_activity_history_summary(p_centres uuid[],p_month date,p_shift text DEFAULT NULL,p_grade text DEFAULT NULL,p_gender text DEFAULT NULL)
RETURNS TABLE(centre_id uuid,shift_code text,reporting_month date,recorded_students bigint,students_at_least_two bigint,cultural_responses bigint,sports_responses bigint,missing_responses bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF mass_core.request_user_id() IS NULL OR p_centres IS NULL OR cardinality(p_centres) NOT BETWEEN 1 AND 100
  OR EXISTS(SELECT 1 FROM unnest(p_centres)c WHERE c IS NULL OR NOT mass_core.can_read(c)) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Verified centre read scope required';END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR (p_shift IS NOT NULL AND p_shift NOT IN ('Morning','Evening'))
  OR (p_grade IS NOT NULL AND p_grade !~ '^(10|[1-9])$') OR (p_gender IS NOT NULL AND p_gender NOT IN ('Girl','Boy','Unknown')) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid monthly history filter';END IF;
 RETURN QUERY SELECT h.centre_id,h.shift_code,h.reporting_month,count(*),
 count(*) FILTER(WHERE coalesce(h.cultural_1::int,0)+coalesce(h.cultural_2::int,0)+coalesce(h.sports_1::int,0)+coalesce(h.sports_2::int,0)>=2),
 sum(coalesce(h.cultural_1::int,0)+coalesce(h.cultural_2::int,0)),sum(coalesce(h.sports_1::int,0)+coalesce(h.sports_2::int,0)),
 sum((h.cultural_1 IS NULL)::int+(h.cultural_2 IS NULL)::int+(h.sports_1 IS NULL)::int+(h.sports_2 IS NULL)::int)
 FROM mass_import.monthly_activity_history h JOIN mass_core.private_child_profiles p ON p.child_id=h.child_id
 WHERE h.centre_id=ANY(p_centres) AND h.reporting_month=p_month AND (p_shift IS NULL OR h.shift_code=p_shift)
 AND (p_grade IS NULL OR h.grade_label=p_grade) AND (p_gender IS NULL OR coalesce(p.gender_code,'Unknown')=p_gender)
 GROUP BY h.centre_id,h.shift_code,h.reporting_month;
END;$$;
REVOKE ALL ON FUNCTION mass_api.monthly_activity_history_summary(uuid[],date,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_api.monthly_activity_history_summary(uuid[],date,text,text,text) TO authenticated;
-- Integrate the reviewed Leadership deletion flow where it is installed.
-- Production's older API has no such workflow; no new delete capability is added there.
CREATE FUNCTION mass_import.integrate_monthly_activity_deletion() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $dependencies$
DECLARE original text;updated text;
BEGIN
 IF to_regprocedure('mass_core.reviewed_deletion_allowed(text,jsonb)') IS NULL THEN RETURN;END IF;
 original:=pg_get_functiondef('mass_core.reviewed_deletion_allowed(text,jsonb)'::regprocedure);
 IF position('monthly_activity_history' IN original)=0 THEN
 updated:=replace(original,$old$'activity_participation','cohort_memberships'$old$,$new$'activity_participation','monthly_activity_history','cohort_memberships'$new$);
 IF updated=original THEN RAISE EXCEPTION 'Monthly history deletion guard patch did not match';END IF;EXECUTE updated;END IF;
 original:=pg_get_functiondef('mass_core.assert_student_deletion_dependencies()'::regprocedure);
 IF position('mass_import.monthly_activity_history' IN original)=0 THEN
 updated:=replace(original,$old$'mass_core.registration_requests'::regclass$old$,$new$'mass_core.registration_requests'::regclass,'mass_import.monthly_activity_history'::regclass$new$);
 IF updated=original THEN RAISE EXCEPTION 'Monthly history dependency patch did not match';END IF;EXECUTE updated;END IF;
 original:=pg_get_functiondef('mass_core.student_deletion_snapshot(uuid)'::regprocedure);
 IF position('monthly-history:' IN original)=0 THEN
 updated:=replace(original,$old$  'activity_participation',(SELECT$old$,$new$  'monthly_activity_history',(SELECT count(*) FROM mass_import.monthly_activity_history WHERE child_id=p_child),
  'activity_participation',(SELECT$new$);
 updated:=replace(updated,$old$  UNION ALL SELECT 'participation:'$old$,$new$  UNION ALL SELECT 'monthly-history:'||id||':'||payload_hmac FROM mass_import.monthly_activity_history WHERE child_id=p_child
  UNION ALL SELECT 'participation:'$new$);
 IF updated=original OR position('monthly-history:' IN updated)=0 THEN RAISE EXCEPTION 'Monthly history deletion snapshot patch did not match';END IF;EXECUTE updated;END IF;
 original:=pg_get_functiondef('mass_api.delete_student_cascade(uuid,uuid,text,text)'::regprocedure);
 IF position('mass_import.monthly_activity_history' IN original)=0 THEN
 updated:=replace(original,$old$ DELETE FROM mass_core.registration_requests WHERE child_id=p_child;$old$,$new$ DELETE FROM mass_import.monthly_activity_history WHERE child_id=p_child;
 DELETE FROM mass_core.registration_requests WHERE child_id=p_child;$new$);
 IF updated=original THEN RAISE EXCEPTION 'Monthly history student cascade patch did not match';END IF;EXECUTE updated;END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='mass_import.monthly_activity_history'::regclass AND polname='monthly_history_reviewed_delete') THEN
 EXECUTE $policy$CREATE POLICY monthly_history_reviewed_delete ON mass_import.monthly_activity_history FOR DELETE TO mass_core_owner USING(mass_core.reviewed_deletion_allowed('monthly_activity_history',to_jsonb(monthly_activity_history)))$policy$;END IF;
END;$dependencies$;
REVOKE ALL ON FUNCTION mass_import.integrate_monthly_activity_deletion() FROM PUBLIC,anon,authenticated,service_role,mass_data_importer;
SELECT mass_import.integrate_monthly_activity_deletion();
RESET ROLE;
COMMIT;
