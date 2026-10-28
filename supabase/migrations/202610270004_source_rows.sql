BEGIN;
SET LOCAL ROLE mass_foundation_owner;
CREATE TABLE mass_foundation.source_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sheet_id uuid NOT NULL REFERENCES mass_foundation.source_sheets(id) ON DELETE RESTRICT,
 first_batch_id uuid NOT NULL REFERENCES mass_foundation.import_batches(id) ON DELETE RESTRICT,
 row_number integer NOT NULL CHECK (row_number > 0),
 content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
 classification text NOT NULL DEFAULT 'candidate' CHECK (classification IN
 ('candidate','example','scaffold','summary','rejected')),
 UNIQUE(sheet_id,row_number)
);
-- Fingerprints are not person keys. Identical legitimate row contents are allowed.
CREATE INDEX source_rows_batch_idx ON mass_foundation.source_rows(first_batch_id);
ALTER TABLE mass_foundation.source_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_foundation.source_rows FORCE ROW LEVEL SECURITY;
CREATE POLICY source_rows_read ON mass_foundation.source_rows FOR SELECT
 TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor USING (true);
CREATE POLICY source_rows_insert ON mass_foundation.source_rows FOR INSERT TO mass_foundation_ingestor WITH CHECK (true);
GRANT SELECT ON mass_foundation.source_rows TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor;
GRANT INSERT ON mass_foundation.source_rows TO mass_foundation_ingestor;
CREATE TRIGGER source_rows_immutable BEFORE UPDATE OR DELETE ON mass_foundation.source_rows
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation();
CREATE TRIGGER source_rows_no_truncate BEFORE TRUNCATE ON mass_foundation.source_rows
 FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation();
COMMIT;
