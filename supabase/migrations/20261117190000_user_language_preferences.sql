-- Self-service interface language preference. This stores no programme or student data and grants no table access.
-- Apply only with supabase/activation/seal.sql in the same reviewed transaction.
-- Rollback: revoke the two API functions, drop them, then drop mass_core.user_preferences.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

CREATE TABLE mass_core.user_preferences(
 auth_user_id uuid PRIMARY KEY,
 default_language text NOT NULL DEFAULT 'en' CHECK(default_language IN ('en','kn')),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mass_core.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_core.user_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON mass_core.user_preferences TO mass_core_owner USING(true) WITH CHECK(true);

CREATE FUNCTION mass_api.get_user_preferences() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE subject uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 subject:=mass_core.request_user_id();
 IF subject IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required';END IF;
 RETURN jsonb_build_object('default_language',coalesce((SELECT p.default_language FROM mass_core.user_preferences p WHERE p.auth_user_id=subject),'en'));
END;
$$;

CREATE FUNCTION mass_api.set_default_language(p_language text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE subject uuid;
BEGIN
 PERFORM mass_core.require_staff_session();
 subject:=mass_core.request_user_id();
 IF subject IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='authenticated identity required';END IF;
 IF p_language IS NULL OR p_language NOT IN ('en','kn') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='supported language required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('user-language.'||subject::text,0));
 INSERT INTO mass_core.user_preferences(auth_user_id,default_language)
 VALUES(subject,p_language)
 ON CONFLICT(auth_user_id) DO UPDATE SET default_language=excluded.default_language,updated_at=clock_timestamp();
 RETURN jsonb_build_object('default_language',p_language);
END;
$$;

GRANT EXECUTE ON FUNCTION mass_api.get_user_preferences(),mass_api.set_default_language(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
