import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AiraloClient, AiraloError } from "../airalo/client";
import prismaClient from "../db/client";

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
}

const DEFAULT_QUANTITY = 1;
const MAX_QUANTITY = 10;

let cachedAiraloClient: AiraloClient | null = null;

function resolveAiraloClient(): AiraloClient {
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

function createInstallationPayload(order: Awaited<ReturnType<AiraloClient["createOrder"]>>): string {
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

export async function createOrder(
  rawInput: unknown,
  options: CreateOrderOptions = {},
): Promise<CreateOrderResult> {
  const parsedInput = createOrderInputSchema.safeParse(rawInput);

  if (!parsedInput.success) {
    throw new OrderValidationError("Invalid order request.", parsedInput.error.issues);
  }

  const { packageId, quantity, customerEmail } = parsedInput.data;
  const db = options.prisma ?? prismaClient;
  const airalo = options.airaloClient ?? resolveAiraloClient();
  const pkg = await db.airaloPackage.findUnique({ where: { id: packageId } });

  if (!pkg) {
    throw new OrderValidationError("Selected plan is no longer available.");
  }

  const normalisedQuantity = normaliseQuantity(quantity);

  const airaloOrder = await airalo
    .createOrder({
      package_id: pkg.externalId,
      quantity: normalisedQuantity,
      customer_reference: `web-${Date.now()}`,
      metadata: {
        packageId: pkg.id,
        packageExternalId: pkg.externalId,
        source: "simplify-web",
      },
    })
    .catch((error: unknown) => {
      if (error instanceof AiraloError) {
        throw mapAiraloError(error);
      }

      throw new OrderServiceError("Failed to create order with Airalo.", 500, error);
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

    return {
      orderId: result.id,
      orderNumber: result.orderNumber,
    };
  } catch (error: unknown) {
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
