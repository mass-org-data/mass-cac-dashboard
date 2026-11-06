BEGIN;
SET LOCAL ROLE mass_foundation_owner;
CREATE TABLE mass_foundation.source_sheets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 file_id uuid NOT NULL REFERENCES mass_foundation.source_files(id) ON DELETE RESTRICT,
 native_sheet_id text CHECK (native_sheet_id ~ '^[A-Za-z0-9_-]{1,64}$'),
 ordinal integer NOT NULL CHECK (ordinal > 0),
 classification text NOT NULL DEFAULT 'unclassified' CHECK (classification IN
 ('unclassified','input','master','helper','report','template')),
 header_version integer NOT NULL CHECK (header_version > 0),
 UNIQUE(file_id, ordinal), UNIQUE(file_id, native_sheet_id)
);
-- Exact labels/header contents remain outside this minimized foundation.
ALTER TABLE mass_foundation.source_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_foundation.source_sheets FORCE ROW LEVEL SECURITY;
CREATE POLICY source_sheets_read ON mass_foundation.source_sheets FOR SELECT
 TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor USING (true);
CREATE POLICY source_sheets_insert ON mass_foundation.source_sheets FOR INSERT
 TO mass_foundation_ingestor WITH CHECK (true);
GRANT SELECT ON mass_foundation.source_sheets TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor;
GRANT INSERT ON mass_foundation.source_sheets TO mass_foundation_ingestor;
CREATE TRIGGER source_sheets_immutable BEFORE UPDATE OR DELETE ON mass_foundation.source_sheets
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation();
CREATE TRIGGER source_sheets_no_truncate BEFORE TRUNCATE ON mass_foundation.source_sheets
 FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation();
COMMIT;
