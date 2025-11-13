import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  AiraloClient,
  AiraloError,
  type Order as AiraloOrder,
} from "../airalo/client";
import prismaClient from "../db/client";
import { logOrderError, logOrderInfo } from "../observability/logging";
import { recordOrderMetrics, recordRateLimit } from "../observability/metrics";

const createOrderInputSchema = z.object({
  packageId: z.string().min(1, "A package selection is required."),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number." })
    .int("Quantity must be an integer.")
    .positive("Quantity must be at least 1.")
    .max(10, "You can order up to 10 eSIMs per checkout.")
    .default(1)
    .optional(),
  customerEmail: z.string().email("Enter a valid email address.").optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export type CreateOrderResult = {
  orderId: string;
  orderNumber: string;
};

export class OrderServiceError extends Error {
  readonly status: number;
  readonly cause?: unknown;

  constructor(message: string, status = 500, cause?: unknown) {
    super(message);
    this.name = "OrderServiceError";
    this.status = status;
    this.cause = cause;
  }
}

export class OrderValidationError extends OrderServiceError {
  readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[] = []) {
    super(message, 422);
    this.name = "OrderValidationError";
    this.issues = issues;
  }
}

export class OrderOutOfStockError extends OrderServiceError {
  constructor(message = "This plan is currently out of stock.") {
    super(message, 409);
    this.name = "OrderOutOfStockError";
  }
}

export interface CreateOrderOptions {
  prisma?: PrismaClient;
  airaloClient?: AiraloClient;
  metadata?: Record<string, unknown>;
}

const DEFAULT_QUANTITY = 1;
const MAX_QUANTITY = 10;

let cachedAiraloClient: AiraloClient | null = null;

export function resolveAiraloClient(): AiraloClient {
  if (cachedAiraloClient) {
    return cachedAiraloClient;
  }

  const clientId = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new OrderServiceError(
      "AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET must be configured to create orders.",
      500,
    );
  }

  cachedAiraloClient = new AiraloClient({
    clientId,
    clientSecret,
  });

  return cachedAiraloClient;
}

function normaliseQuantity(quantity?: number): number {
  if (typeof quantity !== "number" || Number.isNaN(quantity)) {
    return DEFAULT_QUANTITY;
  }

  return Math.min(Math.max(quantity, DEFAULT_QUANTITY), MAX_QUANTITY);
}

function createInstallationPayload(order: AiraloOrder): string {
  const payload = {
    orderId: order.order_id,
    orderReference: order.order_reference ?? null,
    iccid: order.iccid ?? null,
    activationCode: order.activation_code ?? null,
    qrCode: order.qr_code ?? null,
    esim: order.esim ?? null,
  };

  return JSON.stringify(payload);
}

const ORDER_DETAILS_INCLUDE = {
  package: true,
  profiles: {
    include: {
      usageSnapshots: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
    },
  },
  installation: true,
} satisfies Prisma.EsimOrderInclude;

export type OrderWithDetails = Prisma.EsimOrderGetPayload<{
  include: typeof ORDER_DETAILS_INCLUDE;
}>;

function buildOrderIdentifierWhere(identifier: string): Prisma.EsimOrderWhereInput {
  return {
    OR: [{ id: identifier }, { orderNumber: identifier }],
  };
}

export async function getOrderWithDetails(
  identifier: string,
  options: { prisma?: PrismaClient } = {},
): Promise<OrderWithDetails | null> {
  const db = options.prisma ?? prismaClient;

  return db.esimOrder.findFirst({
    where: buildOrderIdentifierWhere(identifier),
    include: ORDER_DETAILS_INCLUDE,
  });
}

export async function ensureOrderInstallation(
  identifier: string,
  options: { prisma?: PrismaClient; airaloClient?: AiraloClient } = {},
): Promise<OrderWithDetails | null> {
  const db = options.prisma ?? prismaClient;
  const existing = await getOrderWithDetails(identifier, { prisma: db });

  if (!existing) {
    return null;
  }

  const hasInstallation = Boolean(existing.installation?.payload);
  const hasProfile = existing.profiles.length > 0;

  if (hasInstallation && hasProfile) {
    return existing;
  }

  if (!existing.orderNumber) {
    return existing;
  }

  const airalo = options.airaloClient ?? resolveAiraloClient();
  const airaloOrder = await airalo.getOrderById(existing.orderNumber);
  const payload = createInstallationPayload(airaloOrder);

  await db.$transaction(async (tx) => {
    await tx.esimOrder.update({
      where: { id: existing.id },
      data: {
        status: airaloOrder.status,
      },
    });

    if (airaloOrder.iccid) {
      await tx.esimProfile.upsert({
        where: { iccid: airaloOrder.iccid },
        create: {
          iccid: airaloOrder.iccid,
          status: airaloOrder.status,
          activationCode: airaloOrder.activation_code ?? null,
          orderId: existing.id,
        },
        update: {
          status: airaloOrder.status,
          activationCode: airaloOrder.activation_code ?? null,
          orderId: existing.id,
        },
      });
    }

    await tx.esimInstallationPayload.upsert({
      where: { orderId: existing.id },
      update: { payload },
      create: {
        orderId: existing.id,
        payload,
      },
    });
  });

  return getOrderWithDetails(identifier, { prisma: db });
}

function mapAiraloError(error: AiraloError): OrderServiceError {
  const status = error.details.status;
  const body = error.details.body;
  const messageFromBody =
    typeof body === "object" && body && "message" in body && typeof (body as { message?: unknown }).message === "string"
      ? ((body as { message?: string }).message ?? "")
      : null;
  const combinedMessage = messageFromBody ?? error.message;

  if (status === 409 || /out of stock/i.test(combinedMessage)) {
    return new OrderOutOfStockError(messageFromBody ?? "This plan is currently out of stock.");
  }

  if (status === 422) {
    return new OrderValidationError(messageFromBody ?? "Airalo rejected the order request.");
  }

  return new OrderServiceError(combinedMessage, status, error);
}

function extractAiraloRequestId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const candidate =
    (body as { request_id?: unknown }).request_id ?? (body as { requestId?: unknown }).requestId;

  if (typeof candidate === "string" && candidate.trim()) {
    return candidate;
  }

  return null;
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

    throw new OrderValidationError("Invalid order request.", parsedInput.error.issues);
  }

  const { packageId, quantity, customerEmail } = parsedInput.data;
  const db = options.prisma ?? prismaClient;
  const airalo = options.airaloClient ?? resolveAiraloClient();
  const pkg = await db.airaloPackage.findUnique({ where: { id: packageId } });

  if (!pkg) {
    logOrderError("order.package.unavailable", {
      packageId,
    });

    recordOrderMetrics({
      result: "error",
      reason: "validation_failed",
      durationMs: Date.now() - startedAt,
      airaloStatus: "validation",
    });

    throw new OrderValidationError("Selected plan is no longer available.");
  }

  const normalisedQuantity = normaliseQuantity(quantity);
  const airaloCallStartedAt = Date.now();
  let airaloOrder: AiraloOrder;
  let airaloLatencyMs = 0;

  try {
    airaloOrder = await airalo.createOrder({
      package_id: pkg.externalId,
      quantity: normalisedQuantity,
      customer_reference: `web-${Date.now()}`,
      metadata: {
        packageId: pkg.id,
        packageExternalId: pkg.externalId,
        source: "simplify-web",
        ...(options.metadata ?? {}),
      },
    });
  } catch (error: unknown) {
    airaloLatencyMs = Date.now() - airaloCallStartedAt;

    if (error instanceof AiraloError) {
      const requestId = extractAiraloRequestId(error.details.body);
      if (error.details.status === 429) {
        recordRateLimit("orders");
      }

      logOrderError("airalo.order.create.failed", {
        packageId: pkg.id,
        packageExternalId: pkg.externalId,
        airaloStatus: error.details.status,
        airaloRequestId: requestId,
        latencyMs: airaloLatencyMs,
        message: error.message,
      });

      const mapped = mapAiraloError(error);

      recordOrderMetrics({
        result: "error",
        reason: error.details.status === 429 ? "rate_limited" : "airalo_error",
        durationMs: Date.now() - startedAt,
        airaloStatus: error.details.status,
      });

      throw mapped;
    }

    const mapped = new OrderServiceError("Failed to create order with Airalo.", 500, error);

    logOrderError("airalo.order.create.failed", {
      packageId: pkg.id,
      packageExternalId: pkg.externalId,
      latencyMs: airaloLatencyMs,
      message: mapped.message,
    });

    recordOrderMetrics({
      result: "error",
      reason: "unexpected",
      durationMs: Date.now() - startedAt,
      airaloStatus: "unknown",
    });

    throw mapped;
  }

  airaloLatencyMs = Date.now() - airaloCallStartedAt;

  logOrderInfo("airalo.order.create.succeeded", {
    packageId: pkg.id,
    packageExternalId: pkg.externalId,
    airaloOrderId: airaloOrder.order_id,
    airaloRequestId: airaloOrder.order_reference ?? null,
    airaloStatus: airaloOrder.status,
    latencyMs: airaloLatencyMs,
  });

  try {
    const result = await db.$transaction(async (tx) => {
      const orderRecord = await tx.esimOrder.create({
        data: {
          orderNumber: airaloOrder.order_id,
          packageId: pkg.id,
          status: airaloOrder.status,
          customerEmail: customerEmail ?? null,
          totalCents: pkg.priceCents,
          currency: pkg.currency,
          profiles: airaloOrder.iccid
            ? {
                create: {
                  iccid: airaloOrder.iccid,
                  status: airaloOrder.status,
                  activationCode: airaloOrder.activation_code ?? null,
                },
              }
            : undefined,
        },
      });

      await tx.esimInstallationPayload.create({
        data: {
          orderId: orderRecord.id,
          payload: createInstallationPayload(airaloOrder),
        },
      });

      return orderRecord;
    });

    const totalDuration = Date.now() - startedAt;

    logOrderInfo("order.create.completed", {
      orderId: result.id,
      orderNumber: result.orderNumber,
      packageId: pkg.id,
      airaloOrderId: airaloOrder.order_id,
      airaloRequestId: airaloOrder.order_reference ?? null,
      airaloStatus: airaloOrder.status,
      airaloLatencyMs,
      totalDurationMs: totalDuration,
    });

    recordOrderMetrics({
      result: "success",
      reason: "ok",
      durationMs: totalDuration,
      airaloStatus: airaloOrder.status,
    });

    return {
      orderId: result.id,
      orderNumber: result.orderNumber,
    };
  } catch (error: unknown) {
    logOrderError("order.persistence.failed", {
      packageId: pkg.id,
      airaloOrderId: airaloOrder.order_id,
      airaloStatus: airaloOrder.status,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    recordOrderMetrics({
      result: "error",
      reason: "persistence_failed",
      durationMs: Date.now() - startedAt,
      airaloStatus: airaloOrder.status,
    });

    if (error instanceof OrderServiceError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new OrderServiceError("An order with this reference already exists.", 409, error);
      }

      throw new OrderServiceError("Failed to persist the order.", 500, error);
    }

    throw new OrderServiceError("Unexpected error while creating the order.", 500, error);
  }
}
