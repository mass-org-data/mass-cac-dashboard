BEGIN;
SET LOCAL ROLE mass_foundation_owner;
CREATE TABLE mass_foundation.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_database_principal name NOT NULL,
 actor_database_role name NOT NULL,
 entity_type text NOT NULL CHECK (entity_type IN
 ('source_files','source_sheets','import_batches','source_rows','import_exceptions')),
 entity_id uuid NOT NULL,
 operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE')),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 change_metadata jsonb NOT NULL CHECK (
 jsonb_typeof(change_metadata)='object' AND change_metadata ? 'revision' AND
 change_metadata - 'revision' = '{}'::jsonb AND
 jsonb_typeof(change_metadata->'revision')='number' AND
 (change_metadata->>'revision') ~ '^[1-9][0-9]*$'),
 batch_id uuid REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT
);
CREATE INDEX audit_events_batch_idx ON mass_foundation.audit_events(batch_id);
CREATE INDEX audit_events_entity_idx ON mass_foundation.audit_events(entity_type,entity_id,changed_at);
ALTER TABLE mass_foundation.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_foundation.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_read ON mass_foundation.audit_events FOR SELECT TO mass_foundation_auditor USING (true);
CREATE POLICY audit_events_append ON mass_foundation.audit_events FOR INSERT TO mass_foundation_owner WITH CHECK (true);
GRANT SELECT ON mass_foundation.audit_events TO mass_foundation_auditor;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON mass_foundation.audit_events
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON mass_foundation.audit_events
 FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation();
CREATE FUNCTION mass_foundation.record_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE batch uuid; revision bigint := 1; dbrole name;
BEGIN
 IF TG_TABLE_SCHEMA <> 'mass_foundation' OR TG_TABLE_NAME NOT IN
  ('source_files','source_sheets','import_batches','source_rows','import_exceptions') OR TG_OP NOT IN ('INSERT','UPDATE') THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='unsupported audit target';
 END IF;
 IF TG_TABLE_NAME='import_batches' THEN batch:=NEW.id; revision:=NEW.row_version;
 ELSIF TG_TABLE_NAME='source_rows' THEN batch:=NEW.first_batch_id;
 ELSIF TG_TABLE_NAME='import_exceptions' THEN batch:=NEW.batch_id; revision:=NEW.row_version;
 END IF;
 dbrole:=current_setting('role');
 IF dbrole='none' THEN dbrole:=session_user; END IF;
 INSERT INTO mass_foundation.audit_events
  (actor_database_principal,actor_database_role,entity_type,entity_id,operation,change_metadata,batch_id)
 VALUES (session_user,dbrole,TG_TABLE_NAME,NEW.id,TG_OP,jsonb_build_object('revision',revision),batch);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mass_foundation.record_audit() FROM PUBLIC;
CREATE TRIGGER source_files_audit AFTER INSERT ON mass_foundation.source_files
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit();
CREATE TRIGGER source_sheets_audit AFTER INSERT ON mass_foundation.source_sheets
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit();
CREATE TRIGGER import_batches_audit AFTER INSERT OR UPDATE ON mass_foundation.import_batches
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit();
CREATE TRIGGER source_rows_audit AFTER INSERT ON mass_foundation.source_rows
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit();
CREATE TRIGGER import_exceptions_audit AFTER INSERT OR UPDATE ON mass_foundation.import_exceptions
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.record_audit();
-- No application roles receive schema/table/function access. In particular, Supabase
-- service_role BYPASSRLS does not itself confer schema usage or table privileges.
COMMIT;
