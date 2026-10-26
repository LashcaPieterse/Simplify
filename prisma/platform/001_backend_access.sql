-- All public-schema tables belong to the server-side Prisma application.
-- Customer authorization uses NextAuth and scoped access tokens, not Supabase JWTs.
-- Keep the privileged server role working; never grant these tables to API roles.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- A schema boundary also protects future tables, including ones created by
-- dashboard roles whose default privileges cannot be changed by postgres.
REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO postgres, service_role;

DO $migration$
DECLARE
  relation RECORD;
BEGIN
  FOR relation IN
    SELECT c.relname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation.relname);
  END LOOP;
END;
$migration$;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Prisma migrations run as postgres. New tables/sequences must require an
-- explicit access decision even if schema usage is deliberately restored later.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- Existing policies reference this helper; retain it for privileged callers
-- while removing the mutable-search-path advisory and public RPC access.
ALTER FUNCTION public.is_admin_role() SET search_path = pg_catalog;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_admin_role() FROM PUBLIC, anon, authenticated;

-- Abort the whole migration if a role inheritance or PUBLIC grant leaves an
-- API role with access, or if any application table escaped RLS protection.
DO $verification$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.rolname IN ('anon', 'authenticated')
      AND pg_catalog.has_schema_privilege(r.oid, 'public', 'USAGE')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND r.rolname IN ('anon', 'authenticated')
      AND pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Backend database access verification failed';
  END IF;

  -- Validate that the migration connection still reaches core application data.
  PERFORM 1 FROM public."User" LIMIT 1;
  PERFORM 1 FROM public."CheckoutSession" LIMIT 1;
  PERFORM 1 FROM public."AiraloAccessToken" LIMIT 1;
END;
$verification$;

COMMIT;
