import type { SendEmailOptions } from "../notifications/email";

export type Incident = {
  key: string;
  category: string;
  entityId: string | null;
  title: string;
  detail: string;
};

export type MonitorSnapshot = {
  activatedAt: Date;
  checkouts: Array<{
    id: string;
    paidAt: Date;
    intent: string;
    orderId: string | null;
    orderStatus: string | null;
    supplierOrderId: string | null;
    deliveryReady: boolean;
    receiptSent: boolean;
  }>;
  supplierOrders: Array<{
    id: string;
    status: string;
    createdAt: Date;
    deliveryReady: boolean;
    unresolved: boolean;
  }>;
  recovery: {
    active: boolean | null;
    lastStart: Date | null;
    lastStatus: string | null;
    lastSuccess: Date | null;
    httpStatus: number | null;
    httpError: boolean;
    responseValid: boolean;
  };
  monitor: { active: boolean | null; lastSuccess: Date | null };
  affiliates?: { overdueCommissions: number; overdueNotifications: number };
  unresolvedPayments?: number;
  receipts?: { overdue: number; review: number };
};

const minutes = (now: Date, then: Date | null) => then ? (now.getTime() - then.getTime()) / 60000 : Infinity;

// Verification callbacks can update a payment repeatedly. Start the delivery
// timer at its first approval, rather than resetting it on every callback.
export function firstPaymentApproval(history: string | null, fallback: Date): Date {
  try {
    const events: unknown = JSON.parse(history ?? "null");
    if (!Array.isArray(events)) return fallback;
    const approvals = events.filter(event => event?.status === "approved" && typeof event.at === "string")
      .map(event => new Date(event.at).getTime()).filter(Number.isFinite);
    return approvals.length ? new Date(Math.min(...approvals)) : fallback;
  } catch { return fallback; }
}

export function findProductionIncidents(snapshot: MonitorSnapshot, now: Date): Incident[] {
  const incidents: Incident[] = [];
  if (snapshot.unresolvedPayments) incidents.push({ key: "payments:unresolved", category: "payment_reconciliation_delayed", entityId: null,
    title: "Payments await completion or review", detail: `${snapshot.unresolvedPayments} unresolved payments are over fifteen minutes old. Reconcile existing transactions; do not charge or capture automatically.` });
  if (snapshot.receipts?.overdue || snapshot.receipts?.review) incidents.push({ key: "receipts:delayed", category: "receipt_delivery_delayed", entityId: null,
    title: "Receipt delivery needs attention", detail: `${snapshot.receipts.overdue} receipts have waited over ten minutes; ${snapshot.receipts.review} require operator review. Review Admin → Security before resending.` });
  if (snapshot.affiliates?.overdueCommissions) incidents.push({ key: "affiliates:commissions", category: "affiliate_commissions_delayed", entityId: null, title: "Affiliate commission reconciliation is delayed", detail: `${snapshot.affiliates.overdueCommissions} fulfilled paid referrals have waited over thirty minutes for commission posting. Review Admin → Affiliates and the protected recovery scheduler.` });
  if (snapshot.affiliates?.overdueNotifications) incidents.push({ key: "affiliates:notifications", category: "affiliate_notifications_delayed", entityId: null, title: "Affiliate email delivery is delayed", detail: `${snapshot.affiliates.overdueNotifications} affiliate emails have waited over an hour. Review Admin → Affiliates and the email sender configuration.` });
  const manualOrders = new Set<string>();
  for (const order of snapshot.supplierOrders) {
    const age = minutes(now, order.createdAt);
    const blocked = ["airalo_failed", "airalo_outcome_unknown"].includes(order.status) && age >= 5;
    const submitting = order.status === "airalo_submitting" && age >= 10;
    const unresolved = order.unresolved && !order.deliveryReady && order.status !== "completed" && age >= 45;
    if (!blocked && !submitting && !unresolved) continue;
    manualOrders.add(order.id);
    incidents.push({
      key: `supplier:${order.id}`, category: "supplier_manual_review", entityId: order.id,
      title: "Supplier fulfilment needs manual review",
      detail: `Order status: ${order.status}. Reconcile the existing supplier purchase before taking further action. Do not resubmit the purchase blindly.`,
    });
  }
  for (const checkout of snapshot.checkouts) {
    if (minutes(now, checkout.paidAt) < 10 || (checkout.orderId && manualOrders.has(checkout.orderId))) continue;
    const complete = checkout.orderStatus === "completed" && Boolean(checkout.supplierOrderId);
    const fulfilled = checkout.intent === "top-up" ? complete : complete && checkout.deliveryReady;
    const receiptMissing = checkout.intent !== "top-up" && fulfilled && !checkout.receiptSent;
    if (fulfilled && !receiptMissing) continue;
    incidents.push({
      key: `delivery:${checkout.id}`, category: "paid_checkout_undelivered", entityId: checkout.id,
      title: receiptMissing ? "Paid eSIM receipt has not been sent" : "Paid checkout is awaiting fulfilment",
      detail: receiptMissing
        ? "Installation details are available, but the delivery email has not been accepted by the email provider. Check delivery before contacting the customer."
        : `A locally confirmed paid checkout has no completed ${checkout.intent === "top-up" ? "top-up" : "eSIM delivery"} after ten minutes. Check the payment and existing supplier purchase.`,
    });
  }
  const recovery = snapshot.recovery;
  if (recovery.active !== true) {
    incidents.push({ key: "recovery:stopped", category: "recovery_stopped", entityId: null,
      title: "Automatic order recovery is disabled or missing", detail: "Inspect the airalo-order-recovery Supabase Cron job." });
  } else {
    const overdue = minutes(now, recovery.lastSuccess ?? snapshot.activatedAt) >= 15;
    const stuck = recovery.lastStatus === "running" && minutes(now, recovery.lastStart) >= 6;
    const failed = recovery.lastStatus === "failed" || recovery.httpError ||
      (recovery.httpStatus !== null && (recovery.httpStatus !== 200 || !recovery.responseValid));
    if (overdue || stuck || failed) {
      incidents.push({ key: "recovery:unhealthy", category: "recovery_failure", entityId: null,
        title: overdue ? "Automatic recovery has missed its heartbeat" : "Automatic recovery failed or stalled",
        detail: `No successful recovery HTTP run within fifteen minutes, or the latest run failed/stalled. Latest HTTP status: ${recovery.httpStatus ?? "unavailable"}. Inspect Cron history and the private recovery HTTP audit.` });
    }
  }
  if (snapshot.monitor.active !== true || minutes(now, snapshot.monitor.lastSuccess ?? snapshot.activatedAt) >= 15) {
    incidents.push({ key: "monitor:stopped", category: "monitor_stopped", entityId: null,
      title: "The primary production alert monitor has stopped",
      detail: "Inspect the production-alert-monitor Supabase Cron job. This condition can also be checked by the independent GitHub watchdog." });
  }
  return incidents;
}

export type AlertClaim = { notificationKey: string; payload: SendEmailOptions };
export interface AlertStore {
  snapshot(): Promise<MonitorSnapshot>;
  sync(incidents: Incident[]): Promise<void>;
  claim(key: string, payload: SendEmailOptions): Promise<AlertClaim | null>;
  finish(key: string, notificationKey: string, emailId: string | null): Promise<void>;
}

export async function runProductionAlerts(options: {
  store: AlertStore;
  send: (payload: SendEmailOptions) => Promise<{ skipped: boolean; id: string | null }>;
  recipient: string;
  sender: string;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const snapshot = await options.store.snapshot();
  const incidents = findProductionIncidents(snapshot, now);
  await options.store.sync(incidents);
  let sent = 0;
  let failed = 0;
  let attempted = 0;
  for (const incident of incidents) {
    if (attempted >= 5) break;
    const payload: SendEmailOptions = {
      from: options.sender, to: options.recipient,
      subject: `SIM.Africa production alert: ${incident.title}`,
      text: [incident.title, "", incident.detail,
        incident.entityId ? `Reference: ${incident.entityId}` : "",
        `Detected: ${now.toISOString()}`,
        "Review: https://sim.africa/admin/operations",
        "This alert does not authorize a new supplier purchase.",
      ].filter(Boolean).join("\n"),
    };
    const claim = await options.store.claim(incident.key, payload);
    if (!claim) continue;
    attempted++;
    let emailId: string | null = null;
    try {
      const response = await options.send({ ...claim.payload, idempotencyKey: claim.notificationKey, timeoutMs: 8000 });
      if (!response.skipped) emailId = response.id;
    } catch { /* Persist a retryable delivery failure, without provider response data. */ }
    await options.store.finish(incident.key, claim.notificationKey, emailId);
    if (emailId) sent++; else failed++;
  }
  return { ok: failed === 0, activeIncidents: incidents.length, sent, failed };
}
