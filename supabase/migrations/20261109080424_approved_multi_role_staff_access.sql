-- Explicit per-account operational access; ordinary Leadership remains read-only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.staff_operational_access(
 user_id uuid PRIMARY KEY,
 enabled boolean NOT NULL DEFAULT true,
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 1 AND 160),
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mass_core.staff_operational_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.staff_operational_access FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.staff_operational_access TO mass_core_owner USING(true) WITH CHECK(true);
REVOKE ALL ON mass_core.staff_operational_access FROM PUBLIC,anon,authenticated,service_role;
RESET ROLE;
ALTER TABLE mass_core.staff_operational_access ADD CONSTRAINT operational_user_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE mass_core.staff_operational_access ADD CONSTRAINT operational_approver_fkey FOREIGN KEY(approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_core.staff_operational_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT current_setting('role')='authenticated' AND EXISTS(SELECT 1 FROM mass_core.staff_operational_access a WHERE a.user_id=mass_core.request_user_id() AND a.enabled)
$$;
REVOKE ALL ON FUNCTION mass_core.staff_operational_enabled() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_core.staff_operational_enabled() TO authenticated;
CREATE OR REPLACE FUNCTION mass_core.can_write(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=mass_core.request_user_id() AND g.centre_id=c AND g.role_code IN ('Teacher','Cluster Officer') AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
 AND (mass_core.staff_operational_enabled() OR NOT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=mass_core.request_user_id() AND g.role_code='Leadership' AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at)))
$$;
DO $context$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('mass_api.get_context()'::regprocedure);
 IF position('RETURN result;' IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized scope context';END IF;
 EXECUTE replace(definition,'RETURN result;', 'RETURN result||jsonb_build_object(''operational_roles_enabled'',mass_core.staff_operational_enabled());');
END;$context$;
-- Existing source-backed staff stay immutable and retain exact provenance.
-- New Auth-backed operational staff do not pretend to be spreadsheet rows.
ALTER TABLE mass_core.staff_members ADD COLUMN auth_user_id uuid UNIQUE REFERENCES mass_core.staff_operational_access(user_id);
ALTER TABLE mass_core.staff_members ALTER COLUMN source_row_id DROP NOT NULL;
ALTER TABLE mass_core.staff_members ALTER COLUMN source_slot DROP NOT NULL;
ALTER TABLE mass_core.staff_members ADD CONSTRAINT staff_provenance_kind CHECK(
 (auth_user_id IS NULL AND source_row_id IS NOT NULL AND source_slot IS NOT NULL) OR
 (auth_user_id IS NOT NULL AND source_row_id IS NULL AND source_slot IS NULL));
ALTER TABLE mass_core.centre_staff_assignments ADD COLUMN verification_reference text;
ALTER TABLE mass_core.centre_staff_assignments ALTER COLUMN source_row_id DROP NOT NULL;
ALTER TABLE mass_core.centre_staff_assignments ALTER COLUMN source_slot DROP NOT NULL;
ALTER TABLE mass_core.centre_staff_assignments ADD CONSTRAINT staff_assignment_provenance_kind CHECK(
 (verification_reference IS NULL AND source_row_id IS NOT NULL AND source_slot IS NOT NULL) OR
 (length(btrim(verification_reference)) BETWEEN 1 AND 160 AND source_row_id IS NULL AND source_slot IS NULL AND verification_reference IS NOT NULL));
-- Preserve source-slot uniqueness for imported rows while allowing multiple
-- independently verified Auth assignments without fabricated source row IDs.
DO $source_unique$ DECLARE constraint_name name; BEGIN
 SELECT conname INTO STRICT constraint_name FROM pg_constraint WHERE conrelid='mass_core.centre_staff_assignments'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE '%(source_row_id, source_slot, role_code, shift_code)%';
 EXECUTE format('ALTER TABLE mass_core.centre_staff_assignments DROP CONSTRAINT %I',constraint_name);
END;$source_unique$;
CREATE UNIQUE INDEX directory_source_slot_unique ON mass_core.centre_staff_assignments(source_row_id,source_slot,role_code,shift_code) NULLS NOT DISTINCT WHERE source_row_id IS NOT NULL;
CREATE FUNCTION mass_core.guard_operational_directory_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='staff_members' THEN
  IF NEW.auth_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mass_core.staff_operational_access a WHERE a.user_id=NEW.auth_user_id AND a.enabled) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approved operational identity required';END IF;
 ELSE
  IF NEW.verification_reference IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mass_core.staff_members s JOIN mass_core.staff_operational_access a ON a.user_id=s.auth_user_id WHERE s.id=NEW.staff_member_id AND a.enabled) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approved Auth-backed staff required';END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION mass_core.guard_operational_directory_insert() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER operational_identity BEFORE INSERT ON mass_core.staff_members FOR EACH ROW EXECUTE FUNCTION mass_core.guard_operational_directory_insert();
CREATE TRIGGER operational_identity BEFORE INSERT ON mass_core.centre_staff_assignments FOR EACH ROW EXECUTE FUNCTION mass_core.guard_operational_directory_insert();
-- The global visit gate stays closed. Only explicitly approved accounts can use
-- new-visit entry, and all existing dated assignment checks still apply.
DO $gate$ DECLARE definition text; BEGIN
 IF to_regprocedure('mass_core.operation_enabled(text)') IS NOT NULL THEN
  definition:=pg_get_functiondef('mass_core.operation_enabled(text)'::regprocedure);
  IF position('coalesce((SELECT enabled FROM mass_activation.features WHERE feature=p_feature),false)' IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized activation control';END IF;
  EXECUTE replace(definition,'coalesce((SELECT enabled FROM mass_activation.features WHERE feature=p_feature),false)', '(coalesce((SELECT enabled FROM mass_activation.features WHERE feature=p_feature),false) OR (p_feature=''visit_entry'' AND mass_core.staff_operational_enabled()))');
 END IF;
END;$gate$;
NOTIFY pgrst,'reload schema';
COMMIT;
