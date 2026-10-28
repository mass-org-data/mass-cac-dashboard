-- Read-only schema metadata, never table contents or Auth user records.
SELECT jsonb_build_object(
 'server_version',current_setting('server_version'),
 'tables',(SELECT jsonb_agg(t ORDER BY t.schema,t.name) FROM (
  SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,
   c.relacl::text AS acl,
   (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated,
    'acl',a.attacl::text) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
   (SELECT coalesce(jsonb_agg(jsonb_build_object('name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid),
     'columns',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.conkey) WITH ORDINALITY x(num,ord)
      JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num),
     'ref_schema',rn.nspname,'ref_table',rc.relname,
     'ref_columns',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.confkey) WITH ORDINALITY x(num,ord)
      JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num)) ORDER BY k.conname),'[]'::jsonb)
    FROM pg_constraint k LEFT JOIN pg_class rc ON rc.oid=k.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rc.relnamespace
    WHERE k.conrelid=c.oid) AS constraints,
   (SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,
     'roles',(SELECT jsonb_agg(CASE WHEN x=0 THEN 'PUBLIC' ELSE (SELECT rolname FROM pg_roles WHERE oid=x) END) FROM unnest(p.polroles)x),
     'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb)
    FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
   (SELECT coalesce(jsonb_agg(pg_get_triggerdef(g.oid) ORDER BY g.tgname),'[]'::jsonb) FROM pg_trigger g WHERE g.tgrelid=c.oid AND NOT g.tgisinternal) AS triggers,
   (SELECT coalesce(jsonb_agg(indexdef ORDER BY indexname),'[]'::jsonb) FROM pg_indexes WHERE schemaname=n.nspname AND tablename=c.relname) AS indexes
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('mass_core','mass_foundation') AND c.relkind='r'
 )t),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,
  'arguments',pg_get_function_identity_arguments(p.oid),'returns',pg_get_function_result(p.oid),
  'security_definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl::text) ORDER BY n.nspname,p.proname)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('mass_foundation','mass_core','mass_api')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,
  'bypass_rls',rolbypassrls,'create_role',rolcreaterole) ORDER BY rolname) FROM pg_roles
  WHERE rolname IN ('mass_foundation_owner','mass_foundation_ingestor','mass_foundation_reviewer','mass_foundation_auditor','mass_core_owner','mass_core_admin')),
 'default_acls',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl::text) ORDER BY r.rolname,n.nspname,d.defaclobjtype),'[]'::jsonb)
  FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
  WHERE r.rolname IN ('mass_foundation_owner','mass_core_owner'))
);
