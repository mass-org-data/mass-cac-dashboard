BEGIN;
SET LOCAL ROLE mass_core_owner;
ALTER TABLE mass_core.user_scope_grants ADD COLUMN can_read_profiles boolean NOT NULL DEFAULT false;
GRANT UPDATE(ends_at) ON mass_core.user_scope_grants TO mass_core_admin;
CREATE FUNCTION mass_core.can_read_profile(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.enrolments e JOIN mass_core.user_scope_grants g ON g.centre_id=e.centre_id
 WHERE e.child_id=c AND g.user_id=auth.uid() AND g.can_read_profiles
 AND g.role_code IN ('Teacher','Cluster Officer') AND g.starts_at<=statement_timestamp()
 AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
 AND NOT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=auth.uid() AND g.role_code='Leadership'
 AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
$$;
GRANT EXECUTE ON FUNCTION mass_core.can_read_profile(uuid) TO authenticated;
-- Logical edit conflicts use PT409, not a retryable PostgreSQL serialization error.
CREATE FUNCTION mass_core.expected_version(actual bigint,expected bigint) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF expected IS NULL OR expected<0 OR coalesce(actual,0)<>expected THEN
 RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='revision conflict'; END IF;
END;
$$;
CREATE FUNCTION mass_core.writable_enrolment(e uuid) RETURNS mass_core.enrolments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result mass_core.enrolments;
BEGIN
 SELECT * INTO result FROM mass_core.enrolments WHERE id=e FOR SHARE;
 IF result.id IS NULL OR NOT mass_core.can_write(result.centre_id) THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='assigned centre write required'; END IF;
 RETURN result;
END;
$$;
CREATE FUNCTION mass_core.guard_record() RETURNS trigger
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
  SELECT * INTO e FROM mass_core.enrolments WHERE id=NEW.enrolment_id FOR SHARE;
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
  IF NEW.ends_before IS NOT NULL THEN
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
ALTER TABLE mass_core.centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.centres FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.centres TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.centres
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.centres
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.centres FOR SELECT TO authenticated USING(mass_core.can_read(id));
GRANT SELECT ON mass_core.centres TO authenticated;
CREATE POLICY admin_access ON mass_core.centres TO mass_core_admin USING(true) WITH CHECK(true);
ALTER TABLE mass_core.user_scope_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.user_scope_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.user_scope_grants TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.user_scope_grants
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.user_scope_grants
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY admin_access ON mass_core.user_scope_grants TO mass_core_admin USING(true) WITH CHECK(true);
ALTER TABLE mass_core.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.children FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.children TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.children
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.children
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.children FOR SELECT TO authenticated USING(mass_core.can_read_child(id));
GRANT SELECT ON mass_core.children TO authenticated;
ALTER TABLE mass_core.private_child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.private_child_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.private_child_profiles TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.private_child_profiles
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.private_child_profiles
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.private_child_profiles FOR SELECT TO authenticated USING(mass_core.can_read_profile(child_id));
GRANT SELECT ON mass_core.private_child_profiles TO authenticated;
ALTER TABLE mass_core.enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.enrolments FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.enrolments FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.enrolments FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.enrolments FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.enrolments
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.enrolments
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.enrolments FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.enrolments TO authenticated;
ALTER TABLE mass_core.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.academic_years FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.academic_years TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.academic_years
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.academic_years
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.academic_years FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
GRANT SELECT ON mass_core.academic_years TO authenticated;
CREATE POLICY admin_access ON mass_core.academic_years TO mass_core_admin USING(true) WITH CHECK(true);
ALTER TABLE mass_core.assessment_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.assessment_periods FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.assessment_periods TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.assessment_periods
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.assessment_periods
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.assessment_periods FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
GRANT SELECT ON mass_core.assessment_periods TO authenticated;
CREATE POLICY admin_access ON mass_core.assessment_periods TO mass_core_admin USING(true) WITH CHECK(true);
ALTER TABLE mass_core.attendance_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.attendance_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.attendance_codes TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.attendance_codes
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.attendance_codes
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.attendance_codes FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
GRANT SELECT ON mass_core.attendance_codes TO authenticated;
ALTER TABLE mass_core.cac_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.cac_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.cac_sessions FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.cac_sessions FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.cac_sessions FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.cac_sessions
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.cac_sessions
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.cac_sessions FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.cac_sessions TO authenticated;
CREATE POLICY admin_access ON mass_core.cac_sessions TO mass_core_admin USING(true) WITH CHECK(true);
ALTER TABLE mass_core.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.attendance_records FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.attendance_records FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.attendance_records FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.attendance_records FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.attendance_records
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.attendance_records
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.attendance_records FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.attendance_records TO authenticated;
ALTER TABLE mass_core.assessment_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.assessment_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.assessment_definitions TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.assessment_definitions
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.assessment_definitions
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.assessment_definitions FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
GRANT SELECT ON mass_core.assessment_definitions TO authenticated;
CREATE POLICY admin_access ON mass_core.assessment_definitions TO mass_core_admin USING(true) WITH CHECK(true);
ALTER TABLE mass_core.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.assessment_results FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.assessment_results FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.assessment_results FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.assessment_results FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.assessment_results
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.assessment_results
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.assessment_results FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.assessment_results TO authenticated;
ALTER TABLE mass_core.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.activity_events FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.activity_events FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.activity_events FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.activity_events FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.activity_events
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.activity_events
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.activity_events FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.activity_events TO authenticated;
ALTER TABLE mass_core.activity_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.activity_participation FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.activity_participation FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.activity_participation FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.activity_participation FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.activity_participation
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.activity_participation
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.activity_participation FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.activity_participation TO authenticated;
ALTER TABLE mass_core.programme_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.programme_cohorts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.programme_cohorts TO mass_core_owner USING(true) WITH CHECK(true);
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.programme_cohorts
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.programme_cohorts
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.programme_cohorts FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
GRANT SELECT ON mass_core.programme_cohorts TO authenticated;
CREATE POLICY admin_access ON mass_core.programme_cohorts TO mass_core_admin USING(true) WITH CHECK(true);
ALTER TABLE mass_core.cohort_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.cohort_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.cohort_memberships FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.cohort_memberships FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.cohort_memberships FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.cohort_memberships
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.cohort_memberships
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.cohort_memberships FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.cohort_memberships TO authenticated;
ALTER TABLE mass_core.morarji_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.morarji_outcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON mass_core.morarji_outcomes FOR SELECT TO mass_core_owner USING(true);
CREATE POLICY owner_insert ON mass_core.morarji_outcomes FOR INSERT TO mass_core_owner WITH CHECK(mass_core.can_write(centre_id));
CREATE POLICY owner_update ON mass_core.morarji_outcomes FOR UPDATE TO mass_core_owner USING(mass_core.can_write(centre_id)) WITH CHECK(mass_core.can_write(centre_id));
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.morarji_outcomes
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_record();
CREATE TRIGGER guard_truncate BEFORE TRUNCATE ON mass_core.morarji_outcomes
 FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_record();
CREATE POLICY scoped_read ON mass_core.morarji_outcomes FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
GRANT SELECT ON mass_core.morarji_outcomes TO authenticated;
RESET ROLE;
GRANT USAGE ON SCHEMA auth TO mass_foundation_owner;
GRANT REFERENCES(id) ON auth.users TO mass_foundation_owner;
SET LOCAL ROLE mass_foundation_owner;
ALTER TABLE mass_foundation.audit_events ADD COLUMN actor_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE mass_foundation.audit_events DROP CONSTRAINT audit_events_entity_type_check;
ALTER TABLE mass_foundation.audit_events ADD CONSTRAINT audit_events_entity_type_check CHECK(entity_type IN ('source_files','source_sheets','import_batches','source_rows','import_exceptions','core.centres','core.user_scope_grants','core.children','core.private_child_profiles','core.enrolments','core.academic_years','core.assessment_periods','core.cac_sessions','core.attendance_records','core.assessment_definitions','core.assessment_results','core.activity_events','core.activity_participation','core.programme_cohorts','core.cohort_memberships','core.morarji_outcomes'));
GRANT USAGE ON SCHEMA mass_foundation TO mass_core_owner;
GRANT INSERT(actor_database_principal,actor_database_role,actor_user_id,entity_type,entity_id,operation,change_metadata)
 ON mass_foundation.audit_events TO mass_core_owner;
CREATE POLICY core_audit_append ON mass_foundation.audit_events FOR INSERT TO mass_core_owner WITH CHECK(true);
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_core.record_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE dbrole name;
BEGIN
 IF TG_TABLE_SCHEMA<>'mass_core' OR TG_TABLE_NAME NOT IN ('centres','user_scope_grants','children','private_child_profiles','enrolments','academic_years','assessment_periods','cac_sessions','attendance_records','assessment_definitions','assessment_results','activity_events','activity_participation','programme_cohorts','cohort_memberships','morarji_outcomes') THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='unsupported core audit target'; END IF;
 dbrole:=current_setting('role'); IF dbrole='none' THEN dbrole:=session_user; END IF;
 INSERT INTO mass_foundation.audit_events(actor_database_principal,actor_database_role,actor_user_id,entity_type,entity_id,operation,change_metadata)
 VALUES(session_user,dbrole,auth.uid(),'core.'||TG_TABLE_NAME,NEW.id,TG_OP,jsonb_build_object('revision',NEW.row_version));
 RETURN NEW;
END;
$$;
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.centres FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.user_scope_grants FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.children FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.private_child_profiles FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.enrolments FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.academic_years FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.assessment_periods FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.cac_sessions FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.attendance_records FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.assessment_definitions FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.assessment_results FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.activity_events FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.activity_participation FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.programme_cohorts FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.cohort_memberships FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();
CREATE TRIGGER audit_write AFTER INSERT OR UPDATE ON mass_core.morarji_outcomes FOR EACH ROW EXECUTE FUNCTION mass_core.record_audit();

COMMIT;
