BEGIN;
-- Fresh-install roles only: collisions fail rather than adopting existing privileges.
CREATE ROLE mass_foundation_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE mass_foundation_ingestor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE mass_foundation_reviewer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE mass_foundation_auditor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
-- PG17 CREATEROLE does not imply SET/INHERIT membership. Grant only the
-- trusted deployment principal owner privileges, before schema/ACL operations.
GRANT mass_foundation_owner TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
CREATE SCHEMA mass_foundation AUTHORIZATION mass_foundation_owner;
REVOKE ALL ON SCHEMA mass_foundation FROM PUBLIC;
GRANT USAGE ON SCHEMA mass_foundation TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor;
SET LOCAL ROLE mass_foundation_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA mass_foundation REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA mass_foundation REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION mass_foundation.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'immutable foundation record'; END;
$$;
REVOKE ALL ON FUNCTION mass_foundation.reject_mutation() FROM PUBLIC;
CREATE TABLE mass_foundation.source_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 -- Opaque references only: no filenames, signed URLs, credentials or copied contents.
 original_file_id text CHECK (original_file_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 storage_ref uuid NOT NULL UNIQUE,
 source_version text CHECK (source_version ~ '^[A-Za-z0-9_.-]{1,64}$'),
 exported_at timestamptz,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mass_foundation.source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_foundation.source_files FORCE ROW LEVEL SECURITY;
CREATE POLICY source_files_read ON mass_foundation.source_files FOR SELECT
 TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor USING (true);
CREATE POLICY source_files_insert ON mass_foundation.source_files FOR INSERT
 TO mass_foundation_ingestor WITH CHECK (true);
GRANT SELECT ON mass_foundation.source_files TO mass_foundation_ingestor, mass_foundation_reviewer, mass_foundation_auditor;
GRANT INSERT (id, original_file_id, sha256, storage_ref, source_version, exported_at)
 ON mass_foundation.source_files TO mass_foundation_ingestor;
CREATE TRIGGER source_files_immutable BEFORE UPDATE OR DELETE ON mass_foundation.source_files
 FOR EACH ROW EXECUTE FUNCTION mass_foundation.reject_mutation();
CREATE TRIGGER source_files_no_truncate BEFORE TRUNCATE ON mass_foundation.source_files
 FOR EACH STATEMENT EXECUTE FUNCTION mass_foundation.reject_mutation();
COMMIT;
