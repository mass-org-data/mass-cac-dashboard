BEGIN;
SET LOCAL ROLE mass_foundation_owner;
CREATE TABLE mass_foundation.import_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT,
 source_row_id uuid NOT NULL REFERENCES mass_foundation.source_rows(id) ON DELETE RESTRICT,
 field_ordinal integer CHECK (field_ordinal > 0),
 reason_code text NOT NULL CHECK (reason_code IN
 ('missing_reference','invalid_format','conflicting_metadata','duplicate_occurrence','unverified_record')),
 review_state text NOT NULL DEFAULT 'open' CHECK (review_state IN ('open','resolved','rejected')),
 resolution_code text CHECK (resolution_code IN ('verified_correction','excluded','not_an_issue')),
 resolved_by name,
 resolved_at timestamptz,
 row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
 UNIQUE NULLS NOT DISTINCT(batch_id,source_row_id,field_ordinal,reason_code),
 CHECK ((review_state='open' AND resolution_code IS NULL AND resolved_by IS NULL AND resolved_at IS NULL)
  OR (review_state <> 'open' AND resolution_code IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX import_exceptions_source_row_idx ON mass_foundation.import_exceptions(source_row_id);
CREATE FUNCTION mass_foundation.guard_exception() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.review_state <> 'open' OR NEW.row_version <> 1 THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='exception must start open';
  END IF;
 ELSE
  IF OLD.review_state <> 'open' OR NEW.review_state='open' OR
    (NEW.id,NEW.batch_id,NEW.source_row_id,NEW.field_ordinal,NEW.reason_code,NEW.row_version)
    IS DISTINCT FROM (OLD.id,OLD.batch_id,OLD.source_row_id,OLD.field_ordinal,OLD.reason_code,OLD.row_version) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid exception transition';
  END IF;
  NEW.resolved_by := session_user;
  NEW.resolved_at := clock_timestamp();
  NEW.row_version := OLD.row_version + 1;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mass_foundation.guard_exception() FROM PUBLIC;
CREATE TRIGGER import_exceptions_guard BEFORE INSERT OR UPDATE ON mass_foundation.import_exceptions
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.guard_exception();
CREATE TRIGGER import_exceptions_no_delete BEFORE DELETE ON mass_foundation.import_exceptions
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation();
CREATE TRIGGER import_exceptions_no_truncate BEFORE TRUNCATE ON mass_foundation.import_exceptions
 FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation();
ALTER TABLE mass_foundation.import_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_foundation.import_exceptions FORCE ROW LEVEL SECURITY;
CREATE POLICY import_exceptions_read ON mass_foundation.import_exceptions FOR SELECT
 TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor USING (true);
CREATE POLICY import_exceptions_insert ON mass_foundation.import_exceptions FOR INSERT TO mass_foundation_ingestor WITH CHECK (true);
CREATE POLICY import_exceptions_review ON mass_foundation.import_exceptions FOR UPDATE TO mass_foundation_reviewer USING (true) WITH CHECK (true);
GRANT SELECT ON mass_foundation.import_exceptions TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor;
GRANT INSERT (id,batch_id,source_row_id,field_ordinal,reason_code) ON mass_foundation.import_exceptions TO mass_foundation_ingestor;
GRANT UPDATE (review_state,resolution_code) ON mass_foundation.import_exceptions TO mass_foundation_reviewer;
COMMIT;
