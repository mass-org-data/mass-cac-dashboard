-- Directory associations only: no funding, Auth linkage, dates, accounts or data.
BEGIN;
SET LOCAL ROLE mass_foundation_owner;
-- FK validation only; no source contents/table SELECT rights are delegated.
GRANT REFERENCES(id) ON mass_foundation.source_rows TO mass_core_owner;
SET LOCAL ROLE mass_core_owner;
CREATE TABLE mass_core.donors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 160),
 source_label text NOT NULL CHECK(length(btrim(source_label)) BETWEEN 1 AND 200),
 source_row_id uuid NOT NULL REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 source_slot integer NOT NULL CHECK(source_slot>0),
 UNIQUE(source_row_id,source_slot)
);
ALTER TABLE mass_core.centres
 ADD COLUMN donor_id uuid REFERENCES mass_core.donors(id) ON DELETE RESTRICT,
 ADD COLUMN donor_source_row_id uuid REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 ADD CONSTRAINT centre_donor_provenance CHECK((donor_id IS NULL)=(donor_source_row_id IS NULL));
CREATE INDEX centres_donor_lookup ON mass_core.centres(donor_id);
CREATE TABLE mass_core.staff_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 160),
 source_name text NOT NULL CHECK(length(btrim(source_name)) BETWEEN 1 AND 200),
 source_row_id uuid NOT NULL REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 source_slot integer NOT NULL CHECK(source_slot>0),
 UNIQUE(source_row_id,source_slot)
);
-- UUIDs are technical identifiers, not inferred real-world identity matches.
-- No uniqueness on names; reviewed mappings may explicitly reuse verified IDs.
CREATE TABLE mass_core.centre_staff_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 staff_member_id uuid NOT NULL REFERENCES mass_core.staff_members(id) ON DELETE RESTRICT,
 role_code text NOT NULL CHECK(role_code IN ('Teacher','Cluster Officer')),
 shift_code text CHECK(shift_code IN ('Morning','Evening')),
 source_row_id uuid NOT NULL REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 source_slot integer NOT NULL CHECK(source_slot>0),
 UNIQUE NULLS NOT DISTINCT(centre_id,staff_member_id,role_code,shift_code),
 UNIQUE NULLS NOT DISTINCT(source_row_id,source_slot,role_code,shift_code)
);
CREATE INDEX directory_staff_scope ON mass_core.centre_staff_assignments(staff_member_id,centre_id);
-- Existing centre guard forbids every UPDATE. Replace only its centre binding
-- with an invoker guard that permits a first verified donor association by owner.
-- Existing guard_record and all other trigger bindings/functions remain unchanged.
CREATE FUNCTION mass_core.guard_centre_directory() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='centre removal unsupported'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.row_version<>1 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='initial revision required'; END IF;
  RETURN NEW;
 END IF;
 IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
 IF current_user<>'mass_core_owner' OR OLD.donor_id IS NOT NULL OR NEW.donor_id IS NULL OR NEW.donor_source_row_id IS NULL
  OR (to_jsonb(NEW)-ARRAY['donor_id','donor_source_row_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['donor_id','donor_source_row_id']) THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='immutable centre or conflicting donor association'; END IF;
 NEW.row_version:=OLD.row_version+1;
 RETURN NEW;
END;
$$;
DROP TRIGGER guard_write ON mass_core.centres;
CREATE TRIGGER guard_write BEFORE INSERT OR UPDATE OR DELETE ON mass_core.centres
 FOR EACH ROW EXECUTE FUNCTION mass_core.guard_centre_directory();
-- Truncate remains protected by its original binding. No new centre UPDATE grant.
CREATE FUNCTION mass_core.guard_directory_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='directory correction requires reviewed reconciliation'; END;
$$;
DO $tables$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['donors','staff_members','centre_staff_assignments'] LOOP
  EXECUTE format('ALTER TABLE mass_core.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE mass_core.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner_access ON mass_core.%I TO mass_core_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE TRIGGER directory_immutable BEFORE UPDATE OR DELETE ON mass_core.%I FOR EACH ROW EXECUTE FUNCTION mass_core.guard_directory_immutable()',t);
  EXECUTE format('CREATE TRIGGER directory_no_truncate BEFORE TRUNCATE ON mass_core.%I FOR EACH STATEMENT EXECUTE FUNCTION mass_core.guard_directory_immutable()',t);
 END LOOP;
END;
$tables$;
CREATE POLICY scoped_read ON mass_core.donors FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM mass_core.centres c WHERE c.donor_id=donors.id AND mass_core.can_read(c.id)));
CREATE POLICY scoped_read ON mass_core.centre_staff_assignments FOR SELECT TO authenticated USING(mass_core.can_read(centre_id));
CREATE POLICY scoped_read ON mass_core.staff_members FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM mass_core.centre_staff_assignments a WHERE a.staff_member_id=staff_members.id AND mass_core.can_read(a.centre_id)));
-- Explicitly remove provider/creator default table grants; then grant only the
-- columns needed by invoker RPCs. Unknown default grantees fail closed below.
REVOKE ALL ON mass_core.donors,mass_core.staff_members,mass_core.centre_staff_assignments FROM PUBLIC,anon,authenticated,service_role;
-- Original source spellings and provenance remain owner-only columns.
GRANT SELECT(id,label) ON mass_core.donors TO authenticated;
GRANT SELECT(id,display_name) ON mass_core.staff_members TO authenticated;
GRANT SELECT(id,centre_id,staff_member_id,role_code,shift_code) ON mass_core.centre_staff_assignments TO authenticated;
-- Existing full centre SELECT would include the new opaque row reference. Replace
-- it with the original public columns plus donor_id; do not expose provenance.
REVOKE SELECT ON mass_core.centres FROM authenticated;
GRANT SELECT(id,label,row_version,donor_id) ON mass_core.centres TO authenticated;
CREATE FUNCTION mass_api.get_centre_directory(p_centre uuid DEFAULT NULL,p_donor uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
 RETURNS TABLE(centre_id uuid,centre_label text,donor_id uuid,donor_label text)
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_user<>'authenticated' OR mass_core.request_user_id() IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid pagination'; END IF;
 IF p_centre IS NOT NULL THEN PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset); END IF;
 RETURN QUERY SELECT c.id,c.label,c.donor_id,d.label FROM mass_core.centres c LEFT JOIN mass_core.donors d ON d.id=c.donor_id
 WHERE mass_core.can_read(c.id) AND (p_centre IS NULL OR c.id=p_centre) AND (p_donor IS NULL OR c.donor_id=p_donor)
 ORDER BY c.label,c.id LIMIT p_limit OFFSET p_offset;
END;
$$;
CREATE FUNCTION mass_api.get_centre_staff(p_centre uuid,p_shift text DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
 RETURNS TABLE(assignment_id uuid,staff_member_id uuid,display_name text,role_code text,shift_code text)
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM mass_core.require_read_scope(p_centre,p_limit,p_offset);
 IF p_shift IS NOT NULL AND p_shift NOT IN ('Morning','Evening') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid shift'; END IF;
 RETURN QUERY SELECT a.id,s.id,s.display_name,a.role_code,a.shift_code FROM mass_core.centre_staff_assignments a
 JOIN mass_core.staff_members s ON s.id=a.staff_member_id
 WHERE a.centre_id=p_centre AND (p_shift IS NULL OR a.shift_code=p_shift)
 ORDER BY a.role_code,s.display_name,a.id LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION mass_core.guard_centre_directory(),mass_core.guard_directory_immutable(),
 mass_api.get_centre_directory(uuid,uuid,integer,integer),mass_api.get_centre_staff(uuid,text,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION mass_core.guard_centre_directory() TO mass_core_admin;
GRANT EXECUTE ON FUNCTION mass_api.get_centre_directory(uuid,uuid,integer,integer),mass_api.get_centre_staff(uuid,text,integer,integer) TO authenticated;
DO $acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN pg_roles r
 WHERE c.oid IN ('mass_core.donors'::regclass,'mass_core.staff_members'::regclass,'mass_core.centre_staff_assignments'::regclass)
 AND r.rolname IN ('anon','service_role') AND
 (has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))) THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='unexpected inherited directory privileges; review role membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 WHERE c.oid IN ('mass_core.donors'::regclass,'mass_core.staff_members'::regclass,'mass_core.centre_staff_assignments'::regclass) AND a.grantee<>c.relowner) THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='unexpected directory table default grants'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.oid IN ('mass_api.get_centre_directory(uuid,uuid,integer,integer)'::regprocedure,'mass_api.get_centre_staff(uuid,text,integer,integer)'::regprocedure)
 AND (a.grantee NOT IN (p.proowner,'authenticated'::regrole) OR (a.grantee='authenticated'::regrole AND a.is_grantable))) THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='unexpected directory default grants'; END IF;
END;
$acl$;
NOTIFY pgrst,'reload schema';
COMMIT;
