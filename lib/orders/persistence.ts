import { enqueueJob } from "../jobs/store";
import { queueOrderReceipt } from "../notifications/receipt-outbox";
import { Prisma, type PrismaClient } from "@prisma/client";
import { stampAffiliateFulfilment } from "../affiliates/accounting";

import type {
  SubmitOrderAsyncAck,
} from "../airalo/client";
import type {
  Order as AiraloOrder,
  OrderResponse,
  SubmitOrderAsyncResponse,
} from "../airalo/schemas";
import prismaClient from "../db/client";
import { toPrismaJson } from "../db/json";
import { logOrderError, logOrderWarn } from "../observability/logging";
import { recordOrderMetrics } from "../observability/metrics";
import { createInstallationPayload } from "./airalo-metadata";
import {
  type AiraloOrderPackage,
  type OrderSubmissionMode,
  resolveAiraloActivationCode,
  resolveAiraloIccid,
  resolveAiraloOrderId,
  resolveAiraloStatus,
} from "./airalo-ordering";
import { OrderServiceError, type MetricsReason } from "./errors";
import {
  assertValidReservedOrderSnapshot,
  type ReservedOrderSnapshot,
} from "./validation";
import {
  ORDER_CLAIMABLE_STATUSES,
  ORDER_OUTCOME_UNKNOWN_STATUS,
  ORDER_REJECTED_STATUS,
  ORDER_SUBMITTING_STATUS,
  assertPurchaseOutcomeKnown,
  type PurchaseFailureOutcome,
} from "./submission-state";

export type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export type CreateOrderResult = {
  orderId: string;
  orderNumber: string | null;
  requestId: string | null;
  redirectOrderId?: string | null;
  installation?: {
    qrCodeData?: string | null;
    qrCodeUrl?: string | null;
    smdpAddress?: string | null;
    activationCode?: string | null;
    apn?: string | null;
  };
};

export type PersistedOrderRecord = {
  id: string;
  orderNumber: string | null;
  requestId: string | null;
};

export function isPrismaClient(client: PrismaDbClient): client is PrismaClient {
  return typeof (client as PrismaClient).$transaction === "function";
}

export function createResultFromExistingOrder(order: {
  id: string;
  orderNumber?: string | null;
  requestId?: string | null;
}, options: { redirectOrderId?: string | null } = {}): CreateOrderResult {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber ?? null,
    requestId: order.requestId ?? order.orderNumber ?? order.id,
    redirectOrderId: options.redirectOrderId ?? null,
  };
}

export async function claimReservedOrderForSubmission(
  db: PrismaDbClient,
  snapshot: ReservedOrderSnapshot,
): Promise<CreateOrderResult | null> {
  assertValidReservedOrderSnapshot(snapshot);

  const existing = await db.esimOrder.findUnique({
    where: { id: snapshot.orderId },
    select: {
      id: true,
      orderNumber: true,
      requestId: true,
      status: true,
    },
  });

  if (!existing) {
    throw new OrderServiceError("Reserved checkout order was not found.", 500);
  }

  if (existing.orderNumber || existing.requestId) {
    return createResultFromExistingOrder(existing);
  }
  assertPurchaseOutcomeKnown(existing);

  const claim = await db.esimOrder.updateMany({
    where: {
      id: snapshot.orderId,
      orderNumber: null,
      requestId: null,
      status: { in: ORDER_CLAIMABLE_STATUSES },
    },
    data: {
      status: ORDER_SUBMITTING_STATUS,
    },
  });

  if (claim.count > 0) {
    return null;
  }

  const current = await db.esimOrder.findUnique({
    where: { id: snapshot.orderId },
    select: {
      id: true,
      orderNumber: true,
      requestId: true,
      status: true,
    },
  });

  if (!current) {
    throw new OrderServiceError("Reserved checkout order was not found.", 500);
  }
  assertPurchaseOutcomeKnown(current);
  return createResultFromExistingOrder(current);
}

export async function markReservedOrderSubmissionFailed(
  db: PrismaDbClient,
  snapshot: ReservedOrderSnapshot | null,
  outcome: PurchaseFailureOutcome,
): Promise<void> {
  if (!snapshot) {
    return;
  }

  try {
    await db.esimOrder.updateMany({
      where: {
        id: snapshot.orderId,
        orderNumber: null,
        requestId: null,
        status: ORDER_SUBMITTING_STATUS,
      },
      data: {
        status: outcome === "rejected" ? ORDER_REJECTED_STATUS : ORDER_OUTCOME_UNKNOWN_STATUS,
      },
    });
  } catch (error) {
    logOrderWarn("order.reserved.mark_failed_failed", {
      orderId: snapshot.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function autoDeactivatePackage(
  pkg: { id: string; airaloPackageId: string },
  options: {
    reason: string | null;
    businessCode: number | null;
    classification: MetricsReason | null;
    prisma: PrismaDbClient;
  },
): Promise<void> {
  const client = isPrismaClient(options.prisma) ? options.prisma : prismaClient;
  const result = await client.packageState.updateMany({
    where: { packageId: pkg.id, isActive: true },
    data: { isActive: false, deactivatedAt: new Date() },
  });

  if (result.count > 0) {
    logOrderWarn("catalog.package.auto_paused", {
      packageId: pkg.id,
      packageExternalId: pkg.airaloPackageId,
      reason: options.reason,
      airaloErrorCode: options.businessCode,
      classification: options.classification,
    });
  }
}

export async function persistOrderRecords(
  db: PrismaDbClient,
  input: {
    userId?: string | null;
    reservedOrder: ReservedOrderSnapshot | null;
    pkg: AiraloOrderPackage;
    customerEmail?: string | null;
    quantity: number;
    totalCents: number;
    currency: string;
    airaloAsyncResponse: SubmitOrderAsyncResponse | null;
    airaloOrderResponse: OrderResponse | null;
    airaloAck: SubmitOrderAsyncAck | null;
    airaloOrder: AiraloOrder | null;
    airaloOrderSnapshotSource?: string;
    persistSimProfile?: boolean;
    persistInstallation?: boolean;
    statusFallback?: string;
  },
): Promise<PersistedOrderRecord> {
  const createOrderRecords = async (tx: Prisma.TransactionClient) => {
    const syncOrderNumber = resolveAiraloOrderId(input.airaloOrder);
    const syncRequestId =
      input.airaloOrder?.order_reference ?? syncOrderNumber;
    const status =
      input.airaloOrder?.status ?? input.statusFallback ?? resolveAiraloStatus(input.airaloOrder);

    const orderData = {
      userId: input.userId ?? null,
      orderNumber: syncOrderNumber,
      requestId: input.airaloAck?.request_id ?? syncRequestId,
      packageId: input.pkg.id,
      status,
      customerEmail: input.customerEmail ?? null,
      quantity: input.quantity,
      totalCents: input.totalCents,
      currency: input.currency,
    };

    let orderRecord: PersistedOrderRecord;
    if (input.reservedOrder && input.airaloAck) {
      // A fast webhook can fulfill the order before its async ACK is saved.
      // Never replace that supplier identity or completed status with a pending ACK.
      await tx.esimOrder.updateMany({
        where: {
          id: input.reservedOrder.orderId,
          orderNumber: null,
          requestId: null,
          status: ORDER_SUBMITTING_STATUS,
        },
        data: orderData,
      });
      const existing = await tx.esimOrder.findUnique({ where: { id: input.reservedOrder.orderId } });
      if (!existing || (existing.requestId && existing.requestId !== input.airaloAck.request_id)) {
        throw new OrderServiceError("Async acknowledgement conflicts with the reserved purchase.", 409);
      }
      if (!existing.requestId) {
        if (!existing.orderNumber) throw new OrderServiceError("Reserved purchase cannot accept this acknowledgement.", 409);
        const linked = await tx.esimOrder.updateMany({
          where: { id: existing.id, orderNumber: existing.orderNumber, requestId: null },
          data: { requestId: input.airaloAck.request_id },
        });
        if (linked.count !== 1) throw new OrderServiceError("Reserved purchase changed while saving its acknowledgement.", 409);
      }
      orderRecord = { ...existing, requestId: input.airaloAck.request_id };
    } else {
      orderRecord = input.reservedOrder
        ? await tx.esimOrder.update({ where: { id: input.reservedOrder.orderId }, data: orderData })
        : await tx.esimOrder.create({ data: orderData });
    }

    if (input.airaloAsyncResponse) {
      await tx.airaloOrderSnapshot.create({
        data: {
          orderId: orderRecord.id,
          source: "orders-async",
          requestId: input.airaloAsyncResponse.data.request_id,
          orderNumber: null,
          rawPayloadJson: toPrismaJson(input.airaloAsyncResponse),
        },
      });
    }

    if (input.airaloOrderResponse) {
      await tx.airaloOrderSnapshot.create({
        data: {
          orderId: orderRecord.id,
          source: input.airaloOrderSnapshotSource ?? "orders",
          requestId: syncRequestId,
          orderNumber: syncOrderNumber,
          rawPayloadJson: toPrismaJson(input.airaloOrderResponse),
        },
      });
    }

    if (input.airaloOrder) {
      const iccid = resolveAiraloIccid(input.airaloOrder);
      if (iccid && input.persistSimProfile !== false) {
        const profile = await tx.esimProfile.upsert({
          where: { iccid },
          create: {
            iccid,
            status: resolveAiraloStatus(input.airaloOrder),
            activationCode: resolveAiraloActivationCode(input.airaloOrder),
            orderId: orderRecord.id,
          },
          update: {
            status: resolveAiraloStatus(input.airaloOrder),
            activationCode: resolveAiraloActivationCode(input.airaloOrder),
          },
        });
        if (profile.orderId !== orderRecord.id) {
          throw new OrderServiceError("Supplier SIM already belongs to another purchase.", 409);
        }
      }

      if (input.persistInstallation !== false) {
        const installationPayload = createInstallationPayload(input.airaloOrder);
        await tx.esimInstallationPayload.upsert({
          where: { orderId: orderRecord.id },
          create: { orderId: orderRecord.id, payload: installationPayload },
          update: { payload: installationPayload },
        });
      }
    }

    await stampAffiliateFulfilment(tx, orderRecord.id);
    await queueOrderReceipt(tx, orderRecord.id);
    await enqueueJob(tx, "complete_installation", orderRecord.id);
    return orderRecord;
  };

  return isPrismaClient(db)
    ? db.$transaction(async (tx) => createOrderRecords(tx))
    : createOrderRecords(db);
}

export function handlePersistenceError(options: {
  error: unknown;
  pkg: AiraloOrderPackage;
  startedAt: number;
  resolvedSubmissionMode: OrderSubmissionMode;
  airaloAck: SubmitOrderAsyncAck | null;
  airaloOrder: AiraloOrder | null;
}): never {
  logOrderError("order.persistence.failed", {
    packageId: options.pkg.id,
    airaloRequestId:
      options.airaloAck?.request_id ?? options.airaloOrder?.order_reference ?? null,
    message: options.error instanceof Error ? options.error.message : "Unknown error",
  });

  recordOrderMetrics({
    result: "error",
    reason: "persistence_failed",
    durationMs: Date.now() - options.startedAt,
    airaloStatus:
      options.resolvedSubmissionMode === "async"
        ? "accepted"
        : (options.airaloOrder?.status ?? "completed"),
  });

  if (options.error instanceof OrderServiceError) {
    throw options.error;
  }

  if (options.error instanceof Prisma.PrismaClientKnownRequestError) {
    if (options.error.code === "P2002") {
      throw new OrderServiceError(
        "An order with this reference already exists.",
        409,
        options.error,
      );
    }

    throw new OrderServiceError("Failed to persist the order.", 500, options.error);
  }

  throw new OrderServiceError(
    "Unexpected error while creating the order.",
    500,
    options.error,
  );
}
