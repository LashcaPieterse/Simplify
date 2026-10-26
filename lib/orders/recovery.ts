import { queueOrderReceipt } from "../notifications/receipt-outbox";
import type { Prisma, PrismaClient } from "@prisma/client";
import { stampAffiliateFulfilment, safelyAccrueCommission } from "../affiliates/accounting";

import type { AiraloClient } from "../airalo/client";
import { WebhookPayloadSchema, type Order } from "../airalo/schemas";
import prisma from "../db/client";
import { toPrismaJson } from "../db/json";
import { sendOrderReceipt } from "../notifications/receipts";
import { logOrderInfo, logOrderWarn } from "../observability/logging";
import { createInstallationPayload, extractUsage } from "./airalo-metadata";
import { resolveAiraloActivationCode, resolveAiraloClient, resolveAiraloOrderId } from "./airalo-ordering";
import { assertWebhookOrderIdentity, resolveWebhookLocalOrderId } from "./webhook-matching";

type RecoveryOrder = Prisma.EsimOrderGetPayload<{
  include: { profiles: true; package: true; checkout: true; saleCheckout: true };
}>;
type RecoverySupplier = Pick<AiraloClient, "getOrderById" | "findOrdersByDescription">;

function positiveSetting(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export async function resolveRecoveryPurchase(
  order: Pick<RecoveryOrder, "id" | "orderNumber" | "requestId">,
  airalo: RecoverySupplier,
): Promise<Order | null> {
  // Async request IDs identify submissions, not /orders/{order_id} resources.
  if (order.orderNumber) return airalo.getOrderById(order.orderNumber);

  const marker = `[simplify_order_id:${order.id}]`;
  const results = await airalo.findOrdersByDescription(marker);
  const exact = results.filter((candidate) => {
    const id = resolveAiraloOrderId(candidate);
    if (!id) return false;
    return resolveWebhookLocalOrderId(WebhookPayloadSchema.parse({ data: candidate }).data) === order.id;
  });
  if (exact.length > 1) throw new Error("Multiple supplier purchases have the same local order marker; manual reconciliation required.");
  if (exact.length === 0) return null;
  const id = resolveAiraloOrderId(exact[0]);
  if (!id) throw new Error("Supplier search result has no order ID.");
  const purchase = await airalo.getOrderById(id);
  if (resolveAiraloOrderId(purchase) !== id) throw new Error("Supplier detail response has a conflicting order ID.");
  const data = WebhookPayloadSchema.parse({ data: purchase }).data;
  if (resolveWebhookLocalOrderId(data) !== order.id) {
    throw new Error("Supplier detail response is missing the exact local order marker.");
  }
  return purchase;
}

export async function applyRecoveredPurchase(
  tx: Prisma.TransactionClient,
  order: RecoveryOrder,
  purchase: Order,
): Promise<void> {
  const data = WebhookPayloadSchema.parse({ data: purchase }).data;
  assertWebhookOrderIdentity(order, data);
  const sale = order.saleCheckout ?? order.checkout;
  const topUp = sale?.intent === "top-up" ? sale : null;
  if (purchase.status !== "completed" || (!topUp && !data.iccid)) {
    throw new Error("Supplier fulfillment is not yet confirmed with a completed SIM.");
  }
  if (topUp) {
    const iccid = topUp.topUpForIccid;
    const originalOrderId = topUp.topUpForOrderId;
    if (!iccid || !originalOrderId ||
      (data.iccid && data.iccid !== iccid) ||
      (purchase.type !== undefined && purchase.type !== "topup") ||
      typeof purchase.description !== "string" || !purchase.description.includes(`Topup (${iccid})`)) {
      throw new Error("Recovered top-up does not identify the original SIM.");
    }
    const originalProfile = await tx.esimProfile.findUnique({ where: { iccid } });
    if (originalProfile?.orderId !== originalOrderId) {
      throw new Error("Recovered top-up SIM ownership conflicts with the original purchase.");
    }
  }
  const claimed = await tx.esimOrder.updateMany({
    where: {
      id: order.id,
      orderNumber: order.orderNumber,
      requestId: order.requestId,
      status: order.status,
      updatedAt: order.updatedAt,
    },
    data: { orderNumber: data.order_id, status: data.status },
  });
  if (claimed.count !== 1) throw new Error("Local order changed during recovery; retry on the next run.");

  if (!topUp) {
    const profile = await tx.esimProfile.upsert({
      where: { iccid: data.iccid! },
      create: {
        iccid: data.iccid!,
        orderId: order.id,
        status: data.status,
        activationCode: resolveAiraloActivationCode(purchase),
      },
      update: { status: data.status, activationCode: resolveAiraloActivationCode(purchase) },
    });
    if (profile.orderId !== order.id) throw new Error("Supplier SIM already belongs to another purchase.");

    const usage = extractUsage(purchase.metadata);
    if (usage) {
      await tx.usageSnapshot.create({
        data: {
          orderId: order.id,
          profileId: profile.id,
          usedMb: usage.usedMb ?? null,
          remainingMb: usage.remainingMb ?? null,
        },
      });
    }
    const payload = createInstallationPayload(purchase);
    await tx.esimInstallationPayload.upsert({
      where: { orderId: order.id },
      update: { payload },
      create: { orderId: order.id, payload },
    });
  }
  await tx.airaloOrderSnapshot.create({
    data: {
      orderId: order.id,
      source: "recovery",
      requestId: order.requestId,
      orderNumber: data.order_id,
      rawPayloadJson: toPrismaJson(purchase),
    },
  });
  await tx.esimOrderRecoveryAttempt.create({
    data: { orderId: order.id, identifier: data.order_id, result: "success" },
  });
  await stampAffiliateFulfilment(tx, order.id);
  await queueOrderReceipt(tx, order.id);
}

export async function recoverAiraloOrders(options: {
  prisma?: PrismaClient;
  airalo?: RecoverySupplier;
  limit?: number;
  orderId?: string;
} = {}): Promise<{ checked: number; recovered: number; unresolved: number }> {
  const db = options.prisma ?? prisma;
  const airalo = options.airalo ?? resolveAiraloClient();
  const staleMinutes = positiveSetting(process.env.AIRALO_RECOVERY_STALE_MINUTES, 10, 1440);
  const alertMinutes = positiveSetting(process.env.AIRALO_RECOVERY_ALERT_AFTER_MINUTES, 45, 10080);
  const batchSize = positiveSetting(String(options.limit ?? process.env.AIRALO_RECOVERY_BATCH_SIZE ?? ""), 25, 100);
  const orders = await db.esimOrder.findMany({
    where: {
      ...(options.orderId ? { id: options.orderId } : {}),
      status: { in: ["pending", "airalo_submitting", "airalo_outcome_unknown", "airalo_failed", "completed"] },
      ...(options.orderId ? {} : { createdAt: { lte: new Date(Date.now() - staleMinutes * 60000) } }),
      recoveryAttempts: { none: { createdAt: { gte: new Date(Date.now() - 5 * 60000) } } },
      AND: [
        { OR: [{ orderNumber: null }, { profiles: { none: {} } }] },
        { OR: [{ checkout: { is: null } }, { checkout: { is: { intent: "purchase" } } }, { checkout: { is: { intent: "top-up" } } }] },
        // Completed top-ups intentionally have no new installation profile.
        { OR: [{ status: { not: "completed" } }, { checkout: { is: null } }, { checkout: { is: { intent: "purchase" } } }] },
      ],
    },
    include: { profiles: true, package: true, checkout: true, saleCheckout: true },
    take: batchSize,
    orderBy: { updatedAt: "asc" },
  });
  const summary = { checked: orders.length, recovered: 0, unresolved: 0 };
  for (const order of orders) {
    try {
      if (order.quantity !== 1) throw new Error("Historical multiple-SIM purchase requires manual reconciliation.");
      const purchase = await resolveRecoveryPurchase(order, airalo);
      if (!purchase) throw new Error("No exact supplier purchase found; keep submission blocked and reconcile manually.");
      await db.$transaction((tx) => applyRecoveredPurchase(tx, order, purchase));
      await safelyAccrueCommission(order.id, db);
      summary.recovered += 1;
    } catch (error) {
      summary.unresolved += 1;
      const reason = error instanceof Error ? error.message : "Unknown recovery error";
      // Advance the queue without changing submission eligibility or supplier identity.
      await db.$transaction(async (tx) => {
        await tx.esimOrderRecoveryAttempt.create({
          data: { orderId: order.id, identifier: order.orderNumber ?? order.id, result: "unresolved", reason },
        });
        await tx.esimOrder.updateMany({
          where: { id: order.id, updatedAt: order.updatedAt },
          data: { updatedAt: new Date() },
        });
      });
      logOrderWarn("airalo.order.recovery.unresolved", { orderId: order.id, reason });
      if (Date.now() - order.createdAt.getTime() >= alertMinutes * 60000) {
        logOrderWarn("airalo.order.recovery.alert", { orderId: order.id, reason });
      }
      continue;
    }
    try {
      if ((order.saleCheckout ?? order.checkout)?.intent !== "top-up") await sendOrderReceipt(order.id, { prisma: db });
    } catch (error) {
      logOrderWarn("airalo.order.recovery.delivery_email_failed", {
        orderId: order.id,
        message: error instanceof Error ? error.message : "Unknown email error",
      });
    }
  }
  logOrderInfo("airalo.order.recovery.completed", summary);
  return summary;
}
