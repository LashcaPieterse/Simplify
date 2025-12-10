import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import prismaClient from "../db/client";
import { logOrderError, logOrderInfo } from "../observability/logging";
import { createOrder } from "../orders/service";
import type { CreateOrderOptions, CreateOrderResult } from "../orders/service";
import { resolveDpoClient } from "./dpo";

const checkoutInputSchema = z.object({
  packageId: z.string().min(1, "A package selection is required."),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number." })
    .int("Quantity must be an integer.")
    .positive("Quantity must be at least 1.")
    .max(10, "You can order up to 10 eSIMs per checkout.")
    .default(1)
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
};

export type CreateCheckoutResult = {
  checkoutId: string;
  paymentUrl: string;
};

const STATUS_PENDING = "pending";
const STATUS_PAID = "paid";
const STATUS_FAILED = "failed";
const STATUS_APPROVED = "approved";
const PROVIDER = "dpo";

function normaliseQuantity(quantity?: number): number {
  if (typeof quantity !== "number" || Number.isNaN(quantity)) {
    return 1;
  }

  return Math.min(Math.max(quantity, 1), 10);
}

function centsToMajorUnits(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function serialise(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    return JSON.stringify({ error: String(error) });
  }
}

export async function createCheckout(
  rawInput: CreateCheckoutInput,
  options: { prisma?: PrismaClient; baseUrl: string },
): Promise<CreateCheckoutResult> {
  const parsed = checkoutInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid checkout details.";
    throw new Error(message);
  }

  const input = parsed.data;
  const db = options.prisma ?? prismaClient;
  const quantity = normaliseQuantity(input.quantity);

  // Accept either the Prisma package id or the externalId from catalog/Sanity.
  const airaloPackage = await db.airaloPackage.findFirst({
    where: {
      OR: [{ id: input.packageId }, { externalId: input.packageId }],
    },
  });

  if (!airaloPackage || !airaloPackage.isActive) {
    throw new Error("Selected package is unavailable.");
  }

  const totalCents = airaloPackage.priceCents * quantity;

  const checkout = await db.checkoutSession.create({
    data: {
      packageId: airaloPackage.id,
      customerEmail: input.customerEmail ?? null,
      quantity,
      totalCents,
      currency: airaloPackage.currency,
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
      provider: PROVIDER,
      providerReference: response.reference ?? null,
      transactionToken: response.token,
      redirectUrl: response.redirectUrl,
      status: STATUS_PENDING,
      amountCents: totalCents,
      currency: checkout.currency,
      metadata: response.rawResponse ? serialise(response.rawResponse) : null,
      statusHistory: serialise([
        { status: STATUS_PENDING, at: new Date().toISOString(), source: "checkout" },
      ]),
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
      package: true,
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

  return {
    id: checkout.id,
    packageId: checkout.packageId,
    packageName: checkout.package.name,
    packageDescription: checkout.package.description,
    quantity: checkout.quantity,
    totalCents: checkout.totalCents,
    currency: checkout.currency,
    status: checkout.status,
    intent: checkout.intent,
    paymentStatus: latestPayment?.status ?? undefined,
    paymentUrl: latestPayment?.redirectUrl ?? undefined,
    orderId: checkout.orderId,
  };
}

type FinaliseOptions = {
  prisma?: PrismaClient;
  airaloOptions?: CreateOrderOptions;
  forceStatus?: string;
};

function appendStatusHistory(history: string | null, event: unknown): string {
  let items: unknown[] = [];

  if (history) {
    try {
      const parsed = JSON.parse(history);
      if (Array.isArray(parsed)) {
        items = parsed;
      }
    } catch {
      items = [history];
    }
  }

  items.push(event);
  return JSON.stringify(items);
}

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
): Promise<{ paymentStatus: string; orderId?: string | null; message?: string }> {
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

  if (payment.status === STATUS_APPROVED && checkout.orderId) {
    return { paymentStatus: payment.status, orderId: checkout.orderId };
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
    return { paymentStatus: payment.status ?? STATUS_PENDING, orderId: checkout.orderId ?? null, message: "Verification failed." };
  }
  const resultCode = verification.resultCode ?? verification.status;
  const isPaid = resultCode === "000";
  const normalizedStatus =
    (isPaid ? STATUS_APPROVED : verification.status?.toLowerCase?.()) ??
    verification.status ??
    STATUS_PENDING;

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

  if (isPaid || normalizedStatus === STATUS_APPROVED) {
    await markCheckoutStatus(checkout.id, STATUS_PAID, { prisma: db });

    if (!orderId) {
      try {
        const order = await finaliseOrderFromCheckout(checkout.id, {
          prisma: db,
          forceStatus: normalizedStatus,
        });
        orderId = order.orderId;
      } catch (error) {
        logOrderError("payments.checkout.finalize_failed", {
          checkoutId: checkout.id,
          paymentId: payment.id,
          error: error instanceof Error ? error.message : String(error),
        });
        const message = error instanceof Error ? error.message : "Failed to create order.";
        return { paymentStatus: updated.status, orderId: null, message };
      }
    }
  } else if (normalizedStatus === STATUS_FAILED) {
    await markCheckoutStatus(checkout.id, STATUS_FAILED, { prisma: db });
  }

  return { paymentStatus: updated.status, orderId };
}

export async function finaliseOrderFromCheckout(
  checkoutId: string,
  options: FinaliseOptions = {},
): Promise<CreateOrderResult> {
  const db = options.prisma ?? prismaClient;

  return db.$transaction(async (tx) => {
    const checkout = await tx.checkoutSession.findUnique({
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

    if (checkout.orderId) {
      const existingOrder = await tx.esimOrder.findUnique({
        where: { id: checkout.orderId },
      });

      if (!existingOrder) {
        throw new Error("Checkout references a missing order.");
      }

      return {
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber ?? null,
        requestId: existingOrder.requestId ?? existingOrder.orderNumber ?? existingOrder.id,
      };
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

    const order = await createOrder(
      {
        packageId: checkout.packageId,
        quantity: checkout.quantity,
        customerEmail: checkout.customerEmail ?? undefined,
      },
      {
        ...options.airaloOptions,
        prisma: tx,
      },
    );

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
        statusHistory: appendStatusHistory(payment.statusHistory, {
          status: STATUS_APPROVED,
          at: new Date().toISOString(),
          source: "finalize",
        }),
      },
    });

    await tx.esimOrder.update({
      where: { id: order.orderId },
      data: {
        paymentTransactionId: payment.id,
      },
    });

    logOrderInfo("payments.checkout.finalized", {
      checkoutId,
      orderId: order.orderId,
      paymentId: payment.id,
    });

    return order;
  });
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
): Promise<Prisma.CheckoutSessionGetPayload<{ include: { payments: true; package: true } }> | null> {
  const db = options.prisma ?? prismaClient;
  return db.checkoutSession.findUnique({
    where: { id: checkoutId },
    include: { payments: true, package: true },
  });
}
