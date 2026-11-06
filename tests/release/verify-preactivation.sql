-- Isolated seeded-upgrade projection check. No hosted execution.
DO $$DECLARE r record;checksum text;BEGIN
 FOR r IN SELECT * FROM upgrade_test.snapshot LOOP
  EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,''[]'')) FROM(SELECT %s FROM %s)x',r.fields,r.table_name) INTO checksum;
  IF checksum<>r.checksum THEN RAISE EXCEPTION 'Pre-existing data changed in %',r.table_name;END IF;
 END LOOP;
 RAISE NOTICE 'PASS: all27pre-existing table column/value projections remain identical';
END;$$;
