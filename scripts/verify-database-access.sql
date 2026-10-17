-- Security regression checks. Run with the Prisma server connection.
-- Report metadata only. Access probes affect zero rows and are rolled back.
SELECT current_user AS server_role,
       (SELECT rolbypassrls OR rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
         AS server_bypasses_rls;

SELECT COUNT(*) AS tables_without_rls
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;

SELECT r.rolname AS api_role,
       pg_catalog.has_schema_privilege(r.oid, 'public', 'USAGE') AS backend_schema_access,
       COUNT(*) FILTER (
         WHERE pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       ) AS tables_with_any_grant
FROM pg_catalog.pg_roles r
CROSS JOIN pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname IN ('anon', 'authenticated')
  AND n.nspname = 'public' AND c.relkind IN ('r', 'p')
GROUP BY r.oid, r.rolname;

SELECT COUNT(*) AS unsafe_postgres_table_sequence_defaults
FROM pg_catalog.pg_default_acl d
JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
WHERE pg_catalog.pg_get_userbyid(d.defaclrole) = 'postgres'
  AND n.nspname = 'public' AND d.defaclobjtype IN ('r', 'S')
  AND (a.grantee = 0 OR a.grantee IN (
    SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('anon', 'authenticated')
  ));

-- Fail if either API role can perform any CRUD operation. These probes are
-- deliberately zero-row statements, so even a failing assertion changes no data.
BEGIN;
DO $tests$
DECLARE
  api_role TEXT;
  probe TEXT;
  denied INTEGER := 0;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    EXECUTE pg_catalog.format('SET LOCAL ROLE %I', api_role);
    FOREACH probe IN ARRAY ARRAY[
      'SELECT id FROM public."User" LIMIT 0',
      'INSERT INTO public."User" (id, email) SELECT ''security-probe'', ''security-probe@example.invalid'' WHERE false',
      'UPDATE public."User" SET name = name WHERE false',
      'DELETE FROM public."User" WHERE false'
    ]
    LOOP
      BEGIN
        EXECUTE probe;
        RAISE EXCEPTION 'API role % unexpectedly allowed %', api_role, probe;
      EXCEPTION WHEN insufficient_privilege THEN
        denied := denied + 1;
      END;
    END LOOP;
    RESET ROLE;
  END LOOP;
  IF denied <> 8 THEN
    RAISE EXCEPTION 'Expected eight access denials, received %', denied;
  END IF;
END;
$tests$;
ROLLBACK;
