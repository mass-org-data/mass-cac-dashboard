-- Phase 6 permission cutover: make export-sized table reads a Leadership-only
-- server capability. Normal UI pages remain bounded to ten rows for every role.
-- Rollback: restore the two function definitions from
-- 20261117180000_server_table_pages.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL ROLE mass_core_owner;

DO $export_gate$
DECLARE
  target regprocedure;
  definition text;
  updated text;
  needle text := ' FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN';
  replacement text := ' IF p_limit>10 AND mass_core.application_role()<>''Leadership'' THEN RAISE EXCEPTION USING ERRCODE=''42501'',MESSAGE=''Leadership export authority required'';END IF;' || chr(10) ||
                      ' FOREACH c IN ARRAY p_centres LOOP IF c IS NULL OR NOT mass_core.can_read(c) THEN';
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'mass_api.attendance_register_page_v2(uuid[],date,date,text,text,text,integer,integer,text,boolean,text)'::regprocedure,
    'mass_api.dashboard_table_page(text,uuid[],jsonb,text,text,boolean,integer,integer)'::regprocedure
  ] LOOP
    definition := pg_get_functiondef(target);
    IF position('Leadership export authority required' IN definition)>0 THEN CONTINUE; END IF;
    IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized server-page function source: %',target; END IF;
    updated := replace(definition,needle,replacement);
    IF updated=definition THEN RAISE EXCEPTION 'Export gate patch failed: %',target; END IF;
    EXECUTE updated;
  END LOOP;
END;
$export_gate$;

-- Expose the immutable attendance row identifier alongside its version so the
-- confirmation dialog can call the narrow individual-delete RPC. The function
-- remains scoped and returns no additional student data.
DO $attendance_mark_identity$
DECLARE target regprocedure := 'mass_api.read_attendance_register(uuid,text,date)'::regprocedure; definition text; updated text;
BEGIN
 definition:=pg_get_functiondef(target);
 updated:=replace(definition,
  'jsonb_build_object(''enrolment'',x->>''enrolment_id'',''code'',x->>''code'',''version'',x->''row_version'')',
  'jsonb_build_object(''id'',x->>''id'',''enrolment'',x->>''enrolment_id'',''code'',x->>''code'',''version'',x->''row_version'')');
 IF updated=definition THEN RAISE EXCEPTION 'Attendance mark identity patch failed';END IF;
 EXECUTE updated;
END;
$attendance_mark_identity$;

NOTIFY pgrst,'reload schema';
COMMIT;
