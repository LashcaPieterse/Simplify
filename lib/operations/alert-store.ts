import type { PrismaClient } from "@prisma/client";
import { affiliateInfrastructureEnabled } from "../affiliates/referral";

import type { SendEmailOptions } from "../notifications/email";
import { resolveReceiptDeliveryDetails } from "../notifications/receipts";
import { firstPaymentApproval, type AlertStore, type Incident, type MonitorSnapshot } from "./alerts";

function deliveryReady(order: { installation: { payload: string } | null; profiles: Array<{ activationCode: string | null }> } | null): boolean {
  if (!order?.profiles.length) return false;
  let payload = null;
  try { payload = order.installation ? JSON.parse(order.installation.payload) : null; } catch { /* Invalid payload is not delivery. */ }
  return resolveReceiptDeliveryDetails(payload, order.profiles[0]?.activationCode).ready;
}

export type AlertConfig = { enabled: boolean; recipient: string; sender: string; activatedAt: Date };

export async function readAlertConfig(db: PrismaClient): Promise<AlertConfig | null> {
  const rows = await db.$queryRaw<AlertConfig[]>`
    SELECT enabled, recipient, sender, activated_at AS "activatedAt"
    FROM recovery_ops.alert_config WHERE singleton`;
  return rows[0] ?? null;
}

export function productionAlertStore(db: PrismaClient, config: AlertConfig): AlertStore {
  return {
    async snapshot() {
      const [checkouts, supplierOrders, healthRows] = await Promise.all([
        db.checkoutSession.findMany({
          where: {
            AND: [
              { OR: [{ status: "paid" }, { payments: { some: { status: "approved" } } }] },
              { OR: [
                { order: { is: null } }, { order: { is: { status: { not: "completed" } } } },
                { order: { is: { orderNumber: null } } },
                { intent: "purchase", order: { is: { OR: [
                  { profiles: { none: {} } }, { installation: { is: null } }, { receiptSentAt: null },
                  { profiles: { some: { OR: [{ activationCode: null }, { activationCode: "" }] } } },
                ] } } },
              ] },
            ],
          },
          select: {
            id: true, intent: true, updatedAt: true,
            payments: { where: { status: "approved" }, orderBy: { createdAt: "asc" }, take: 1, select: { updatedAt: true, statusHistory: true } },
            order: { select: { id: true, status: true, orderNumber: true, receiptSentAt: true,
              profiles: { select: { activationCode: true } }, installation: { select: { payload: true } } } },
          },
        }),
        db.esimOrder.findMany({
          where: { OR: [
            { status: { in: ["airalo_failed", "airalo_outcome_unknown", "airalo_submitting"] } },
            { status: "pending", recoveryAttempts: { some: { result: "unresolved" } } },
          ] },
          select: { id: true, status: true, createdAt: true,
            profiles: { select: { activationCode: true } }, installation: { select: { payload: true } },
            recoveryAttempts: { orderBy: { createdAt: "desc" }, take: 1, select: { result: true } },
          },
        }),
        db.$queryRaw<Array<{
          recoveryActive: boolean | null; lastStart: Date | null; lastStatus: string | null;
          recoverySuccess: Date | null; httpStatus: number | null; httpError: boolean | null;
          responseBody: string | null; monitorActive: boolean | null; monitorSuccess: Date | null;
        }>>`
          SELECT
            (SELECT active FROM cron.job WHERE jobname = 'airalo-order-recovery') AS "recoveryActive",
            (SELECT start_time FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'airalo-order-recovery') ORDER BY start_time DESC LIMIT 1) AS "lastStart",
            (SELECT status FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'airalo-order-recovery') ORDER BY start_time DESC LIMIT 1) AS "lastStatus",
            (SELECT max(completed_at) FROM recovery_ops.http_requests WHERE http_status = 200 AND error_text IS NULL) AS "recoverySuccess",
            (SELECT http_status FROM recovery_ops.http_requests ORDER BY id DESC LIMIT 1) AS "httpStatus",
            (SELECT error_text IS NOT NULL FROM recovery_ops.http_requests ORDER BY id DESC LIMIT 1) AS "httpError",
            (SELECT response_body FROM recovery_ops.http_requests ORDER BY id DESC LIMIT 1) AS "responseBody",
            (SELECT active FROM cron.job WHERE jobname = 'production-alert-monitor') AS "monitorActive",
            (SELECT max(completed_at) FROM recovery_ops.monitor_requests WHERE http_status = 200 AND response_valid) AS "monitorSuccess"`,
      ]);
      const health = healthRows[0];
      const now = Date.now();
      const affiliates = affiliateInfrastructureEnabled() ? {
        overdueCommissions: await db.checkoutSession.count({ where: { affiliateId: { not: null }, affiliateCommission: null, order: { is: { fulfilledAt: { lte: new Date(now - 30 * 60_000) } } }, payments: { some: { status: "approved" } } } }),
        overdueNotifications: await db.affiliateNotification.count({ where: { sentAt: null, createdAt: { lte: new Date(now - 60 * 60_000) } } }),
      } : undefined;
      let responseValid = false;
      try {
        const summary = JSON.parse(health.responseBody ?? "null");
        responseValid = [summary?.checked, summary?.recovered, summary?.unresolved].every(value => Number.isInteger(value) && value >= 0);
      } catch { /* A 200 HTML/error response is not a successful recovery response. */ }
      return {
        activatedAt: config.activatedAt,
        affiliates,
        checkouts: checkouts.map(checkout => ({
          id: checkout.id, intent: checkout.intent,
          paidAt: firstPaymentApproval(checkout.payments[0]?.statusHistory ?? null, checkout.payments[0]?.updatedAt ?? checkout.updatedAt),
          orderId: checkout.order?.id ?? null, orderStatus: checkout.order?.status ?? null,
          supplierOrderId: checkout.order?.orderNumber ?? null,
          receiptSent: Boolean(checkout.order?.receiptSentAt), deliveryReady: deliveryReady(checkout.order),
        })),
        supplierOrders: supplierOrders.map(order => ({
          id: order.id, status: order.status, createdAt: order.createdAt,
          deliveryReady: deliveryReady(order), unresolved: order.recoveryAttempts[0]?.result === "unresolved",
        })),
        recovery: { active: health.recoveryActive, lastStart: health.lastStart, lastStatus: health.lastStatus,
          lastSuccess: health.recoverySuccess, httpStatus: health.httpStatus, httpError: Boolean(health.httpError), responseValid },
        monitor: { active: health.monitorActive, lastSuccess: health.monitorSuccess },
      } satisfies MonitorSnapshot;
    },
    async sync(incidents: Incident[]) {
      await db.$queryRaw`SELECT recovery_ops.sync_alerts(${JSON.stringify(incidents)}::jsonb)::text`;
    },
    async claim(key, payload) {
      const rows = await db.$queryRaw<Array<{ notification_key: string; payload: SendEmailOptions }>>`
        SELECT * FROM recovery_ops.claim_alert(${key}, ${JSON.stringify(payload)}::jsonb)`;
      return rows[0] ? { notificationKey: rows[0].notification_key, payload: rows[0].payload } : null;
    },
    async finish(key, notificationKey, emailId) {
      await db.$queryRaw`SELECT recovery_ops.finish_alert(${key}, ${notificationKey}, ${emailId})::text`;
    },
  };
}
