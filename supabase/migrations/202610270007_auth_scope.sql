BEGIN;
-- Requires managed Supabase auth.users/auth.uid(); plain PostgreSQL tests provide
-- an explicitly test-only compatible stub. No managed Auth resources are created.
CREATE ROLE mass_core_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE mass_core_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
-- Match the foundation bootstrap: owner membership belongs only to the trusted
-- deployment principal, never anon/authenticated/service_role or staff roles.
GRANT mass_core_owner TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
CREATE SCHEMA mass_core AUTHORIZATION mass_core_owner;
CREATE SCHEMA mass_api AUTHORIZATION mass_core_owner;
REVOKE ALL ON SCHEMA mass_core,mass_api FROM PUBLIC;
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
 user_id uuid NOT NULL,
 centre_id uuid NOT NULL REFERENCES mass_core.centres(id) ON DELETE RESTRICT,
 role_code text NOT NULL CHECK(role_code IN ('Leadership','Teacher','Cluster Officer')),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz CHECK(ends_at > starts_at),
 verified_by uuid NOT NULL,
 verified_at timestamptz NOT NULL,
 row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(user_id,centre_id,role_code,starts_at)
);
CREATE INDEX user_scope_lookup ON mass_core.user_scope_grants(user_id,centre_id,starts_at,ends_at);
-- Managed Auth privileges need not be delegable. The deployment principal uses
-- its own direct USAGE/EXECUTE/REFERENCES rights, retaining final core ownership.
RESET ROLE;
CREATE FUNCTION mass_core.request_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
BEGIN ATOMIC
 SELECT auth.uid();
END;
REVOKE ALL ON FUNCTION mass_core.request_user_id() FROM PUBLIC;
ALTER FUNCTION mass_core.request_user_id() OWNER TO mass_core_owner;
-- The SQL-standard body binds the managed function OID at installation. At
-- runtime the invoker still needs EXECUTE on auth.uid(); no definer elevation,
-- JWT parsing replacement or auth-schema/table grant is introduced.
DO $check$
BEGIN
 IF NOT has_function_privilege('mass_core_owner','auth.uid()','EXECUTE') THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='provider authorization required: core owner lacks EXECUTE on managed auth.uid()';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p,
  LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid='mass_core.request_user_id()'::regprocedure AND a.grantee<>p.proowner) THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='unexpected deployment default function grants; review before retry';
 END IF;
END;
$check$;
ALTER TABLE mass_core.user_scope_grants
 ADD CONSTRAINT user_scope_grants_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
 ADD CONSTRAINT user_scope_grants_verified_by_fkey FOREIGN KEY(verified_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
SET LOCAL ROLE mass_core_owner;
CREATE FUNCTION mass_core.can_read(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g
 WHERE g.user_id=mass_core.request_user_id() AND g.centre_id=c AND g.starts_at<=statement_timestamp()
 AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
$$;
CREATE FUNCTION mass_core.can_write(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g
 WHERE g.user_id=mass_core.request_user_id() AND g.centre_id=c AND g.role_code IN ('Teacher','Cluster Officer')
 AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
 AND NOT EXISTS(SELECT 1 FROM mass_core.user_scope_grants g WHERE g.user_id=mass_core.request_user_id()
 AND g.role_code='Leadership' AND g.starts_at<=statement_timestamp()
 AND (g.ends_at IS NULL OR statement_timestamp()<g.ends_at))
$$;
-- Any active Leadership designation prevents writes, including accidental mixed roles.
-- No global/null scope and no real role membership/grant rows are installed.
GRANT USAGE ON SCHEMA mass_core,mass_api TO authenticated;
GRANT EXECUTE ON FUNCTION mass_core.request_user_id(),mass_core.can_read(uuid),mass_core.can_write(uuid) TO authenticated;
GRANT USAGE ON SCHEMA mass_core TO mass_core_admin;
GRANT SELECT,INSERT ON mass_core.centres,mass_core.user_scope_grants TO mass_core_admin;

COMMIT;
