BEGIN;
-- Requires managed Supabase auth.users/auth.uid(); plain PostgreSQL tests provide
-- an explicitly test-only compatible stub. No managed Auth resources are created.
CREATE ROLE mass_core_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE mass_core_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA mass_core AUTHORIZATION mass_core_owner;
CREATE SCHEMA mass_api AUTHORIZATION mass_core_owner;
REVOKE ALL ON SCHEMA mass_core,mass_api FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO mass_core_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO mass_core_owner;
GRANT REFERENCES(id) ON auth.users TO mass_core_owner;
SET LOCAL ROLE mass_core_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
CREATE TABLE mass_core.centres (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 120),
 row_version bigint NOT NULL DEFAULT 1
);
CREATE TABLE mass_core.user_scope_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 role_code text NOT NULL CHECK(role_code IN ('Leadership','Teacher','Cluster Officer')),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz CHECK(ends_at > starts_at),
 verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 verified_at timestamptz NOT NULL,
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(user_id,centre_id,role_code,starts_at)
);
CREATE INDEX user_scope_lookup ON mass_core.user_scope_grants(user_id,centre_id,starts_at,ends_at);
CREATE FUNCTION mass_core.can_read(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g
 WHERE g.user_id=auth.uid() AND g.centre_id=c AND g.starts_at<=statement_timestamp()
 AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
$$;
CREATE FUNCTION mass_core.can_write(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g
 WHERE g.user_id=auth.uid() AND g.centre_id=c AND g.role_code IN ('Teacher','Cluster Officer')
 AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
 AND NOT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=auth.uid()
 AND g.role_code='Leadership' AND g.starts_at<=statement_timestamp()
 AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
$$;
-- Any active Leadership designation prevents writes, including accidental mixed roles.
-- No global/null scope and no real role membership/grant rows are installed.
GRANT USAGE ON SCHEMA mass_core,mass_api TO authenticated;
GRANT EXECUTE ON FUNCTION mass_core.can_read(uuid),mass_core.can_write(uuid) TO authenticated;
GRANT USAGE ON SCHEMA mass_core TO mass_core_admin;
GRANT SELECT,INSERT ON mass_core.centres,mass_core.user_scope_grants TO mass_core_admin;

COMMIT;
