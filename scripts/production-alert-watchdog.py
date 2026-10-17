"""Independent, best-effort fallback when the primary Cron monitor stops."""
import datetime
import json
import os
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    token = os.environ.get("AIRALO_SYNC_CRON_TOKEN", "").strip()
    email_key = os.environ.get("RESEND_API_KEY", "").strip()
    recipient = os.environ.get("PRODUCTION_ALERT_EMAIL", "").strip()
    if not token or not email_key or not recipient:
        raise SystemExit("Production watchdog configuration is incomplete.")
    opener = urllib.request.build_opener(NoRedirect)
    healthy = False
    request = urllib.request.Request(
        "https://sim.africa/api/operations/alerts", method="POST",
        headers={"x-airalo-sync-key": token},
    )
    try:
        with opener.open(request, timeout=70) as response:
            summary = json.load(response)
        healthy = summary.get("ok") is True and summary.get("enabled") is True
        print(json.dumps({key: summary.get(key) for key in ["ok", "enabled", "activeIncidents", "sent", "failed"]}))
    except Exception:
        print("Production alert monitor could not complete its check.")
    if healthy:
        return

    # Stable body + hourly key avoids a burst of fallback email on repeated
    # failures, including ambiguous network outcomes. Never log credentials.
    hour = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H")
    body = json.dumps({
        "from": "alerts@sim.africa", "to": [recipient],
        "subject": "SIM.Africa production alert: external watchdog failed",
        "text": "The independent GitHub watchdog could not complete the production alert check. Inspect Vercel, Supabase, and the production-alert-monitor Cron job. Review: https://sim.africa/admin/operations",
    }).encode()
    notification = urllib.request.Request(
        "https://api.resend.com/emails", method="POST", data=body,
        headers={"Authorization": "Bearer " + email_key, "Content-Type": "application/json",
                 "Idempotency-Key": "operations-watchdog-" + hour},
    )
    try:
        with opener.open(notification, timeout=15) as response:
            delivered = bool(json.load(response).get("id"))
    except Exception:
        delivered = False
    raise SystemExit("Monitor failed; fallback email " + ("accepted." if delivered else "could not be confirmed."))


if __name__ == "__main__":
    main()
