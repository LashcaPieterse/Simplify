import { Prisma, type EsimOrder, type EsimProfile } from "@prisma/client";

import { AiraloClient, AiraloError } from "../lib/airalo/client";
import { resolveSharedTokenCache } from "../lib/airalo/token-cache";
import prisma from "../lib/db/client";
import { extractActivationCode, extractUsage, createInstallationPayload } from "../lib/orders/airalo-metadata";
import { logOrderError, logOrderInfo, logOrderWarn } from "../lib/observability/logging";

const BATCH_SIZE = Number(process.env.AIRALO_RECOVERY_BATCH_SIZE ?? 25);
const ALERT_AFTER_MINUTES = Number(process.env.AIRALO_RECOVERY_ALERT_AFTER_MINUTES ?? 45);
const STALE_AFTER_MINUTES = Number(process.env.AIRALO_RECOVERY_STALE_MINUTES ?? 10);

function resolveAiraloClient(): AiraloClient {
  const clientId = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET must be configured for recovery.");
  }

  return new AiraloClient({
    clientId,
    clientSecret,
    tokenCache: resolveSharedTokenCache(),
  });
}

interface StuckOrder extends EsimOrder {
  profiles: EsimProfile[];
}

function isOrderStale(order: EsimOrder): boolean {
  const ageMinutes = (Date.now() - order.createdAt.getTime()) / 60000;
  return ageMinutes >= STALE_AFTER_MINUTES;
}

function requiresAlert(order: EsimOrder): boolean {
  const ageMinutes = (Date.now() - order.createdAt.getTime()) / 60000;
  return ageMinutes >= ALERT_AFTER_MINUTES;
}

async function recordRecoveryAttempt(
  tx: Prisma.TransactionClient,
  orderId: string,
  identifier: string,
  result: string,
  reason?: string,
): Promise<void> {
  await tx.esimOrderRecoveryAttempt.create({
    data: {
      orderId,
      identifier,
      result,
      reason: reason ?? null,
    },
  });
}

async function backfillOrder(
  tx: Prisma.TransactionClient,
  order: StuckOrder,
  airaloOrder: Awaited<ReturnType<AiraloClient["getOrderById"]>>,
): Promise<void> {
  const metadata = (airaloOrder as { metadata?: unknown }).metadata;
  const activationCode = extractActivationCode(metadata) ?? airaloOrder.activation_code ?? null;
  const updateData: Prisma.EsimOrderUpdateInput = {
    status: airaloOrder.status,
  };

  if (!order.orderNumber) {
    updateData.orderNumber = airaloOrder.order_id;
  }

  if (!order.requestId && airaloOrder.order_reference) {
    updateData.requestId = airaloOrder.order_reference;
  }

  await tx.esimOrder.update({
    where: { id: order.id },
    data: updateData,
  });

  let profileId: string | null = null;

  if (airaloOrder.iccid) {
    const profile = await tx.esimProfile.upsert({
      where: { iccid: airaloOrder.iccid },
      create: {
        iccid: airaloOrder.iccid,
        status: airaloOrder.status,
        activationCode,
        orderId: order.id,
      },
      update: {
        status: airaloOrder.status,
        activationCode,
        orderId: order.id,
      },
    });
    profileId = profile.id;
  } else if (order.profiles.length > 0) {
    const existing = order.profiles[0];
    await tx.esimProfile.update({
      where: { id: existing.id },
      data: {
        status: airaloOrder.status,
        activationCode,
      },
    });
    profileId = existing.id;
  }

  const usage = extractUsage(metadata);
  if (usage && profileId) {
    await tx.usageSnapshot.create({
      data: {
        orderId: order.id,
        profileId,
        usedMb: usage.usedMb ?? null,
        remainingMb: usage.remainingMb ?? null,
      },
    });
  }

  const payload = createInstallationPayload(airaloOrder);
  await tx.esimInstallationPayload.upsert({
    where: { orderId: order.id },
    update: { payload },
    create: {
      orderId: order.id,
      payload,
    },
  });
}

async function processOrder(order: StuckOrder, airalo: AiraloClient): Promise<void> {
  const identifier = order.orderNumber ?? order.requestId;

  if (!identifier) {
    logOrderWarn("airalo.order.recovery.skipped", {
      orderId: order.id,
      reason: "missing_identifier",
    });

    await prisma.esimOrderRecoveryAttempt.create({
      data: {
        orderId: order.id,
        identifier: order.id,
        result: "skipped",
        reason: "missing_identifier",
      },
    });
    return;
  }

  logOrderInfo("airalo.order.recovery.started", {
    orderId: order.id,
    identifier,
  });

  let airaloOrder;
  try {
    airaloOrder = await airalo.getOrderById(identifier);
  } catch (error: unknown) {
    let reason = "unknown";

    if (error instanceof AiraloError) {
      reason = `airalo_${error.details.status}`;
      logOrderWarn("airalo.order.recovery.airalo_error", {
        orderId: order.id,
        identifier,
        status: error.details.status,
        statusText: error.details.statusText,
        body: error.details.body ?? null,
      });
    } else {
      logOrderError("airalo.order.recovery.failed", {
        orderId: order.id,
        identifier,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    await prisma.esimOrderRecoveryAttempt.create({
      data: {
        orderId: order.id,
        identifier,
        result: "failed",
        reason,
      },
    });

    if (requiresAlert(order)) {
      logOrderWarn("airalo.order.recovery.alert", {
        orderId: order.id,
        identifier,
        ageMinutes: (Date.now() - order.createdAt.getTime()) / 60000,
        reason,
      });
    }

    return;
  }

  await prisma.$transaction(async (tx) => {
    await backfillOrder(tx, order, airaloOrder);
    await recordRecoveryAttempt(tx, order.id, identifier, "success");
  });

  logOrderInfo("airalo.order.recovery.completed", {
    orderId: order.id,
    identifier,
  });
}

async function main() {
  const airalo = resolveAiraloClient();

  const stuckOrders = await prisma.esimOrder.findMany({
    where: {
      status: "pending",
      OR: [{ orderNumber: null }, { profiles: { none: {} } }],
    },
    include: { profiles: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  if (stuckOrders.length === 0) {
    logOrderInfo("airalo.order.recovery.empty", {});
    return;
  }

  for (const order of stuckOrders) {
    if (!isOrderStale(order)) {
      continue;
    }

    await processOrder(order, airalo);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
