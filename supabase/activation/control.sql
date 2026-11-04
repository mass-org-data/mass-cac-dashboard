-- REVIEW PROPOSAL. Private control plane, not a hosted migration. Run only through
-- the reviewed transactional installation envelope. No staff grants or Auth writes.
CREATE SCHEMA mass_activation AUTHORIZATION mass_core_owner;
REVOKE ALL ON SCHEMA mass_activation FROM PUBLIC,anon,authenticated,service_role;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_activation.features(
 feature text PRIMARY KEY CHECK(feature IN ('attendance_entry','attendance_corrections','assessment_entry','assessment_corrections','visit_entry','visit_corrections','transfers','profiles','enrolments','registration','calendar','activities','morarji','reviewed_reads')),
 enabled boolean NOT NULL DEFAULT false,
 approval_reference text,
 CHECK(NOT enabled OR (approval_reference IS NOT NULL AND length(btrim(approval_reference)) BETWEEN 1 AND 160)),
 -- Current preservation boundary cannot be relaxed by simply flipping a flag.
 CHECK(NOT enabled OR feature NOT IN ('attendance_corrections','assessment_corrections','visit_corrections','transfers','profiles','enrolments','calendar','activities','morarji'))
);
CREATE TABLE mass_activation.events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,feature text NOT NULL,
 previous_enabled boolean,new_enabled boolean NOT NULL,approval_reference text,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),database_principal name NOT NULL
);
ALTER TABLE mass_activation.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_activation.features FORCE ROW LEVEL SECURITY;
ALTER TABLE mass_activation.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_activation.events FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_control ON mass_activation.features TO mass_core_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_control ON mass_activation.events TO mass_core_owner USING(true) WITH CHECK(true);
CREATE FUNCTION mass_activation.log_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.feature IS DISTINCT FROM OLD.feature THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='activation identities immutable';END IF;
 INSERT INTO mass_activation.events(feature,previous_enabled,new_enabled,approval_reference,database_principal)
 VALUES(NEW.feature,OLD.enabled,NEW.enabled,NEW.approval_reference,session_user);
 RETURN NEW;
END;$$;
CREATE TRIGGER activation_change AFTER UPDATE ON mass_activation.features FOR EACH ROW EXECUTE FUNCTION mass_activation.log_change();
CREATE TRIGGER no_remove BEFORE DELETE ON mass_activation.features FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_activation.features FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER immutable_event BEFORE UPDATE OR DELETE ON mass_activation.events FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON mass_activation.events FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable();
INSERT INTO mass_activation.features(feature) SELECT unnest(ARRAY['attendance_entry','attendance_corrections','assessment_entry','assessment_corrections','visit_entry','visit_corrections','transfers','profiles','enrolments','registration','calendar','activities','morarji','reviewed_reads']);
REVOKE ALL ON ALL TABLES IN SCHEMA mass_activation FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mass_activation FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mass_core.operation_enabled(p_feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT current_setting('role')='authenticated' AND mass_core.request_user_id() IS NOT NULL
 AND coalesce((SELECT enabled FROM mass_activation.features WHERE feature=p_feature),false)
$$;
CREATE FUNCTION mass_core.require_operation_enabled(p_feature text) RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT mass_core.operation_enabled(p_feature) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='operational activation pending';END IF;
END;$$;
GRANT EXECUTE ON FUNCTION mass_core.operation_enabled(text),mass_core.require_operation_enabled(text) TO authenticated;
