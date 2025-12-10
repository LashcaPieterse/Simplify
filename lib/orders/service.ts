import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  AiraloClient,
  AiraloError,
  type CreateOrderPayload,
  type SubmitOrderAsyncAck,
} from "../airalo/client";
import type { Order as AiraloOrder } from "../airalo/schemas";
import { resolveSharedTokenCache } from "../airalo/token-cache";
import prismaClient from "../db/client";
import { logOrderError, logOrderInfo } from "../observability/logging";
import {
  recordOrderMetrics,
  recordRateLimit,
  type RecordOrderMetricsOptions,
} from "../observability/metrics";
import { createInstallationPayload } from "./airalo-metadata";

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

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

function isPrismaClient(client: PrismaDbClient): client is PrismaClient {
  return typeof (client as PrismaClient).$transaction === "function";
}

function resolveAiraloOrderId(order: AiraloOrder | null | undefined): string | null {
  if (!order) {
    return null;
  }

  return order.order_id ?? order.code ?? order.id ?? null;
}

function resolveAiraloPrimarySim(order: AiraloOrder | null | undefined) {
  if (!order) {
    return null;
  }

  if (Array.isArray(order.sims) && order.sims.length > 0) {
    return order.sims[0];
  }

  return null;
}

function resolveAiraloIccid(order: AiraloOrder | null | undefined): string | null {
  if (!order) {
    return null;
  }

  const primarySim = resolveAiraloPrimarySim(order);
  return order.iccid ?? primarySim?.iccid ?? null;
}

function resolveAiraloActivationCode(order: AiraloOrder | null | undefined): string | null {
  if (!order) {
    return null;
  }

  const primarySim = resolveAiraloPrimarySim(order);
  return order.activation_code ?? primarySim?.activation_code ?? null;
}

function resolveAiraloStatus(order: AiraloOrder | null | undefined): string {
  if (!order) {
    return "pending";
  }

  return order.status ?? "pending";
}

export interface CreateOrderOptions {
  prisma?: PrismaDbClient;
  airaloClient?: AiraloClient;
  submissionMode?: "async" | "sync";
  userId?: string;
}

const DEFAULT_QUANTITY = 1;
const MAX_QUANTITY = 10;
const ORDER_RATE_LIMIT_RETRY = { attempts: 3, baseDelayMs: 500 };

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
    tokenCache: resolveSharedTokenCache(),
  });

  return cachedAiraloClient;
}

function normaliseQuantity(quantity?: number): number {
  if (typeof quantity !== "number" || Number.isNaN(quantity)) {
    return DEFAULT_QUANTITY;
  }

  return Math.min(Math.max(quantity, DEFAULT_QUANTITY), MAX_QUANTITY);
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
  payment: true,
} satisfies Prisma.EsimOrderInclude;

export type OrderWithDetails = Prisma.EsimOrderGetPayload<{
  include: typeof ORDER_DETAILS_INCLUDE;
}>;

function buildOrderIdentifierWhere(identifier: string): Prisma.EsimOrderWhereInput {
  const clauses: Prisma.EsimOrderWhereInput[] = [{ id: identifier }];

  clauses.push({ orderNumber: identifier });
  clauses.push({ requestId: identifier });

  return {
    OR: clauses,
  };
}

export async function getOrderWithDetails(
  identifier: string,
  options: { prisma?: PrismaDbClient } = {},
): Promise<OrderWithDetails | null> {
  const db: PrismaDbClient = options.prisma ?? prismaClient;

  return db.esimOrder.findFirst({
    where: buildOrderIdentifierWhere(identifier),
    include: ORDER_DETAILS_INCLUDE,
  });
}

export async function ensureOrderInstallation(
  identifier: string,
  options: { prisma?: PrismaDbClient; airaloClient?: AiraloClient } = {},
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

  const resolvedIccid = resolveAiraloIccid(airaloOrder);
  const resolvedStatus = resolveAiraloStatus(airaloOrder);
  // Fetch installation instructions for richer APN/QR/smdp data when possible.
  let activationCode: string | null = null;
  try {
    if (resolvedIccid) {
      const instructions = await airalo.getSimInstallationInstructions(resolvedIccid, {
        acceptLanguage: "en",
      });
      const platform = instructions.instructions?.ios?.[0] ?? instructions.instructions?.android?.[0];
      activationCode =
        (platform?.installation_manual?.activation_code as string | undefined) ??
        airaloOrder.activation_code ??
        null;
    }
  } catch (error) {
    // Swallow instruction fetch errors; keep existing installation data.
    console.warn("Failed to fetch installation instructions", error);
  }

  const performUpdate = async (tx: Prisma.TransactionClient) => {
    await tx.esimOrder.update({
      where: { id: existing.id },
      data: {
        status: resolvedStatus,
      },
    });

    if (resolvedIccid) {
      await tx.esimProfile.upsert({
        where: { iccid: resolvedIccid },
        create: {
          iccid: resolvedIccid,
          status: resolvedStatus,
          activationCode: airaloOrder.activation_code ?? null,
          orderId: existing.id,
        },
        update: {
          status: resolvedStatus,
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

    if (resolvedIccid) {
      await tx.esimProfile.update({
        where: { iccid: resolvedIccid },
        data: {
          activationCode,
        },
      });
    }
  };

  if (isPrismaClient(db)) {
    await db.$transaction(async (tx) => {
      await performUpdate(tx);
    });
  } else {
    await performUpdate(db);
  }

  return getOrderWithDetails(identifier, { prisma: db });
}

type AiraloValidationErrors = Record<string, string[]>;

function extractAiraloValidationErrors(body: unknown): AiraloValidationErrors | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = (body as { data?: unknown }).data;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const entries = Object.entries(data as Record<string, unknown>);
  const validationErrors: AiraloValidationErrors = {};

  for (const [field, value] of entries) {
    if (typeof value === "string" && value.trim()) {
      validationErrors[field] = [value];
      continue;
    }

    if (Array.isArray(value)) {
      const messages = value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );
      if (messages.length > 0) {
        validationErrors[field] = messages;
      }
    }
  }

  return Object.keys(validationErrors).length > 0 ? validationErrors : null;
}

interface AiraloBusinessErrorInfo {
  code: number | null;
  reason: string | null;
  message: string | null;
}

const INSUFFICIENT_CREDIT_ERROR_CODES = new Set<number>([11]);
const OUT_OF_STOCK_ERROR_CODES = new Set<number>([33]);
const INVALID_PACKAGE_ERROR_CODES = new Set<number>([34]);
const RECYCLED_SIM_ERROR_CODES = new Set<number>([73]);

const OUT_OF_STOCK_PATTERNS = [/out of stock/i, /insufficient stock/i];
const MAINTENANCE_PATTERNS = [/maintenance/i];
const CHECKSUM_PATTERNS = [/checksum/i];
const RECYCLED_PATTERNS = [/recycled/i];

type MetricsReason = NonNullable<RecordOrderMetricsOptions["reason"]>;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normaliseAiraloString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normaliseAiraloNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function pickFirstNonNull<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

function extractAiraloBusinessError(body: unknown): AiraloBusinessErrorInfo | null {
  if (typeof body === "string") {
    const text = body.trim();
    return text ? { code: null, reason: text, message: text } : null;
  }

  const root = toRecord(body);
  if (!root) {
    return null;
  }

  const meta = toRecord(root.meta);
  const error = toRecord(root.error);
  const candidates = [root, meta, error].filter((entry): entry is Record<string, unknown> => Boolean(entry));

  const code = pickFirstNonNull(
    ...candidates.map((entry) =>
      normaliseAiraloNumber(
        (entry as { code?: unknown; error_code?: unknown }).code ??
          (entry as { code?: unknown; error_code?: unknown }).error_code,
      ),
    ),
  );

  const reason = pickFirstNonNull(
    ...candidates.map((entry) =>
      normaliseAiraloString(
        (entry as { reason?: unknown; error_reason?: unknown }).reason ??
          (entry as { reason?: unknown; error_reason?: unknown }).error_reason,
      ),
    ),
  );

  const message = pickFirstNonNull(
    ...candidates.map((entry) =>
      normaliseAiraloString(
        (entry as { message?: unknown; error_message?: unknown }).message ??
          (entry as { message?: unknown; error_message?: unknown }).error_message,
      ),
    ),
  );

  if (code === null && !reason && !message) {
    return null;
  }

  return { code, reason, message };
}

function matchAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function hasPatternMatch(
  info: AiraloBusinessErrorInfo | null,
  fallback: string | null,
  patterns: RegExp[],
): boolean {
  const candidates = [info?.reason, info?.message, fallback];

  return candidates.some((candidate) => typeof candidate === "string" && matchAnyPattern(candidate, patterns));
}

function classifyAiraloBusinessReason(
  info: AiraloBusinessErrorInfo | null,
  fallback: string | null,
  status: number,
): MetricsReason | null {
  if (status === 409) {
    return "airalo_out_of_stock";
  }

  const code = info?.code ?? null;

  if (code !== null) {
    if (OUT_OF_STOCK_ERROR_CODES.has(code)) {
      return "airalo_out_of_stock";
    }

    if (INSUFFICIENT_CREDIT_ERROR_CODES.has(code)) {
      return "insufficient_credit";
    }

    if (RECYCLED_SIM_ERROR_CODES.has(code)) {
      return "iccid_recycled";
    }
  }

  if (hasPatternMatch(info, fallback, OUT_OF_STOCK_PATTERNS)) {
    return "airalo_out_of_stock";
  }

  if (hasPatternMatch(info, fallback, MAINTENANCE_PATTERNS)) {
    return "operator_maintenance";
  }

  if (hasPatternMatch(info, fallback, RECYCLED_PATTERNS)) {
    return "iccid_recycled";
  }

  if (hasPatternMatch(info, fallback, CHECKSUM_PATTERNS)) {
    return "checksum_failed";
  }

  return null;
}

function mapAiraloError(
  error: AiraloError,
  businessErrorOverride?: AiraloBusinessErrorInfo | null,
): OrderServiceError {
  const status = error.details.status;
  const businessError = businessErrorOverride ?? extractAiraloBusinessError(error.details.body);
  const detailedMessage = businessError?.reason ?? businessError?.message ?? error.message;
  const candidateMessage = businessError?.message ?? error.message;

  const businessCode = businessError?.code ?? null;

  const hasOutOfStockSignal =
    status === 409 ||
    (businessCode !== null && OUT_OF_STOCK_ERROR_CODES.has(businessCode)) ||
    hasPatternMatch(businessError, candidateMessage, OUT_OF_STOCK_PATTERNS);

  if (hasOutOfStockSignal) {
    return new OrderOutOfStockError(businessError?.reason ?? businessError?.message ?? undefined);
  }

  if (businessCode !== null && INSUFFICIENT_CREDIT_ERROR_CODES.has(businessCode)) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo rejected the order because the partner credit balance is insufficient. Top up the Airalo wallet and retry.",
      402,
      error,
    );
  }

  if (businessCode !== null && INVALID_PACKAGE_ERROR_CODES.has(businessCode)) {
    return new OrderValidationError(
      businessError?.reason ?? "Selected plan is no longer valid. Refresh the catalog and try a different plan.",
    );
  }

  if (
    (businessCode !== null && RECYCLED_SIM_ERROR_CODES.has(businessCode)) ||
    hasPatternMatch(businessError, candidateMessage, RECYCLED_PATTERNS)
  ) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo indicates the requested SIM has already been recycled and cannot be provisioned or topped up.",
      410,
      error,
    );
  }

  if (hasPatternMatch(businessError, candidateMessage, MAINTENANCE_PATTERNS)) {
    return new OrderServiceError(
      businessError?.reason ??
        "Airalo reports the operator is undergoing maintenance. Pause sales for this plan and retry later.",
      503,
      error,
    );
  }

  if (hasPatternMatch(businessError, candidateMessage, CHECKSUM_PATTERNS)) {
    return new OrderValidationError(
      businessError?.reason ??
        "Airalo rejected the request because of a checksum mismatch in the supplied ICCID or payload.",
    );
  }

  if (status === 422) {
    return new OrderValidationError(detailedMessage ?? "Airalo rejected the order request.");
  }

  return new OrderServiceError(detailedMessage, status, error);
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
  const submissionMode = options.submissionMode ?? "async";
  const isAsyncSubmission = submissionMode !== "sync";
  const pkg = await db.airaloPackage.findUnique({ where: { id: packageId } });

  if (!pkg || !pkg.isActive) {
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
  const description = `${normalisedQuantity} x ${pkg.name}`;
  const orderPayload: CreateOrderPayload = {
    package_id: pkg.externalId,
    quantity: String(normalisedQuantity),
    type: "sim",
    description,
  };

  if (customerEmail) {
    orderPayload.to_email = customerEmail;
    orderPayload["sharing_option[]"] = ["link"];
  }
  const airaloCallStartedAt = Date.now();
  let airaloAck: SubmitOrderAsyncAck | null = null;
  let airaloOrder: AiraloOrder | null = null;
  let airaloLatencyMs = 0;

  const invokeWithBackoff = async <T>(fn: () => Promise<T>): Promise<T> => {
    let attempt = 0;
    let lastError: unknown;
    while (attempt < ORDER_RATE_LIMIT_RETRY.attempts) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const isRateLimit =
          error instanceof AiraloError && error.details.status === 429;
        if (!isRateLimit) {
          throw error;
        }
        const delayMs =
          ORDER_RATE_LIMIT_RETRY.baseDelayMs * 2 ** attempt +
          Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, delayMs));
        attempt += 1;
      }
    }
    throw lastError;
  };

  try {
    if (isAsyncSubmission) {
      airaloAck = await invokeWithBackoff(() => airalo.createOrderAsync(orderPayload));
    } else {
      airaloOrder = await invokeWithBackoff(() => airalo.createOrder(orderPayload));
    }
  } catch (error: unknown) {
    airaloLatencyMs = Date.now() - airaloCallStartedAt;

    if (error instanceof AiraloError) {
      const requestId = extractAiraloRequestId(error.details.body);
      const businessError = extractAiraloBusinessError(error.details.body);
      const businessMessage = businessError?.reason ?? businessError?.message ?? null;
      if (error.details.status === 429) {
        recordRateLimit("orders");
      }

      const isAiraloValidationError = error.details.status === 422;

      logOrderError("airalo.order.create.failed", {
        packageId: pkg.id,
        packageExternalId: pkg.externalId,
        airaloStatus: error.details.status,
        airaloRequestId: requestId,
        airaloErrorCode: businessError?.code ?? null,
        airaloErrorReason: businessError?.reason ?? null,
        latencyMs: airaloLatencyMs,
        message: error.message,
      });

      if (isAiraloValidationError) {
        const fieldErrors = extractAiraloValidationErrors(error.details.body);
        const validationFields = fieldErrors ? Object.keys(fieldErrors) : null;
        logOrderError("order.validation.failed", {
          packageId: pkg.id,
          packageExternalId: pkg.externalId,
          airaloStatus: error.details.status,
          airaloRequestId: requestId,
          airaloErrorCode: businessError?.code ?? null,
          airaloErrorReason: businessError?.reason ?? null,
          latencyMs: airaloLatencyMs,
          fieldErrors,
          validationFields,
        });
      }

      const mapped = mapAiraloError(error, businessError);
      const classification = classifyAiraloBusinessReason(
        businessError,
        businessMessage ?? error.message,
        error.details.status,
      );

      const metricsReason = isAiraloValidationError
        ? "validation_failed"
        : classification ?? (error.details.status === 429 ? "rate_limited" : "airalo_error");

      recordOrderMetrics({
        result: "error",
        reason: metricsReason,
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
      error: error instanceof Error ? error.message : String(error),
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

  if (isAsyncSubmission && airaloAck) {
    logOrderInfo("airalo.order.async.accepted", {
      packageId: pkg.id,
      packageExternalId: pkg.externalId,
      airaloRequestId: airaloAck.request_id,
      acceptedAt: airaloAck.accepted_at,
      latencyMs: airaloLatencyMs,
    });
  } else if (airaloOrder) {
    logOrderInfo("airalo.order.sync.completed", {
      packageId: pkg.id,
      packageExternalId: pkg.externalId,
      airaloOrderId: resolveAiraloOrderId(airaloOrder),
      airaloRequestId: airaloOrder.order_reference ?? resolveAiraloOrderId(airaloOrder) ?? null,
      status: resolveAiraloStatus(airaloOrder),
      latencyMs: airaloLatencyMs,
    });
  }

  try {
    const createOrderRecords = async (tx: Prisma.TransactionClient) => {
      const orderRecord = await tx.esimOrder.create({
        data: {
          userId: options.userId ?? null,
          orderNumber: resolveAiraloOrderId(airaloOrder),
          requestId: airaloAck?.request_id ?? airaloOrder?.order_reference ?? resolveAiraloOrderId(airaloOrder),
          packageId: pkg.id,
          status: resolveAiraloStatus(airaloOrder),
          customerEmail: customerEmail ?? null,
          quantity: normalisedQuantity,
          totalCents: pkg.priceCents * normalisedQuantity,
          currency: pkg.currency,
        },
      });

      if (airaloOrder) {
        const iccid = resolveAiraloIccid(airaloOrder);
        if (iccid) {
          await tx.esimProfile.upsert({
            where: { iccid },
            create: {
              iccid,
              status: resolveAiraloStatus(airaloOrder),
              activationCode: resolveAiraloActivationCode(airaloOrder),
              orderId: orderRecord.id,
            },
            update: {
              status: resolveAiraloStatus(airaloOrder),
              activationCode: resolveAiraloActivationCode(airaloOrder),
              orderId: orderRecord.id,
            },
          });
        }

        const installationPayload = createInstallationPayload(airaloOrder);
        await tx.esimInstallationPayload.upsert({
          where: { orderId: orderRecord.id },
          create: { orderId: orderRecord.id, payload: installationPayload },
          update: { payload: installationPayload },
        });
      }

      return orderRecord;
    };

    const result = isPrismaClient(db)
      ? await db.$transaction(async (tx) => createOrderRecords(tx))
      : await createOrderRecords(db);

    const totalDuration = Date.now() - startedAt;

    logOrderInfo("order.create.completed", {
      orderId: result.id,
      orderNumber: result.orderNumber ?? null,
      packageId: pkg.id,
      airaloRequestId: airaloAck?.request_id ?? airaloOrder?.order_reference ?? null,
      airaloAcceptedAt: airaloAck?.accepted_at ?? null,
      submissionMode,
      airaloLatencyMs,
      totalDurationMs: totalDuration,
    });

    recordOrderMetrics({
      result: "success",
      reason: "ok",
      durationMs: totalDuration,
      airaloStatus: isAsyncSubmission ? "accepted" : airaloOrder?.status ?? "completed",
    });

    return {
      orderId: result.id,
      orderNumber: result.orderNumber ?? null,
      requestId: result.requestId ?? result.orderNumber ?? null,
      installation: airaloOrder
        ? {
            qrCodeData: airaloOrder.qr_code ?? airaloOrder.esim ?? null,
            qrCodeUrl: airaloOrder.qr_code ?? null,
            smdpAddress: (airaloOrder as Record<string, unknown>).smdp_address?.toString() ?? null,
            activationCode: airaloOrder.activation_code ?? null,
            apn: (airaloOrder as Record<string, unknown>).apn?.toString() ?? null,
          }
        : undefined,
    };
  } catch (error: unknown) {
    logOrderError("order.persistence.failed", {
      packageId: pkg.id,
      airaloRequestId: airaloAck?.request_id ?? airaloOrder?.order_reference ?? null,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    recordOrderMetrics({
      result: "error",
      reason: "persistence_failed",
      durationMs: Date.now() - startedAt,
      airaloStatus: isAsyncSubmission ? "accepted" : airaloOrder?.status ?? "completed",
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
