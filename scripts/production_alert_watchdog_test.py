"""Exercise outage handling without contacting production or sending email."""
import contextlib
import importlib.util
import io
import json
import os
import pathlib
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "watchdog", pathlib.Path(__file__).with_name("production-alert-watchdog.py")
)
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)


class WatchdogTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "AIRALO_SYNC_CRON_TOKEN": "private-scheduler-token",
            "RESEND_API_KEY": "private-email-key",
            "PRODUCTION_ALERT_EMAIL": "owner@example.com",
        }, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def run_monitor(self, responses):
        calls = []

        class Opener:
            def open(self, request, timeout):
                calls.append(request)
                response = next(responses)
                if isinstance(response, Exception):
                    raise response
                return io.StringIO(json.dumps(response))

        output = io.StringIO()
        with patch.object(watchdog.urllib.request, "build_opener", return_value=Opener()), contextlib.redirect_stdout(output):
            try:
                watchdog.main()
                status = None
            except SystemExit as error:
                status = str(error)
        return calls, status, output.getvalue()

    def test_healthy_run_never_contacts_email_provider_or_logs_response_secrets(self):
        calls, status, output = self.run_monitor(iter([{
            "ok": True, "enabled": True, "activeIncidents": 0,
            "unexpected": "private-response-data",
        }]))
        self.assertIsNone(status)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].full_url, "https://sim.africa/api/operations/alerts")
        self.assertNotIn("private-", output)

    @patch.object(watchdog.datetime, "datetime")
    def test_outage_uses_separate_email_credentials_and_stable_idempotency(self, clock):
        clock.now.return_value.strftime.return_value = "2026101720"
        notifications = []
        for _ in range(2):
            calls, status, output = self.run_monitor(iter([
                RuntimeError("private-transport-details"), {"id": "email-1"},
            ]))
            self.assertIn("fallback email accepted", status)
            notification = calls[1]
            self.assertEqual(notification.full_url, "https://api.resend.com/emails")
            self.assertEqual(notification.get_header("Authorization"), "Bearer private-email-key")
            self.assertIsNone(notification.get_header("X-airalo-sync-key"))
            self.assertNotIn("private-", output)
            notifications.append((notification.get_header("Idempotency-key"), notification.data))
        self.assertEqual(notifications[0], notifications[1])

    def test_invalid_summary_or_failed_email_never_reports_success(self):
        for summary in [{"ok": False, "enabled": True}, {"ok": True, "enabled": False}, []]:
            calls, status, output = self.run_monitor(iter([
                summary, RuntimeError("private-email-provider-error"),
            ]))
            self.assertEqual(len(calls), 2)
            self.assertIn("could not be confirmed", status)
            self.assertNotIn("private-", output)

    def test_redirects_cannot_forward_scheduler_or_email_credentials(self):
        self.assertIsNone(watchdog.NoRedirect().redirect_request(
            None, None, 302, "Found", {}, "https://other.example"
        ))


if __name__ == "__main__":
    unittest.main()
