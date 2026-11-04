-- READ ONLY. Additional control-plane checks after sealed020–023 installation.
-- Run through an authorized administrative read path, not the public Data API.
SELECT count(*) technical_tables,bool_and(relrowsecurity AND relforcerowsecurity) forced_rls
FROM pg_class WHERE relnamespace='mass_activation'::regnamespace AND relkind='r'; --2,true
SELECT count(*) technical_columns FROM pg_attribute WHERE attrelid IN(SELECT oid FROM pg_class WHERE relnamespace='mass_activation'::regnamespace AND relkind='r') AND attnum>0 AND NOT attisdropped; --10
SELECT count(*) technical_policies FROM pg_policy WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='mass_activation'::regnamespace AND relkind='r'); --2
SELECT count(*) flags,bool_and(NOT enabled) all_disabled FROM mass_activation.features; --14,true before any separately authorized activation
SELECT count(*) activation_events FROM mass_activation.events; --0 on a newly installed, never-activated release
SELECT role_name,has_schema_privilege(role_name,'mass_activation','USAGE') private_schema_usage,has_table_privilege(role_name,'mass_activation.features','UPDATE') may_toggle FROM unnest(ARRAY['authenticated','anon','service_role'])role_name; --all false
SELECT proname,pg_get_function_identity_arguments(oid) signature,pg_get_userbyid(proowner) owner,proconfig,
 position('-- MASS_ACTIVATION_GUARD_V1' IN prosrc)>0 entry_guard,has_function_privilege('anon',oid,'EXECUTE') anon_execute,has_function_privilege('service_role',oid,'EXECUTE') service_execute
FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND position('-- MASS_ACTIVATION_GUARD_V1' IN prosrc)>0 ORDER BY proname; --20 guarded RPCs after023,21 only after separate024; owner core; anon/service false
-- Source/definition comparison is mandatory: marker counts alone do not prove
-- guard placement or authorization. Compare the frozen seal and metadata too.
