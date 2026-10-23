-- Register inactive: provision the existing scheduler token in Vault and
-- remove the previous automatic timer before explicitly activating this job.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE SCHEMA recovery_ops;
REVOKE ALL ON SCHEMA recovery_ops FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE recovery_ops.http_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  http_status integer,
  response_body text,
  error_text text
);
ALTER TABLE recovery_ops.http_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA recovery_ops FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA recovery_ops FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA recovery_ops REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA recovery_ops REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION recovery_ops.run_airalo_recovery() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $function$
DECLARE
  scheduler_token text;
  audit_id bigint;
  response extensions.http_response;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('airalo-order-recovery')::bigint) THEN
    RETURN pg_catalog.jsonb_build_object('skipped', 'already running');
  END IF;

  SELECT pg_catalog.btrim(decrypted_secret) INTO scheduler_token
  FROM vault.decrypted_secrets WHERE name = 'airalo_recovery_cron_token';
  IF scheduler_token IS NULL OR scheduler_token = '' THEN
    RAISE EXCEPTION 'Recovery scheduler token is not configured in Vault';
  END IF;

  INSERT INTO recovery_ops.http_requests DEFAULT VALUES RETURNING id INTO audit_id;
  -- Unlike pg_net, http does not put credentials into a shared request queue.
  -- The cron job holds one connection for at most 310 seconds. pg_cron itself
  -- serializes this job, and the advisory lock also protects manual callers.
  PERFORM extensions.http_reset_curlopt();
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '310000');
  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');
  BEGIN
    SELECT * INTO response FROM extensions.http(ROW(
      'POST', 'https://sim.africa/api/airalo/recover',
      ARRAY[ROW('x-airalo-sync-key', scheduler_token)::extensions.http_header],
      'application/json', '{}'
    )::extensions.http_request);
    UPDATE recovery_ops.http_requests
    SET completed_at = clock_timestamp(), http_status = response.status,
        response_body = pg_catalog.left(response.content, 16384)
    WHERE id = audit_id;
  EXCEPTION WHEN OTHERS THEN
    -- Never persist an exception containing request headers or secret values.
    UPDATE recovery_ops.http_requests
    SET completed_at = clock_timestamp(), error_text = 'HTTP transport failed: ' || SQLSTATE
    WHERE id = audit_id;
  END;
  PERFORM extensions.http_reset_curlopt();
  RETURN (SELECT pg_catalog.jsonb_build_object(
    'audit_id', id, 'http_status', http_status, 'error', error_text
  ) FROM recovery_ops.http_requests WHERE id = audit_id);
END;
$function$;
REVOKE ALL ON FUNCTION recovery_ops.run_airalo_recovery() FROM PUBLIC, anon, authenticated, service_role;

DO $scheduler$
DECLARE recovery_job bigint;
BEGIN
  recovery_job := cron.schedule(
    'airalo-order-recovery', '2-59/5 * * * *',
    'select recovery_ops.run_airalo_recovery();'
  );
  PERFORM cron.alter_job(recovery_job, active := false);
END;
$scheduler$;

DO $verification$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.rolname IN ('anon', 'authenticated') AND (
      pg_catalog.has_schema_privilege(r.oid, 'recovery_ops', 'USAGE') OR
      pg_catalog.has_table_privilege(r.oid, 'recovery_ops.http_requests', 'SELECT,INSERT,UPDATE,DELETE') OR
      pg_catalog.has_function_privilege(r.oid, 'recovery_ops.run_airalo_recovery()', 'EXECUTE')
    )
  ) THEN
    RAISE EXCEPTION 'Recovery scheduler access verification failed';
  END IF;
END;
$verification$;
COMMIT;
