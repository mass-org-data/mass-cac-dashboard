-- TEST ONLY. These are empty local permission probes, not hosted Supabase roles.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE mass_test_ingestor LOGIN NOINHERIT;
CREATE ROLE mass_test_reviewer LOGIN NOINHERIT;
CREATE ROLE mass_test_auditor LOGIN NOINHERIT;
CREATE ROLE mass_test_unprivileged LOGIN NOINHERIT;
CREATE ROLE mass_test_rls_probe LOGIN NOINHERIT;
CREATE SCHEMA foundation_test;
GRANT USAGE ON SCHEMA foundation_test TO PUBLIC;
CREATE FUNCTION foundation_test.assert_true(ok boolean, label text) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
 RAISE NOTICE 'PASS: %', label;
END;
$$;
CREATE FUNCTION foundation_test.expect_error(statement text, expected_state text, label text) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE caught text;
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS caught=RETURNED_SQLSTATE;
 END;
 IF caught IS DISTINCT FROM expected_state THEN
  RAISE EXCEPTION 'FAIL: %, expected SQLSTATE %, received %',label,expected_state,coalesce(caught,'no error');
 END IF;
 RAISE NOTICE 'PASS: %',label;
END;
$$;
