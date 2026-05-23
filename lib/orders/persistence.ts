import { Prisma, type PrismaClient } from "@prisma/client";

import type {
  SubmitOrderAsyncAck,
} from "../airalo/client";
import type {
  Order as AiraloOrder,
  OrderResponse,
  SubmitOrderAsyncResponse,
} from "../airalo/schemas";
import prismaClient from "../db/client";
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

export type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export type CreateOrderResult = {
  orderId: string;
  orderNumber: string | null;
  requestId: string | null;
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

const RESERVED_ORDER_SUBMITTING_STATUS = "airalo_submitting";
const RESERVED_ORDER_FAILED_STATUS = "airalo_failed";
const RESERVED_ORDER_CLAIMABLE_STATUSES = [
  "pending",
  RESERVED_ORDER_FAILED_STATUS,
];

export function isPrismaClient(client: PrismaDbClient): client is PrismaClient {
  return typeof (client as PrismaClient).$transaction === "function";
}

export function toPrismaJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function createResultFromExistingOrder(order: {
  id: string;
  orderNumber?: string | null;
  requestId?: string | null;
}): CreateOrderResult {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber ?? null,
    requestId: order.requestId ?? order.orderNumber ?? order.id,
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

  const claim = await db.esimOrder.updateMany({
    where: {
      id: snapshot.orderId,
      orderNumber: null,
      requestId: null,
      status: { in: RESERVED_ORDER_CLAIMABLE_STATUSES },
    },
    data: {
      status: RESERVED_ORDER_SUBMITTING_STATUS,
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

  return createResultFromExistingOrder(current);
}

export async function markReservedOrderSubmissionFailed(
  db: PrismaDbClient,
  snapshot: ReservedOrderSnapshot | null,
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
        status: RESERVED_ORDER_SUBMITTING_STATUS,
      },
      data: {
        status: RESERVED_ORDER_FAILED_STATUS,
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
  },
): Promise<PersistedOrderRecord> {
  const createOrderRecords = async (tx: Prisma.TransactionClient) => {
    const syncOrderNumber = resolveAiraloOrderId(input.airaloOrder);
    const syncRequestId =
      input.airaloOrder?.order_reference ?? syncOrderNumber;

    const orderData = {
      userId: input.userId ?? null,
      orderNumber: syncOrderNumber,
      requestId: input.airaloAck?.request_id ?? syncRequestId,
      packageId: input.pkg.id,
      status: resolveAiraloStatus(input.airaloOrder),
      customerEmail: input.customerEmail ?? null,
      quantity: input.quantity,
      totalCents: input.totalCents,
      currency: input.currency,
    };

    const orderRecord = input.reservedOrder
      ? await tx.esimOrder.update({
          where: { id: input.reservedOrder.orderId },
          data: orderData,
        })
      : await tx.esimOrder.create({
          data: orderData,
        });

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
          source: "orders",
          requestId: syncRequestId,
          orderNumber: syncOrderNumber,
          rawPayloadJson: toPrismaJson(input.airaloOrderResponse),
        },
      });
    }

    if (input.airaloOrder) {
      const iccid = resolveAiraloIccid(input.airaloOrder);
      if (iccid) {
        await tx.esimProfile.upsert({
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
            orderId: orderRecord.id,
          },
        });
      }

      const installationPayload = createInstallationPayload(input.airaloOrder);
      await tx.esimInstallationPayload.upsert({
        where: { orderId: orderRecord.id },
        create: { orderId: orderRecord.id, payload: installationPayload },
        update: { payload: installationPayload },
      });
    }

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
