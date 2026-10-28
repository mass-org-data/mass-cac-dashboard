BEGIN;
SET LOCAL ROLE mass_foundation_owner;
CREATE TABLE mass_foundation.import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mapping_version text NOT NULL CHECK (mapping_version ~ '^[A-Za-z0-9_.-]{1,64}$'),
 extractor_version text NOT NULL CHECK (extractor_version ~ '^[A-Za-z0-9_.-]{1,64}$'),
 state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged','validated','approved','running','complete','failed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 started_at timestamptz,
 completed_at timestamptz,
 checkpoint_position bigint CHECK (checkpoint_position >= 0),
 extracted_count bigint NOT NULL DEFAULT 0 CHECK (extracted_count >= 0),
 accepted_count bigint NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
 quarantined_count bigint NOT NULL DEFAULT 0 CHECK (quarantined_count >= 0),
 excluded_count bigint NOT NULL DEFAULT 0 CHECK (excluded_count >= 0),
 row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
 CHECK (accepted_count + quarantined_count + excluded_count <= extracted_count),
 CHECK (state <> 'complete' OR accepted_count + quarantined_count + excluded_count = extracted_count)
);
CREATE FUNCTION mass_foundation.guard_batch() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.state <> 'staged' OR NEW.started_at IS NOT NULL OR NEW.completed_at IS NOT NULL OR NEW.row_version <> 1 THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='batch must start staged';
  END IF;
 ELSE
  IF OLD.state IN ('complete','failed') OR
   (NEW.state <> OLD.state AND NOT
    ((OLD.state='staged' AND NEW.state IN ('validated','failed')) OR
     (OLD.state='validated' AND NEW.state IN ('approved','failed')) OR
     (OLD.state='approved' AND NEW.state IN ('running','failed')) OR
     (OLD.state='running' AND NEW.state IN ('complete','failed')))) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid batch transition';
  END IF;
  IF NEW.id <> OLD.id OR NEW.mapping_version <> OLD.mapping_version OR NEW.extractor_version <> OLD.extractor_version OR
   NEW.created_at <> OLD.created_at OR NEW.row_version <> OLD.row_version OR
   NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='server-managed batch metadata';
  END IF;
  IF NEW.checkpoint_position < OLD.checkpoint_position OR (OLD.checkpoint_position IS NOT NULL AND NEW.checkpoint_position IS NULL) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='checkpoint cannot go backwards';
  END IF;
  NEW.row_version := OLD.row_version + 1;
 END IF;
 IF NEW.state='running' AND NEW.started_at IS NULL THEN NEW.started_at := clock_timestamp(); END IF;
 IF NEW.state IN ('complete','failed') THEN NEW.completed_at := clock_timestamp(); END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mass_foundation.guard_batch() FROM PUBLIC;
CREATE TRIGGER import_batches_guard BEFORE INSERT OR UPDATE ON mass_foundation.import_batches
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.guard_batch();
CREATE TRIGGER import_batches_no_delete BEFORE DELETE ON mass_foundation.import_batches
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation();
CREATE TRIGGER import_batches_no_truncate BEFORE TRUNCATE ON mass_foundation.import_batches
 FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation();
ALTER TABLE mass_foundation.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_foundation.import_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY import_batches_read ON mass_foundation.import_batches FOR SELECT
 TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor USING (true);
CREATE POLICY import_batches_insert ON mass_foundation.import_batches FOR INSERT TO mass_foundation_ingestor WITH CHECK (true);
CREATE POLICY import_batches_update ON mass_foundation.import_batches FOR UPDATE TO mass_foundation_ingestor USING (true) WITH CHECK (true);
GRANT SELECT ON mass_foundation.import_batches TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor;
GRANT INSERT (id,mapping_version,extractor_version) ON mass_foundation.import_batches TO mass_foundation_ingestor;
GRANT UPDATE (state,checkpoint_position,extracted_count,accepted_count,quarantined_count,excluded_count)
 ON mass_foundation.import_batches TO mass_foundation_ingestor;
COMMIT;
