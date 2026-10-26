import { enqueueJob } from "../jobs/store";
import { commitPaymentTransition, paymentState } from "./transitions";
import type { AiraloClient } from "../airalo/client";
import { Prisma, type PrismaClient } from "@prisma/client";
import { resolveCheckoutReferral } from "../affiliates/program";
import { safelyAccrueCommission } from "../affiliates/accounting";
import { z } from "zod";

import {
  findActivePackageByIdentifier,
  findPackageDisplayByIdentifier,
  isUuid,
} from "../catalog/package-resolver";
import prismaClient from "../db/client";
import { centsToMajorUnits } from "../format";
import { queueOrderReceipt } from "../notifications/receipt-outbox";
import { logOrderError, logOrderInfo } from "../observability/logging";
import { DEFAULT_QUANTITY, MAX_QUANTITY, normaliseQuantity } from "../orders/quantity";
import { CheckoutRequestError, normalizeEmailAddress } from "./checkout-request";
import { assertNewCheckoutEnabled, assertQuoteOwner, assertQuotePrice, validateTopUpContext } from "./quotes";
import {
  buildAiraloTopUpOrderPayload,
  logAiraloTopUpSubmissionSuccess,
  resolveAiraloClient,
  submitAiraloTopUpOrder,
} from "../orders/airalo-ordering";
import { handleAiraloOrderFailure } from "../orders/errors";
import {
  autoDeactivatePackage,
  claimReservedOrderForSubmission,
  handlePersistenceError,
  markReservedOrderSubmissionFailed,
  persistOrderRecords,
} from "../orders/persistence";
import {
  ORDER_CLAIMABLE_STATUSES,
  assertPurchaseOutcomeKnown,
  resolvePurchaseFailureOutcome,
} from "../orders/submission-state";
import { createOrder } from "../orders/service";
import type {
  CreateOrderOptions,
  CreateOrderResult,
  ReservedOrderSnapshot,
} from "../orders/service";
import { serialise } from "./status-history";
import {
  DpoCreationRejectedError,
  resolveDpoClient,
  type DpoClient,
  type VerifyDpoTransactionResult,
} from "./dpo";
import { getActiveDpoMode } from "./dpo-settings";

const checkoutInputSchema = z.object({
  packageId: z.string().min(1, "A package selection is required."),
  quoteId: z.string().min(1).optional(),
  quantity: z
    .number({ error: "Quantity must be a number." })
    .int("Quantity must be an integer.")
    .positive("Quantity must be at least 1.")
    .max(MAX_QUANTITY, "You can purchase one eSIM per checkout.")
    .default(DEFAULT_QUANTITY)
    .optional(),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((value) => normalizeEmailAddress(value))
    .optional(),
  intent: z.enum(["purchase", "top-up"]).default("purchase").optional(),
  topUpForOrderId: z.string().min(1).optional(),
  topUpForIccid: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  affiliateCode: z.string().trim().max(32).optional(),
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
  displayCents?: number;
  displayCurrency?: string;
  quoteExpiresAt?: string;
  status: string;
  intent: string;
  paymentStatus?: string;
  paymentUrl?: string;
  orderId?: string | null;
  redirectOrderId?: string | null;
  destination?: string | null;
  dataLabel?: string | null;
  validityDays?: number | null;
  customerEmail?: string | null;
};

export type CreateCheckoutResult = {
  checkoutId: string;
  paymentUrl: string;
};

const STATUS_PENDING = "pending";
const STATUS_PAID = "paid";
const STATUS_APPROVED = "approved";
const STATUS_FINALIZING = "finalizing";
const STATUS_VERIFICATION_MISMATCH = "verification_mismatch";
const PROVIDER = "dpo";

async function resolveCheckoutUserId(
  db: PrismaClient,
  userId?: string,
): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, emailProofAt: true, recoveryRequired: true },
  });

  if (user?.emailProofAt && !user.recoveryRequired) {
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
  options: { prisma?: PrismaClient; baseUrl: string; userId?: string; guestSessionId?: string; topUpAiraloClient?: AiraloClient; referralToken?: string | null; dpoClient?: Pick<DpoClient, "createTransaction"> },
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
  const quote = input.quoteId ? await db.checkoutQuote.findUnique({ where: { id: input.quoteId }, include: { checkout: { include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } } } }) : null;
  if (input.quoteId && !quote) throw new CheckoutRequestError("Price quote not found. Review the price again.", 409, "quoteId");
  if (quote) {
    assertQuoteOwner(quote, { userId: checkoutUserId ?? undefined, guestSessionId: options.guestSessionId });
    if (quote.intent !== (input.intent ?? "purchase") || quote.quantity !== quantity ||
      (input.topUpForOrderId && input.topUpForOrderId !== quote.topUpForOrderId) ||
      (input.topUpForIccid && input.topUpForIccid !== quote.topUpForIccid)) throw new CheckoutRequestError("Checkout details do not match the reviewed quote.", 409, "quoteId");
    if (quote.checkout) {
      if (input.packageId !== quote.packageId) {
        const matched = await findActivePackageByIdentifier(db, input.packageId, { activeOnly: false, packageType: "any", publicCatalogOnly: false });
        if (matched?.id !== quote.packageId) throw new CheckoutRequestError("The package does not match the reviewed quote.", 409, "quoteId");
      }
      const payment = quote.checkout.payments[0];
      if (payment?.redirectUrl) return { checkoutId: quote.checkout.id, paymentUrl: payment.redirectUrl };
      throw new CheckoutRequestError("Your payment is being checked. Reopen this checkout shortly; another payment will not be started automatically.", 503);
    }
    input.topUpForOrderId = quote.topUpForOrderId ?? undefined;
    input.topUpForIccid = quote.topUpForIccid ?? undefined;
  }


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

  // Accept either the Prisma package id or the supplier's external catalogue id.
  const pkg = await findActivePackageByIdentifier(
    db,
    input.packageId,
    input.intent === "top-up"
      ? {
          activeOnly: true,
          packageType: "topup",
          publicCatalogOnly: false,
        }
      : undefined,
  );

  if (!pkg) {
    logOrderError("payments.checkout.package_not_found", {
      requestedPackageId: input.packageId,
      packageIdIsUuid,
      userId: options.userId ?? null,
    });
    throw new Error("Selected package is unavailable.");
  }

  assertNewCheckoutEnabled();
  if (!quote) throw new CheckoutRequestError("Review a price quote before starting payment.", 409, "quoteId");
  if (quote.packageId !== pkg.id) throw new CheckoutRequestError("The package does not match the reviewed quote.", 409, "quoteId");
  assertQuotePrice(quote, pkg);
  if (quote.intent === "top-up") await validateTopUpContext({ packageId: pkg.id, topUpForOrderId: input.topUpForOrderId, topUpForIccid: input.topUpForIccid }, { userId: checkoutUserId ?? undefined }, db, options.topUpAiraloClient);
  const totalCents = quote.totalCents;

  const referral = await resolveCheckoutReferral({
    affiliateCode: input.affiliateCode, referralToken: options.referralToken,
    userId: checkoutUserId, customerEmail: input.customerEmail, intent: input.intent ?? "purchase",
    topUpForOrderId: input.topUpForOrderId, topUpForIccid: input.topUpForIccid,
  }, db);

  // Snapshot once: an admin switch during the DPO request must not relabel it.
  const dpoMode = await getActiveDpoMode(db);
  const dpoClient = options.dpoClient ?? resolveDpoClient(dpoMode);

  let checkout;
  try {
    checkout = await db.checkoutSession.create({
      data: {
        userId: checkoutUserId,
        quoteId: quote.id,
        packageId: pkg.id,
        customerEmail: input.customerEmail ?? null,
        quantity,
        totalCents,
        currency: "NAD",
        status: STATUS_PENDING,
        intent: input.intent ?? "purchase",
        topUpForOrderId: input.topUpForOrderId ?? null,
        topUpForIccid: input.topUpForIccid ?? null,
        metadata: input.metadata ? serialise(input.metadata) : null,
        ...referral,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.checkoutSession.findUnique({ where: { quoteId: quote.id }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
      if (existing?.payments[0]?.redirectUrl) return { checkoutId: existing.id, paymentUrl: existing.payments[0].redirectUrl };
      throw new CheckoutRequestError("Your payment is already being prepared. Please try this checkout again shortly.", 409);
    }
    throw error;
  }

  const successUrl = `${options.baseUrl}/checkout/${checkout.id}/return`;
  const cancelUrl = `${options.baseUrl}/checkout/${checkout.id}`;
  const callbackUrl = `${options.baseUrl}/api/payments/dpo/push`;

  const amount = centsToMajorUnits(totalCents);

  logOrderInfo("payments.checkout.create", {
    checkoutId: checkout.id,
    packageId: checkout.packageId,
    amount,
    currency: checkout.currency,
    dpoMode,
  });

  let response: Awaited<ReturnType<typeof dpoClient.createTransaction>>;

  const attempt = await db.$transaction(async tx => {
    const payment = await tx.paymentTransaction.create({ data: {
      userId: checkoutUserId, checkoutId: checkout.id, provider: PROVIDER, dpoMode,
      providerReference: checkout.id, status: "creating", amountCents: totalCents, currency: checkout.currency,
    } });
    await enqueueJob(tx, "verify_payment", payment.id);
    return payment;
  });

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
      data: { status: "payment_creation_unknown" },
    });

    await db.paymentTransaction.update({ where: { id: attempt.id }, data: { status: error instanceof DpoCreationRejectedError ? "creation_rejected" : "creation_unknown" } });
    throw error;
  }

  const transaction = await db.paymentTransaction.update({
    where: { id: attempt.id },
    data: {
      provider: PROVIDER,
      dpoMode,
      providerReference: response.transactionRef ?? response.reference ?? null,
      transactionToken: response.token,
      redirectUrl: response.redirectUrl,
      amountCents: totalCents,
      currency: checkout.currency,
      metadata: response.rawResponse ? serialise(response.rawResponse) : null,

    },
  });

  await db.paymentTransaction.updateMany({ where: { id: attempt.id, status: "creating" }, data: { status: STATUS_PENDING } });

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
      quote: true,
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
    displayCents: checkout.quote?.displayCents,
    displayCurrency: checkout.quote?.displayCurrency,
    quoteExpiresAt: checkout.quote?.expiresAt.toISOString(),
    status: checkout.status,
    intent: checkout.intent,
    paymentStatus: latestPayment?.status ?? undefined,
    paymentUrl: latestPayment?.redirectUrl ?? undefined,
    orderId: checkout.orderId,
    redirectOrderId:
      checkout.intent === "top-up" ? checkout.topUpForOrderId : checkout.orderId,
    destination: pkg?.operator?.country?.title ?? null,
    dataLabel: pkg ? (pkg.isUnlimited ? "Unlimited" : pkg.data) : null,
    validityDays: pkg?.day ?? null,
    customerEmail: checkout.customerEmail,
  };
}

type FinaliseOptions = {
  prisma?: PrismaClient;
  airaloOptions?: CreateOrderOptions;
  forceStatus?: string;
};

type VerifyCheckoutRecord = Prisma.CheckoutSessionGetPayload<{
  include: {
    payments: true;
  };
}>;

type VerifyCheckoutPaymentRecord = VerifyCheckoutRecord["payments"][number];

export type VerifyPaymentTransactionResult = {
  paymentStatus: string;
  orderId?: string | null;
  redirectOrderId?: string | null;
  message?: string;
  retryable?: boolean;
};

function amountToCents(amount: number | undefined): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

function normalizeCurrencyCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function validateApprovedDpoVerification(
  payment: VerifyCheckoutPaymentRecord,
  verification: VerifyDpoTransactionResult,
): string | null {
  const verifiedAmountCents = amountToCents(verification.amount);
  if (verifiedAmountCents === null) {
    return "DPO verification did not include a transaction amount.";
  }

  if (verifiedAmountCents !== payment.amountCents) {
    return `DPO amount mismatch. Expected ${payment.amountCents} cents but received ${verifiedAmountCents} cents.`;
  }

  const verifiedCurrency = normalizeCurrencyCode(verification.currency);
  const expectedCurrency = normalizeCurrencyCode(payment.currency);
  if (!verifiedCurrency) {
    return "DPO verification did not include a transaction currency.";
  }

  if (verifiedCurrency !== expectedCurrency) {
    return `DPO currency mismatch. Expected ${expectedCurrency} but received ${verifiedCurrency}.`;
  }

  return null;
}

export async function verifyCheckoutPayment(
  checkoutId: string,
  options: { prisma?: PrismaClient } = {},
): Promise<VerifyPaymentTransactionResult> {
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

  if (!payment) {
    throw new Error("Checkout has no associated payment token.");
  }

  return verifyCheckoutPaymentRecord(checkout, payment, {
    prisma: db,
    source: "verify",
  });
}

async function verifyCheckoutPaymentRecord(
  checkout: VerifyCheckoutRecord,
  payment: VerifyCheckoutPaymentRecord,
  options: {
    prisma: PrismaClient;
    source: string;
    dpoClient?: Pick<DpoClient, "verifyTransaction">;
    airaloOptions?: CreateOrderOptions;
    deferFulfillment?: boolean;
  },
): Promise<VerifyPaymentTransactionResult> {
  const db = options.prisma;

  if (payment.status === STATUS_APPROVED) {
    if (options.deferFulfillment) return { paymentStatus: payment.status, orderId: checkout.orderId };
    try {
      const order = await finaliseOrderFromCheckout(checkout.id, {
        prisma: db,
        forceStatus: STATUS_APPROVED,
        airaloOptions: options.airaloOptions,
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


  let verification;
  try {
    const dpoClient = options.dpoClient ?? resolveDpoClient(payment.dpoMode);
    verification = await dpoClient.verifyTransaction(payment.transactionToken ?? "", checkout.id);
    // Log key verification fields to help debug DPO responses in callback and return flows.
    console.info("dpo.verifyTransaction", {
      checkoutId: checkout.id,
      paymentId: payment.id,
      source: options.source,
      resultCode: verification.resultCode ?? verification.status,
      resultExplanation: verification.resultExplanation,
      status: verification.status,
    });
  } catch (error) {
    console.error("dpo.verifyTransaction failed", {
      checkoutId: checkout.id,
      paymentId: payment.id,
      source: options.source,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      paymentStatus: payment.status ?? STATUS_PENDING,
      orderId: checkout.orderId ?? null,
      redirectOrderId:
        checkout.intent === "top-up" ? checkout.topUpForOrderId : checkout.orderId,
      message: "Verification failed.",
      retryable: true,
    };
  }
  const resultCode = verification.resultCode ?? verification.status;
  const mismatchMessage = resultCode === "000" ? validateApprovedDpoVerification(payment, verification) : null;
  const normalizedStatus = mismatchMessage ? STATUS_VERIFICATION_MISMATCH : paymentState(resultCode);
  const updated = await commitPaymentTransition(db, {
    paymentId: payment.id, status: normalizedStatus, providerCode: resultCode,
    explanation: mismatchMessage ?? verification.resultExplanation,
    source: options.source, payload: serialise(verification.rawResponse),
  });
  const isPaid = updated.status === STATUS_APPROVED;
  const verificationMessage = mismatchMessage ?? (!isPaid ? verification.resultExplanation : undefined);

  let orderId = checkout.orderId ?? null;
  let redirectOrderId =
    checkout.intent === "top-up" ? checkout.topUpForOrderId : checkout.orderId;

  if (isPaid || normalizedStatus === STATUS_APPROVED) {
    if (options.deferFulfillment) return { paymentStatus: updated.status, orderId, redirectOrderId };
    try {
      const order = await finaliseOrderFromCheckout(checkout.id, {
        prisma: db,
        forceStatus: updated.status,
        airaloOptions: options.airaloOptions,
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
  }

  return { paymentStatus: updated.status, orderId, redirectOrderId, message: verificationMessage, retryable: !isPaid && !["declined", "expired", "cancelled", "verification_mismatch"].includes(updated.status) };
}

export async function verifyPaymentTransaction(
  transactionId: string,
  options: {
    prisma?: PrismaClient;
    source?: string;
    dpoClient?: Pick<DpoClient, "verifyTransaction">;
    airaloOptions?: CreateOrderOptions;
    deferFulfillment?: boolean;
  } = {},
): Promise<VerifyPaymentTransactionResult> {
  const db = options.prisma ?? prismaClient;

  const payment = await db.paymentTransaction.findUnique({
    where: { id: transactionId },
    include: {
      checkout: {
        include: {
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!payment) {
    throw new Error("Payment transaction not found.");
  }

  if (!payment.checkout) {
    throw new Error("Payment transaction is not linked to a checkout.");
  }


  return verifyCheckoutPaymentRecord(payment.checkout, payment, {
    prisma: db,
    source: options.source ?? "verify",
    dpoClient: options.dpoClient,
    airaloOptions: options.airaloOptions,
    deferFulfillment: options.deferFulfillment,
  });
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
    ORDER_CLAIMABLE_STATUSES.includes(order.status ?? "")
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
  const existing = await claimReservedOrderForSubmission(options.db, reservedOrder);
  if (existing) {
    return { ...existing, redirectOrderId: options.topUp.originalOrderId };
  }
  const pkg = {
    id: reservedOrder.packageId,
    airaloPackageId: reservedOrder.airaloPackageId,
    title: reservedOrder.packageTitle,
  };

  let airalo: NonNullable<CreateOrderOptions["airaloClient"]>;
  try {
    airalo = options.airaloOptions?.airaloClient ?? resolveAiraloClient();
  } catch (error) {
    await markReservedOrderSubmissionFailed(options.db, reservedOrder, "rejected");
    throw error;
  }

  const payload = buildAiraloTopUpOrderPayload({
    pkg,
    iccid: options.topUp.iccid,
    localOrderId: reservedOrder.orderId,
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
        markReservedOrderSubmissionFailed(options.db, reservedOrder, resolvePurchaseFailureOutcome(error)),
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
    await markReservedOrderSubmissionFailed(options.db, reservedOrder, "unknown");
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
    await tx.checkoutSession.update({
      where: { id: checkout.id },
      data: {
        orderId: order.orderId,
        status: STATUS_PAID,
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

  // Compatibility options cannot grant approval; independent verification must
  // already have persisted the successful state before any supplier claim.
  const isApproved = payment.status === STATUS_APPROVED;

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
      assertPurchaseOutcomeKnown(existingOrder);

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
        if (checkout.affiliateId) await safelyAccrueCommission(result.orderId, db);
        await queueOrderReceipt(db, result.orderId);
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

    if (checkout.affiliateId) await safelyAccrueCommission(order.orderId, db);

    await queueOrderReceipt(db, order.orderId);
    await enqueueJob(db, "reconcile_supplier", order.orderId);
    await enqueueJob(db, "complete_installation", order.orderId);

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
