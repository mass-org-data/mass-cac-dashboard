-- TEST-ONLY stand-in for managed Auth in plain PostgreSQL. Not a production migration.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE mass_test_authenticator LOGIN NOINHERIT;
GRANT anon,authenticated TO mass_test_authenticator;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE SCHEMA core_test;
GRANT USAGE ON SCHEMA core_test TO PUBLIC;
CREATE TABLE core_test.ids(label text PRIMARY KEY,child_id uuid,enrolment_id uuid);
GRANT SELECT,INSERT ON core_test.ids TO authenticated;
CREATE FUNCTION core_test.id(k text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT enrolment_id FROM core_test.ids WHERE label=k
$$;
CREATE FUNCTION core_test.assert_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label; END;
$$;
CREATE FUNCTION core_test.expect_error(statement text,expected text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught text;
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS caught=RETURNED_SQLSTATE; END;
 IF caught IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL: %, expected %, got %',label,expected,coalesce(caught,'no error'); END IF;
 RAISE NOTICE 'PASS: %',label;
END;
$$;
