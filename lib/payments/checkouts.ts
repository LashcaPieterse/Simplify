import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  findActivePackageByIdentifier,
  findPackageDisplayByIdentifier,
  getPackagePrice,
  isUuid,
} from "../catalog/package-resolver";
import prismaClient from "../db/client";
import { centsToMajorUnits } from "../format";
import { sendOrderReceipt } from "../notifications/receipts";
import { logOrderError, logOrderInfo } from "../observability/logging";
import { DEFAULT_QUANTITY, MAX_QUANTITY, normaliseQuantity } from "../orders/quantity";
import {
  buildAiraloTopUpOrderPayload,
  logAiraloTopUpSubmissionSuccess,
  resolveAiraloClient,
  submitAiraloTopUpOrder,
} from "../orders/airalo-ordering";
import { handleAiraloOrderFailure } from "../orders/errors";
import {
  autoDeactivatePackage,
  handlePersistenceError,
  markReservedOrderSubmissionFailed,
  persistOrderRecords,
} from "../orders/persistence";
import { createOrder } from "../orders/service";
import type {
  CreateOrderOptions,
  CreateOrderResult,
  ReservedOrderSnapshot,
} from "../orders/service";
import { appendStatusHistory, createStatusHistory, serialise } from "./status-history";
import { resolveDpoClient } from "./dpo";

const checkoutInputSchema = z.object({
  packageId: z.string().min(1, "A package selection is required."),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number." })
    .int("Quantity must be an integer.")
    .positive("Quantity must be at least 1.")
    .max(MAX_QUANTITY, `You can order up to ${MAX_QUANTITY} eSIMs per checkout.`)
    .default(DEFAULT_QUANTITY)
    .optional(),
  customerEmail: z.string().email("Enter a valid email address.").optional(),
  intent: z.enum(["purchase", "top-up"]).default("purchase").optional(),
  topUpForOrderId: z.string().min(1).optional(),
  topUpForIccid: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateCheckoutInput = z.infer<typeof checkoutInputSchema>;

export type CheckoutSummary = {
  id: string;
  packageId: string;
  packageName: string;
  packageDescription?: string | null;
  quantity: number;
  totalCents: number;
  currency: string;
  status: string;
  intent: string;
  paymentStatus?: string;
  paymentUrl?: string;
  orderId?: string | null;
  redirectOrderId?: string | null;
};

export type CreateCheckoutResult = {
  checkoutId: string;
  paymentUrl: string;
};

const STATUS_PENDING = "pending";
const STATUS_PAID = "paid";
const STATUS_FAILED = "failed";
const STATUS_APPROVED = "approved";
const STATUS_FINALIZING = "finalizing";
const PROVIDER = "dpo";
const RESERVED_ORDER_FAILED_STATUS = "airalo_failed";

async function resolveCheckoutUserId(
  db: PrismaClient,
  userId?: string,
): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (user) {
    return user.id;
  }

  logOrderInfo("payments.checkout.user_not_found", {
    userId,
    action: "fallback_to_guest_checkout",
  });

  return null;
}

export async function createCheckout(
  rawInput: CreateCheckoutInput,
  options: { prisma?: PrismaClient; baseUrl: string; userId?: string },
): Promise<CreateCheckoutResult> {
  const parsed = checkoutInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid checkout details.";
    throw new Error(message);
  }

  const input = parsed.data;
  const db = options.prisma ?? prismaClient;
  const quantity = normaliseQuantity(input.quantity);
  const packageIdIsUuid = isUuid(input.packageId);
  const checkoutUserId = await resolveCheckoutUserId(db, options.userId);

  if (input.intent === "top-up") {
    if (quantity !== 1) {
      throw new Error("Top-up checkouts must have a quantity of 1.");
    }

    if (!input.topUpForOrderId || !input.topUpForIccid) {
      throw new Error("Top-up checkouts require an original order and ICCID.");
    }
  }

  logOrderInfo("payments.checkout.package_lookup", {
    requestedPackageId: input.packageId,
    packageIdIsUuid,
    userId: options.userId ?? null,
  });

  // Accept either the Prisma package id or the external id from catalog/Sanity.
  const pkg = await findActivePackageByIdentifier(db, input.packageId);

  if (!pkg) {
    logOrderError("payments.checkout.package_not_found", {
      requestedPackageId: input.packageId,
      packageIdIsUuid,
      userId: options.userId ?? null,
    });
    throw new Error("Selected package is unavailable.");
  }

  const packagePrice = getPackagePrice(pkg);

  if (!packagePrice) {
    logOrderError("payments.checkout.package_missing_price", {
      requestedPackageId: input.packageId,
      matchedPackageId: pkg.id,
      matchedExternalId: pkg.airaloPackageId,
      userId: options.userId ?? null,
    });
    throw new Error("Selected package is unavailable.");
  }

  logOrderInfo("payments.checkout.package_resolved", {
    requestedPackageId: input.packageId,
    matchedPackageId: pkg.id,
    matchedExternalId: pkg.airaloPackageId,
  });

  const priceCents = packagePrice.sellingPriceCents;
  const totalCents = priceCents * quantity;

  const checkout = await db.checkoutSession.create({
    data: {
      userId: checkoutUserId,
      packageId: pkg.id,
      customerEmail: input.customerEmail ?? null,
      quantity,
      totalCents,
      currency: packagePrice.currencyCode,
      status: STATUS_PENDING,
      intent: input.intent ?? "purchase",
      topUpForOrderId: input.topUpForOrderId ?? null,
      topUpForIccid: input.topUpForIccid ?? null,
      metadata: input.metadata ? serialise(input.metadata) : null,
    },
  });

  const successUrl = `${options.baseUrl}/checkout/${checkout.id}/return`;
  const cancelUrl = `${options.baseUrl}/checkout/${checkout.id}`;
  // No IPN/webhook flow; use the return URL for callback and verify on return.
  const callbackUrl = successUrl;

  const dpoClient = resolveDpoClient();
  const amount = centsToMajorUnits(totalCents);

  logOrderInfo("payments.checkout.create", {
    checkoutId: checkout.id,
    packageId: checkout.packageId,
    amount,
    currency: checkout.currency,
  });

  let response: Awaited<ReturnType<typeof dpoClient.createTransaction>>;

  try {
    response = await dpoClient.createTransaction({
      amount,
      currency: checkout.currency,
      customerEmail: checkout.customerEmail ?? undefined,
      redirectUrl: successUrl,
      cancelUrl,
      callbackUrl,
      reference: checkout.id,
      description: input.intent ?? "purchase",
      metadata: input.metadata,
    });
  } catch (error) {
    logOrderError("payments.checkout.dpo_error", {
      checkoutId: checkout.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await db.checkoutSession.update({
      where: { id: checkout.id },
      data: { status: STATUS_FAILED },
    });

    throw error;
  }

  const transaction = await db.paymentTransaction.create({
    data: {
      user: checkoutUserId ? { connect: { id: checkoutUserId } } : undefined,
      provider: PROVIDER,
      providerReference: response.reference ?? null,
      transactionToken: response.token,
      redirectUrl: response.redirectUrl,
      status: STATUS_PENDING,
      amountCents: totalCents,
      currency: checkout.currency,
      metadata: response.rawResponse ? serialise(response.rawResponse) : null,
      statusHistory: createStatusHistory({
        status: STATUS_PENDING,
        at: new Date().toISOString(),
        source: "checkout",
      }),
      checkout: {
        connect: { id: checkout.id },
      },
    },
  });

  await db.paymentTransactionEvent.create({
    data: {
      transactionId: transaction.id,
      eventType: "create-response",
      payload: serialise(response.rawResponse),
    },
  });

  return {
    checkoutId: checkout.id,
    paymentUrl: response.redirectUrl,
  };
}

export async function getCheckoutSummary(
  checkoutId: string,
  options: { prisma?: PrismaClient } = {},
): Promise<CheckoutSummary | null> {
  const db = options.prisma ?? prismaClient;

  const checkout = await db.checkoutSession.findUnique({
    where: { id: checkoutId },
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!checkout) {
    return null;
  }

  const latestPayment = checkout.payments[0];
  const pkg = await findPackageDisplayByIdentifier(db, checkout.packageId);

  return {
    id: checkout.id,
    packageId: checkout.packageId,
    packageName: pkg?.title ?? "Package",
    packageDescription: pkg?.shortInfo ?? null,
    quantity: checkout.quantity,
    totalCents: checkout.totalCents,
    currency: checkout.currency,
    status: checkout.status,
    intent: checkout.intent,
    paymentStatus: latestPayment?.status ?? undefined,
    paymentUrl: latestPayment?.redirectUrl ?? undefined,
    orderId: checkout.orderId,
    redirectOrderId:
      checkout.intent === "top-up" ? checkout.topUpForOrderId : checkout.orderId,
  };
}

type FinaliseOptions = {
  prisma?: PrismaClient;
  airaloOptions?: CreateOrderOptions;
  forceStatus?: string;
};

async function markCheckoutStatus(
  checkoutId: string,
  status: string,
  options: { prisma?: PrismaClient } = {},
): Promise<void> {
  const db = options.prisma ?? prismaClient;
  await db.checkoutSession.update({
    where: { id: checkoutId },
    data: { status },
  });
}

export async function verifyCheckoutPayment(
  checkoutId: string,
  options: { prisma?: PrismaClient } = {},
): Promise<{
  paymentStatus: string;
  orderId?: string | null;
  redirectOrderId?: string | null;
  message?: string;
}> {
  const db = options.prisma ?? prismaClient;

  const checkout = await db.checkoutSession.findUnique({
    where: { id: checkoutId },
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!checkout) {
    throw new Error("Checkout not found.");
  }

  const payment = checkout.payments[0];

  if (!payment?.transactionToken) {
    throw new Error("Checkout has no associated payment token.");
  }

  if (payment.status === STATUS_APPROVED) {
    try {
      const order = await finaliseOrderFromCheckout(checkout.id, {
        prisma: db,
        forceStatus: STATUS_APPROVED,
      });
      return {
        paymentStatus: payment.status,
        orderId: order.orderId,
        redirectOrderId: order.redirectOrderId ?? order.orderId,
      };
    } catch (error) {
      logOrderError("payments.checkout.finalize_failed", {
        checkoutId: checkout.id,
        paymentId: payment.id,
        error: error instanceof Error ? error.message : String(error),
      });
      const message =
        error instanceof Error ? error.message : "Failed to create order.";
      return {
        paymentStatus: payment.status,
        orderId: checkout.orderId ?? null,
        redirectOrderId:
          checkout.intent === "top-up" ? checkout.topUpForOrderId : checkout.orderId,
        message,
      };
    }
  }

  const dpoClient = resolveDpoClient();
  let verification;
  try {
    verification = await dpoClient.verifyTransaction(payment.transactionToken, payment.providerReference ?? undefined);
    // Log key verification fields to help debug DPO responses in non-IPN flow.
    console.info("dpo.verifyTransaction", {
      checkoutId,
      transactionToken: payment.transactionToken,
      resultCode: verification.resultCode ?? verification.status,
      resultExplanation: verification.resultExplanation,
      status: verification.status,
      raw: verification.rawResponse,
    });
  } catch (error) {
    console.error("dpo.verifyTransaction failed", {
      checkoutId,
      transactionToken: payment.transactionToken,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      paymentStatus: payment.status ?? STATUS_PENDING,
      orderId: checkout.orderId ?? null,
      redirectOrderId:
        checkout.intent === "top-up" ? checkout.topUpForOrderId : checkout.orderId,
      message: "Verification failed.",
    };
  }
  const resultCode = verification.resultCode ?? verification.status;
  const isPaid = resultCode === "000";
  const normalizedStatus =
    (isPaid ? STATUS_APPROVED : verification.status?.toLowerCase?.()) ??
    verification.status ??
    STATUS_PENDING;
  const verificationMessage = !isPaid && verification.resultExplanation ? verification.resultExplanation : undefined;

  const updated = await db.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      status: normalizedStatus,
      providerReference: payment.providerReference,
      statusHistory: appendStatusHistory(payment.statusHistory, {
        status: normalizedStatus,
        at: new Date().toISOString(),
        source: "verify",
      }),
    },
  });

  await db.paymentTransactionEvent.create({
    data: {
      transactionId: payment.id,
      eventType: "verification-response",
      payload: serialise(verification.rawResponse),
    },
  });

  let orderId = checkout.orderId ?? null;
  let redirectOrderId =
    checkout.intent === "top-up" ? checkout.topUpForOrderId : checkout.orderId;

  if (isPaid || normalizedStatus === STATUS_APPROVED) {
    await markCheckoutStatus(checkout.id, STATUS_PAID, { prisma: db });

    try {
      const order = await finaliseOrderFromCheckout(checkout.id, {
        prisma: db,
        forceStatus: normalizedStatus,
      });
      orderId = order.orderId;
      redirectOrderId = order.redirectOrderId ?? order.orderId;
    } catch (error) {
      logOrderError("payments.checkout.finalize_failed", {
        checkoutId: checkout.id,
        paymentId: payment.id,
        error: error instanceof Error ? error.message : String(error),
      });
      const message =
        error instanceof Error ? error.message : "Failed to create order.";
      return {
        paymentStatus: updated.status,
        orderId: checkout.orderId ?? null,
        redirectOrderId,
        message,
      };
    }
  } else if (normalizedStatus === STATUS_FAILED) {
    await markCheckoutStatus(checkout.id, STATUS_FAILED, { prisma: db });
  }

  return { paymentStatus: updated.status, orderId, redirectOrderId, message: verificationMessage };
}

type FinaliseCheckoutRecord = Prisma.CheckoutSessionGetPayload<{
  include: {
    package: true;
    payments: true;
  };
}>;

type CheckoutOrderRecord = {
  id: string;
  orderNumber?: string | null;
  requestId?: string | null;
  status?: string | null;
};

function toCreateOrderResult(
  order: CheckoutOrderRecord,
  options: { redirectOrderId?: string | null } = {},
): CreateOrderResult {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber ?? null,
    requestId: order.requestId ?? order.orderNumber ?? order.id,
    redirectOrderId: options.redirectOrderId ?? null,
  };
}

function shouldRetryReservedOrder(order: CheckoutOrderRecord): boolean {
  return (
    !order.orderNumber &&
    !order.requestId &&
    order.status === RESERVED_ORDER_FAILED_STATUS
  );
}

function buildReservedOrderSnapshot(
  checkout: FinaliseCheckoutRecord,
  orderId: string,
): ReservedOrderSnapshot {
  return {
    orderId,
    packageId: checkout.packageId,
    airaloPackageId: checkout.package.airaloPackageId,
    packageTitle: checkout.package.title,
    quantity: checkout.quantity,
    totalCents: checkout.totalCents,
    currency: checkout.currency,
    customerEmail: checkout.customerEmail,
  };
}

type TopUpCheckoutContext = {
  originalOrderId: string;
  iccid: string;
};

async function resolveTopUpCheckoutContext(
  db: PrismaClient,
  checkout: FinaliseCheckoutRecord,
): Promise<TopUpCheckoutContext | null> {
  if (checkout.intent !== "top-up") {
    return null;
  }

  if (checkout.quantity !== 1) {
    throw new Error("Top-up checkouts must have a quantity of 1.");
  }

  if (!checkout.topUpForOrderId || !checkout.topUpForIccid) {
    throw new Error("Top-up checkout is missing its original order or ICCID.");
  }

  const profile = await db.esimProfile.findFirst({
    where: {
      orderId: checkout.topUpForOrderId,
      iccid: checkout.topUpForIccid,
    },
    select: { id: true },
  });

  if (!profile) {
    throw new Error("Top-up ICCID does not belong to the original order.");
  }

  return {
    originalOrderId: checkout.topUpForOrderId,
    iccid: checkout.topUpForIccid,
  };
}

async function reserveCheckoutOrder(
  db: PrismaClient,
  checkout: FinaliseCheckoutRecord,
  payment: FinaliseCheckoutRecord["payments"][number],
): Promise<{ orderId: string; existing: boolean }> {
  return db.$transaction(async (tx) => {
    const lockResult = await tx.checkoutSession.updateMany({
      where: {
        id: checkout.id,
        orderId: null,
      },
      data: {
        status: STATUS_FINALIZING,
      },
    });

    if (lockResult.count === 0) {
      const lockedCheckout = await tx.checkoutSession.findUnique({
        where: { id: checkout.id },
        select: { orderId: true },
      });

      if (lockedCheckout?.orderId) {
        return { orderId: lockedCheckout.orderId, existing: true };
      }

      throw new Error("Checkout finalization is already in progress.");
    }

    const reservedOrder = await tx.esimOrder.create({
      data: {
        userId: checkout.userId,
        packageId: checkout.packageId,
        status: STATUS_PENDING,
        customerEmail: checkout.customerEmail,
        quantity: checkout.quantity,
        totalCents: checkout.totalCents,
        currency: checkout.currency,
        paymentTransactionId: payment.id,
      },
    });

    await tx.checkoutSession.update({
      where: { id: checkout.id },
      data: {
        orderId: reservedOrder.id,
        status: STATUS_FINALIZING,
      },
    });

    return { orderId: reservedOrder.id, existing: false };
  });
}

async function finaliseTopUpOrderFromCheckout(options: {
  db: PrismaClient;
  checkout: FinaliseCheckoutRecord;
  payment: FinaliseCheckoutRecord["payments"][number];
  reservation: { orderId: string };
  topUp: TopUpCheckoutContext;
  airaloOptions?: CreateOrderOptions;
  startedAt: number;
}): Promise<CreateOrderResult> {
  const reservedOrder = buildReservedOrderSnapshot(
    options.checkout,
    options.reservation.orderId,
  );
  const pkg = {
    id: reservedOrder.packageId,
    airaloPackageId: reservedOrder.airaloPackageId,
    title: reservedOrder.packageTitle,
  };

  let airalo: NonNullable<CreateOrderOptions["airaloClient"]>;
  try {
    airalo = options.airaloOptions?.airaloClient ?? resolveAiraloClient();
  } catch (error) {
    await markReservedOrderSubmissionFailed(options.db, reservedOrder);
    throw error;
  }

  const payload = buildAiraloTopUpOrderPayload({
    pkg,
    iccid: options.topUp.iccid,
  });

  const airaloCallStartedAt = Date.now();
  let submission: Awaited<ReturnType<typeof submitAiraloTopUpOrder>>;
  try {
    submission = await submitAiraloTopUpOrder({ airalo, payload });
  } catch (error: unknown) {
    return handleAiraloOrderFailure({
      error,
      pkg,
      startedAt: options.startedAt,
      airaloLatencyMs: Date.now() - airaloCallStartedAt,
      beforeMapping: () =>
        markReservedOrderSubmissionFailed(options.db, reservedOrder),
      autoDeactivatePackage: (deactivation) =>
        autoDeactivatePackage(pkg, {
          ...deactivation,
          prisma: options.db,
        }),
    });
  }

  logAiraloTopUpSubmissionSuccess({
    pkg,
    iccid: options.topUp.iccid,
    submission,
  });

  try {
    const orderRecord = await persistOrderRecords(options.db, {
      userId: options.checkout.userId ?? null,
      reservedOrder,
      pkg,
      customerEmail: options.checkout.customerEmail,
      quantity: 1,
      totalCents: options.checkout.totalCents,
      currency: options.checkout.currency,
      airaloAsyncResponse: null,
      airaloOrderResponse: submission.airaloOrderResponse,
      airaloAck: null,
      airaloOrder: submission.airaloOrder,
      airaloOrderSnapshotSource: "orders-topups",
      persistSimProfile: false,
      persistInstallation: false,
      statusFallback: "completed",
    });

    return {
      orderId: orderRecord.id,
      orderNumber: orderRecord.orderNumber,
      requestId: orderRecord.requestId ?? orderRecord.orderNumber,
      redirectOrderId: options.topUp.originalOrderId,
    };
  } catch (error: unknown) {
    return handlePersistenceError({
      error,
      pkg,
      startedAt: options.startedAt,
      resolvedSubmissionMode: "sync",
      airaloAck: null,
      airaloOrder: submission.airaloOrder,
    });
  }
}

async function markCheckoutFinalized({
  db,
  checkout,
  payment,
  order,
}: {
  db: PrismaClient;
  checkout: FinaliseCheckoutRecord;
  payment: FinaliseCheckoutRecord["payments"][number];
  order: CreateOrderResult;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const currentPayment = await tx.paymentTransaction.findUnique({
      where: { id: payment.id },
      select: { statusHistory: true },
    });

    await tx.checkoutSession.update({
      where: { id: checkout.id },
      data: {
        orderId: order.orderId,
        status: STATUS_PAID,
      },
    });

    await tx.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: STATUS_APPROVED,
        statusHistory: appendStatusHistory(
          currentPayment?.statusHistory ?? payment.statusHistory,
          {
            status: STATUS_APPROVED,
            at: new Date().toISOString(),
            source: "finalize",
          },
        ),
      },
    });

    await tx.esimOrder.update({
      where: { id: order.orderId },
      data: {
        paymentTransactionId: payment.id,
      },
    });
  });
}

export async function finaliseOrderFromCheckout(
  checkoutId: string,
  options: FinaliseOptions = {},
): Promise<CreateOrderResult> {
  const startedAt = Date.now();
  const db = options.prisma ?? prismaClient;
  const checkout = await db.checkoutSession.findUnique({
    where: { id: checkoutId },
    include: {
      package: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!checkout) {
    throw new Error("Checkout not found.");
  }

  const payment = checkout.payments[0];

  if (!payment) {
    throw new Error("Checkout has no payment record.");
  }

  const status = options.forceStatus ?? payment.status ?? STATUS_PENDING;
  const isApproved = status.toLowerCase() === STATUS_APPROVED || status.toLowerCase() === STATUS_PAID;

  if (!isApproved) {
    throw new Error("Payment has not been approved.");
  }

  const topUpContext = await resolveTopUpCheckoutContext(db, checkout);
  let reservation: { orderId: string; existing: boolean };

  try {
    reservation = checkout.orderId
      ? { orderId: checkout.orderId, existing: true }
      : await reserveCheckoutOrder(db, checkout, payment);

    if (reservation.existing) {
      const existingOrder = await db.esimOrder.findUnique({
        where: { id: reservation.orderId },
      });

      if (!existingOrder) {
        throw new Error("Checkout references a missing order.");
      }

      if (!shouldRetryReservedOrder(existingOrder)) {
        const result = toCreateOrderResult(existingOrder, {
          redirectOrderId: topUpContext?.originalOrderId ?? null,
        });
        if (checkout.status !== STATUS_PAID || payment.status !== STATUS_APPROVED) {
          await markCheckoutFinalized({
            db,
            checkout,
            payment,
            order: result,
          });
        }
        sendOrderReceipt(result.orderId, {
          prisma: options.prisma ?? prismaClient,
        }).catch((error) => {
          logOrderError("payments.receipt.send_failed", {
            orderId: result.orderId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        return result;
      }
    }

    const order = topUpContext
      ? await finaliseTopUpOrderFromCheckout({
          db,
          checkout,
          payment,
          reservation,
          topUp: topUpContext,
          airaloOptions: options.airaloOptions,
          startedAt,
        })
      : await createOrder(
          {
            packageId: checkout.packageId,
            quantity: checkout.quantity,
            customerEmail: checkout.customerEmail ?? undefined,
          },
          {
            ...options.airaloOptions,
            prisma: db,
            // Prefer async submission so paid checkouts get an order record immediately
            // even when synchronous Airalo fulfillment is slow or intermittently unavailable.
            submissionMode: options.airaloOptions?.submissionMode ?? "async",
            userId: checkout.userId ?? undefined,
            reservedOrder: buildReservedOrderSnapshot(checkout, reservation.orderId),
          },
        );

    await markCheckoutFinalized({
      db,
      checkout,
      payment,
      order,
    });

    logOrderInfo("payments.checkout.finalized", {
      checkoutId,
      orderId: order.orderId,
      paymentId: payment.id,
    });

    sendOrderReceipt(order.orderId, { prisma: options.prisma ?? prismaClient }).catch((error) => {
      logOrderError("payments.receipt.send_failed", {
        orderId: order.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return order;
  } catch (error) {
    await db.checkoutSession.updateMany({
      where: { id: checkout.id },
      data: { status: STATUS_PAID },
    });

    throw error;
  }
}

export async function recordPaymentEvent(
  transactionId: string,
  eventType: string,
  payload: unknown,
  options: { prisma?: PrismaClient } = {},
): Promise<void> {
  const db = options.prisma ?? prismaClient;

  await db.paymentTransactionEvent.create({
    data: {
      transactionId,
      eventType,
      payload: serialise(payload),
    },
  });
}

export async function updatePaymentStatus(
  transactionId: string,
  status: string,
  options: { prisma?: PrismaClient; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  const db = options.prisma ?? prismaClient;

  const payment = await db.paymentTransaction.findUnique({
    where: { id: transactionId },
  });

  if (!payment) {
    throw new Error("Payment transaction not found.");
  }

  const normalizedStatus = status?.toLowerCase?.() ?? status;

  await db.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      status: normalizedStatus,
      metadata: options.metadata ? serialise(options.metadata) : payment.metadata,
      statusHistory: appendStatusHistory(payment.statusHistory, {
        status: normalizedStatus,
        at: new Date().toISOString(),
        source: "verify",
      }),
    },
  });
}

export async function setCheckoutStatus(
  checkoutId: string,
  status: string,
  options: { prisma?: PrismaClient } = {},
): Promise<void> {
  await markCheckoutStatus(checkoutId, status, options);
}

export async function fetchCheckoutWithPayment(
  checkoutId: string,
  options: { prisma?: PrismaClient } = {},
): Promise<Prisma.CheckoutSessionGetPayload<{ include: { payments: true } }> | null> {
  const db = options.prisma ?? prismaClient;
  return db.checkoutSession.findUnique({
    where: { id: checkoutId },
    include: { payments: true },
  });
}
