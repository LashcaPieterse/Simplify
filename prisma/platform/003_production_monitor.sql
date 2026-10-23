BEGIN;
SET LOCAL lock_timeout = '5s';

-- Private operational state; never expose it through the Supabase Data API.
CREATE TABLE recovery_ops.alert_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  recipient text NOT NULL,
  sender text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE recovery_ops.production_alerts (
  alert_key text PRIMARY KEY,
  incident_id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  entity_id text,
  title text NOT NULL,
  detail text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  last_notified_at timestamptz,
  last_email_id text,
  pending_key text,
  pending_payload jsonb,
  pending_created_at timestamptz,
  lease_until timestamptz,
  last_error text
);
CREATE TABLE recovery_ops.monitor_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  http_status integer,
  response_valid boolean,
  error_text text
);
ALTER TABLE recovery_ops.alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_ops.production_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_ops.monitor_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA recovery_ops FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA recovery_ops FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION recovery_ops.observe_alert(p_key text, p_category text, p_title text, p_detail text, p_entity text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
BEGIN
  INSERT INTO recovery_ops.production_alerts (alert_key, category, title, detail, entity_id)
  VALUES (p_key, p_category, p_title, p_detail, p_entity)
  ON CONFLICT (alert_key) DO UPDATE SET
    incident_id = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN gen_random_uuid() ELSE production_alerts.incident_id END,
    first_seen_at = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN now() ELSE production_alerts.first_seen_at END,
    last_notified_at = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN NULL ELSE production_alerts.last_notified_at END,
    pending_key = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN NULL ELSE production_alerts.pending_key END,
    pending_payload = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN NULL ELSE production_alerts.pending_payload END,
    pending_created_at = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN NULL ELSE production_alerts.pending_created_at END,
    lease_until = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN NULL ELSE production_alerts.lease_until END,
    last_error = CASE WHEN production_alerts.resolved_at IS NOT NULL THEN NULL ELSE production_alerts.last_error END,
    category = EXCLUDED.category, title = EXCLUDED.title, detail = EXCLUDED.detail,
    entity_id = EXCLUDED.entity_id, last_seen_at = now(), resolved_at = NULL;
END;
$function$;

CREATE FUNCTION recovery_ops.sync_alerts(p_incidents jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE incident jsonb;
BEGIN
  FOR incident IN SELECT value FROM jsonb_array_elements(p_incidents) LOOP
    PERFORM recovery_ops.observe_alert(incident->>'key', incident->>'category', incident->>'title', incident->>'detail', incident->>'entityId');
  END LOOP;
  UPDATE recovery_ops.production_alerts a SET resolved_at = now(), lease_until = NULL
  WHERE resolved_at IS NULL AND alert_key <> 'monitor:endpoint' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_incidents) i WHERE i->>'key' = a.alert_key
  );
END;
$function$;

-- A durable lease prevents concurrent schedulers from sending the same alert.
-- Freeze the body and key so ambiguous network outcomes can be retried safely.
CREATE FUNCTION recovery_ops.claim_alert(p_key text, p_payload jsonb)
RETURNS TABLE(notification_key text, payload jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE incident recovery_ops.production_alerts%ROWTYPE;
BEGIN
  SELECT * INTO incident FROM recovery_ops.production_alerts WHERE alert_key = p_key FOR UPDATE;
  IF NOT FOUND OR incident.resolved_at IS NOT NULL OR incident.lease_until > now()
    OR incident.last_notified_at > now() - interval '1 hour' THEN RETURN; END IF;
  IF incident.pending_created_at < now() - interval '23 hours' THEN
    incident.pending_key := NULL;
    incident.pending_payload := NULL;
  END IF;
  notification_key := coalesce(incident.pending_key, 'ops-' || gen_random_uuid()::text);
  payload := coalesce(incident.pending_payload, p_payload);
  UPDATE recovery_ops.production_alerts SET
    pending_key = notification_key, pending_payload = payload,
    pending_created_at = CASE WHEN pending_key IS NULL OR pending_created_at < now() - interval '23 hours' THEN now() ELSE pending_created_at END,
    lease_until = now() + interval '2 minutes'
  WHERE alert_key = p_key;
  RETURN NEXT;
END;
$function$;

CREATE FUNCTION recovery_ops.finish_alert(p_key text, p_notification text, p_email_id text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
BEGIN
  UPDATE recovery_ops.production_alerts SET
    last_notified_at = CASE WHEN p_email_id IS NOT NULL THEN now() ELSE last_notified_at END,
    last_email_id = coalesce(p_email_id, last_email_id),
    pending_key = CASE WHEN p_email_id IS NOT NULL THEN NULL ELSE pending_key END,
    pending_payload = CASE WHEN p_email_id IS NOT NULL THEN NULL ELSE pending_payload END,
    pending_created_at = CASE WHEN p_email_id IS NOT NULL THEN NULL ELSE pending_created_at END,
    lease_until = CASE WHEN p_email_id IS NOT NULL THEN NULL ELSE now() + interval '4 minutes' END,
    last_error = CASE WHEN p_email_id IS NULL THEN 'email_not_sent' ELSE NULL END
  WHERE alert_key = p_key AND pending_key = p_notification;
END;
$function$;

CREATE FUNCTION recovery_ops.run_production_monitor() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE
  config recovery_ops.alert_config%ROWTYPE;
  scheduler_token text;
  email_token text;
  response extensions.http_response;
  audit_id bigint;
  healthy boolean := false;
  claim record;
  email_id text;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('production-alert-monitor')::bigint) THEN RETURN NULL; END IF;
  SELECT * INTO config FROM recovery_ops.alert_config WHERE singleton;
  IF NOT FOUND OR NOT config.enabled THEN RETURN NULL; END IF;
  SELECT btrim(decrypted_secret) INTO scheduler_token FROM vault.decrypted_secrets WHERE name = 'airalo_recovery_cron_token';
  IF scheduler_token IS NULL OR scheduler_token = '' THEN RAISE EXCEPTION 'Monitor scheduler token missing'; END IF;
  INSERT INTO recovery_ops.monitor_requests DEFAULT VALUES RETURNING id INTO audit_id;
  PERFORM extensions.http_reset_curlopt();
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '75000');
  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');
  BEGIN
    SELECT * INTO response FROM extensions.http(ROW(
      'POST', 'https://sim.africa/api/operations/alerts',
      ARRAY[ROW('x-airalo-sync-key', scheduler_token)::extensions.http_header],
      'application/json', '{}'
    )::extensions.http_request);
    BEGIN
      healthy := response.status = 200 AND response.content::jsonb->>'ok' = 'true' AND response.content::jsonb->>'enabled' = 'true';
    EXCEPTION WHEN OTHERS THEN healthy := false;
    END;
    UPDATE recovery_ops.monitor_requests SET completed_at = clock_timestamp(), http_status = response.status,
      response_valid = coalesce(healthy, false) WHERE id = audit_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE recovery_ops.monitor_requests SET completed_at = clock_timestamp(), response_valid = false,
      error_text = 'HTTP transport failed: ' || SQLSTATE WHERE id = audit_id;
  END;
  IF NOT coalesce(healthy, false) THEN
    -- This path runs in Postgres, so it still alerts if Vercel is unavailable.
    PERFORM recovery_ops.observe_alert('monitor:endpoint', 'monitor_unavailable', 'Production alert endpoint is unavailable',
      'Inspect Vercel and the production-alert-monitor Cron job. The monitor could not complete its HTTP check.', NULL);
    SELECT * INTO claim FROM recovery_ops.claim_alert('monitor:endpoint', jsonb_build_object(
      'from', config.sender, 'to', jsonb_build_array(config.recipient),
      'subject', 'SIM.Africa production alert: monitoring endpoint unavailable',
      'text', 'The production alert monitor could not complete its check. Inspect Vercel and Supabase Cron. Review: https://sim.africa/admin/operations'
    ));
    IF FOUND THEN
      SELECT btrim(decrypted_secret) INTO email_token FROM vault.decrypted_secrets WHERE name = 'operations_alert_resend_key';
      email_id := NULL;
      IF email_token IS NOT NULL AND email_token <> '' THEN
        PERFORM extensions.http_reset_curlopt();
        PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '10000');
        BEGIN
          SELECT * INTO response FROM extensions.http(ROW(
            'POST', 'https://api.resend.com/emails',
            ARRAY[ROW('Authorization', 'Bearer ' || email_token)::extensions.http_header,
                  ROW('Idempotency-Key', claim.notification_key)::extensions.http_header],
            'application/json', claim.payload::text
          )::extensions.http_request);
          IF response.status BETWEEN 200 AND 299 THEN email_id := nullif(response.content::jsonb->>'id', ''); END IF;
        EXCEPTION WHEN OTHERS THEN email_id := NULL;
        END;
      END IF;
      PERFORM recovery_ops.finish_alert('monitor:endpoint', claim.notification_key, email_id);
    END IF;
  ELSE
    UPDATE recovery_ops.production_alerts SET resolved_at = now(), lease_until = NULL
    WHERE alert_key = 'monitor:endpoint' AND resolved_at IS NULL;
  END IF;
  PERFORM extensions.http_reset_curlopt();
  -- Bound only operational heartbeat/history storage, not customer records.
  DELETE FROM recovery_ops.monitor_requests WHERE requested_at < now() - interval '30 days';
  DELETE FROM recovery_ops.http_requests WHERE requested_at < now() - interval '30 days';
  DELETE FROM recovery_ops.production_alerts WHERE resolved_at < now() - interval '90 days';
  DELETE FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname IN ('production-alert-monitor', 'airalo-order-recovery'))
    AND end_time < now() - interval '30 days';
  RETURN CASE WHEN coalesce(healthy, false) THEN 200 ELSE 503 END;
END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA recovery_ops FROM PUBLIC, anon, authenticated, service_role;

DO $scheduler$
DECLARE monitor_job bigint;
BEGIN
  monitor_job := cron.schedule('production-alert-monitor', '4-59/5 * * * *', 'select recovery_ops.run_production_monitor();');
  PERFORM cron.alter_job(monitor_job, active := false);
END;
$scheduler$;
COMMIT;
