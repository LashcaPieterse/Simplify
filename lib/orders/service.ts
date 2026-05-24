import type { AiraloClient } from "../airalo/client";
import {
  findActivePackageByIdentifier,
  getPackagePrice,
  inspectPackageIdentifierLookup,
} from "../catalog/package-resolver";
import prismaClient from "../db/client";
import { logOrderError, logOrderInfo } from "../observability/logging";
import { recordOrderMetrics } from "../observability/metrics";
import {
  buildAiraloOrderPayload,
  logAiraloSubmissionSuccess,
  resolveAiraloClient,
  resolveRequiredAsyncWebhookUrl,
  submitAiraloOrder,
  type AiraloOrderPackage,
  type OrderSubmissionMode,
} from "./airalo-ordering";
import {
  OrderValidationError,
  handleAiraloOrderFailure,
} from "./errors";
import {
  buildCreateOrderInstallationResult,
} from "./installation";
import {
  autoDeactivatePackage,
  claimReservedOrderForSubmission,
  handlePersistenceError,
  markReservedOrderSubmissionFailed,
  persistOrderRecords,
  type CreateOrderResult,
  type PrismaDbClient,
} from "./persistence";
import {
  createOrderInputSchema,
  type CreateOrderInput,
  type ReservedOrderSnapshot,
} from "./validation";
import { normaliseQuantity } from "./quantity";

export { resolveAiraloClient } from "./airalo-ordering";
export {
  OrderOutOfStockError,
  OrderServiceError,
  OrderValidationError,
} from "./errors";
export {
  ensureOrderInstallation,
  getOrderWithDetails,
  type OrderWithDetails,
} from "./installation";
export type { CreateOrderResult, PrismaDbClient } from "./persistence";
export type { CreateOrderInput, ReservedOrderSnapshot } from "./validation";

export interface CreateOrderOptions {
  prisma?: PrismaDbClient;
  airaloClient?: AiraloClient;
  submissionMode?: OrderSubmissionMode;
  userId?: string;
  asyncWebhookUrl?: string | null;
  reservedOrder?: ReservedOrderSnapshot;
}

type ResolvedOrderPackage = {
  pkg: AiraloOrderPackage;
  quantity: number;
  totalCents: number;
  currency: string;
  customerEmail?: string | null;
};

async function resolveOrderPackage(
  input: CreateOrderInput,
  db: PrismaDbClient,
  startedAt: number,
  reservedOrder: ReservedOrderSnapshot | null,
): Promise<ResolvedOrderPackage> {
  const resolvedCustomerEmail = reservedOrder?.customerEmail ?? input.customerEmail;

  if (reservedOrder) {
    return {
      pkg: {
        id: reservedOrder.packageId,
        airaloPackageId: reservedOrder.airaloPackageId,
        title: reservedOrder.packageTitle,
      },
      quantity: reservedOrder.quantity,
      totalCents: reservedOrder.totalCents,
      currency: reservedOrder.currency,
      customerEmail: resolvedCustomerEmail,
    };
  }

  const resolvedPackage = await findActivePackageByIdentifier(db, input.packageId);
  if (!resolvedPackage) {
    const lookupDiagnostics = await inspectPackageIdentifierLookup(
      db,
      input.packageId,
    );
    console.info("order.package.lookup", {
      packageId: input.packageId,
      ...lookupDiagnostics,
    });
  }

  if (!resolvedPackage) {
    logOrderError("order.package.unavailable", {
      packageId: input.packageId,
    });

    recordOrderMetrics({
      result: "error",
      reason: "validation_failed",
      durationMs: Date.now() - startedAt,
      airaloStatus: "validation",
    });

    throw new OrderValidationError("Selected plan is no longer available.");
  }

  const packagePrice = getPackagePrice(resolvedPackage);

  if (!packagePrice) {
    logOrderError("order.package.missing_price", {
      packageId: resolvedPackage.id,
      packageExternalId: resolvedPackage.airaloPackageId,
    });

    recordOrderMetrics({
      result: "error",
      reason: "validation_failed",
      durationMs: Date.now() - startedAt,
      airaloStatus: "validation",
    });

    throw new OrderValidationError("Selected plan is no longer available.");
  }

  const quantity = normaliseQuantity(input.quantity);

  return {
    pkg: resolvedPackage,
    quantity,
    totalCents: packagePrice.sellingPriceCents * quantity,
    currency: packagePrice.currencyCode,
    customerEmail: resolvedCustomerEmail,
  };
}

export async function createOrder(
  rawInput: unknown,
  options: CreateOrderOptions = {},
): Promise<CreateOrderResult> {
  const startedAt = Date.now();
  const parsedInput = createOrderInputSchema.safeParse(rawInput);

  if (!parsedInput.success) {
    logOrderError("order.validation.failed", {
      issues: parsedInput.error.issues,
    });

    recordOrderMetrics({
      result: "error",
      reason: "validation_failed",
      durationMs: Date.now() - startedAt,
      airaloStatus: "validation",
    });

    throw new OrderValidationError(
      "Invalid order request.",
      parsedInput.error.issues,
    );
  }

  const db = options.prisma ?? prismaClient;
  const reservedOrder = options.reservedOrder ?? null;
  const submissionMode: OrderSubmissionMode =
    options.submissionMode === "sync" ? "sync" : "async";

  const reservedResult = reservedOrder
    ? await claimReservedOrderForSubmission(db, reservedOrder)
    : null;
  if (reservedResult) {
    return reservedResult;
  }

  const resolvedPackage = await resolveOrderPackage(
    parsedInput.data,
    db,
    startedAt,
    reservedOrder,
  );

  let asyncWebhookUrl: string | null = null;
  try {
    asyncWebhookUrl =
      submissionMode === "async" ? resolveRequiredAsyncWebhookUrl(options) : null;
  } catch (error) {
    await markReservedOrderSubmissionFailed(db, reservedOrder);
    throw error;
  }

  const orderPayload = buildAiraloOrderPayload({
    pkg: resolvedPackage.pkg,
    quantity: resolvedPackage.quantity,
    customerEmail: resolvedPackage.customerEmail,
    localOrderId: reservedOrder?.orderId ?? null,
  });

  let airalo: AiraloClient;
  try {
    airalo = options.airaloClient ?? resolveAiraloClient();
  } catch (error) {
    await markReservedOrderSubmissionFailed(db, reservedOrder);
    throw error;
  }

  const airaloCallStartedAt = Date.now();
  let airaloSubmission: Awaited<ReturnType<typeof submitAiraloOrder>>;
  try {
    airaloSubmission = await submitAiraloOrder({
      airalo,
      pkg: resolvedPackage.pkg,
      payload: orderPayload,
      submissionMode,
      asyncWebhookUrl,
    });
  } catch (error: unknown) {
    return handleAiraloOrderFailure({
      error,
      pkg: resolvedPackage.pkg,
      startedAt,
      airaloLatencyMs: Date.now() - airaloCallStartedAt,
      beforeMapping: () =>
        markReservedOrderSubmissionFailed(db, reservedOrder),
      autoDeactivatePackage: (deactivation) =>
        autoDeactivatePackage(resolvedPackage.pkg, {
          ...deactivation,
          prisma: db,
        }),
    });
  }

  logAiraloSubmissionSuccess({
    pkg: resolvedPackage.pkg,
    submission: airaloSubmission,
  });

  try {
    const result = await persistOrderRecords(db, {
      userId: options.userId ?? null,
      reservedOrder,
      pkg: resolvedPackage.pkg,
      customerEmail: resolvedPackage.customerEmail,
      quantity: resolvedPackage.quantity,
      totalCents: resolvedPackage.totalCents,
      currency: resolvedPackage.currency,
      airaloAsyncResponse: airaloSubmission.airaloAsyncResponse,
      airaloOrderResponse: airaloSubmission.airaloOrderResponse,
      airaloAck: airaloSubmission.airaloAck,
      airaloOrder: airaloSubmission.airaloOrder,
    });

    const totalDuration = Date.now() - startedAt;

    logOrderInfo("order.create.completed", {
      orderId: result.id,
      orderNumber: result.orderNumber ?? null,
      packageId: resolvedPackage.pkg.id,
      airaloRequestId:
        airaloSubmission.airaloAck?.request_id ??
        airaloSubmission.airaloOrder?.order_reference ??
        null,
      airaloAcceptedAt: airaloSubmission.airaloAck?.accepted_at ?? null,
      submissionMode: airaloSubmission.resolvedSubmissionMode,
      airaloLatencyMs: airaloSubmission.airaloLatencyMs,
      totalDurationMs: totalDuration,
    });

    recordOrderMetrics({
      result: "success",
      reason: "ok",
      durationMs: totalDuration,
      airaloStatus:
        airaloSubmission.resolvedSubmissionMode === "async"
          ? "accepted"
          : (airaloSubmission.airaloOrder?.status ?? "completed"),
    });

    return {
      orderId: result.id,
      orderNumber: result.orderNumber ?? null,
      requestId: result.requestId ?? result.orderNumber ?? null,
      installation: buildCreateOrderInstallationResult(
        airaloSubmission.airaloOrder,
      ),
    };
  } catch (error: unknown) {
    return handlePersistenceError({
      error,
      pkg: resolvedPackage.pkg,
      startedAt,
      resolvedSubmissionMode: airaloSubmission.resolvedSubmissionMode,
      airaloAck: airaloSubmission.airaloAck,
      airaloOrder: airaloSubmission.airaloOrder,
    });
  }
}
