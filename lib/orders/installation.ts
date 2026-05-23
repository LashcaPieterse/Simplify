import { Prisma } from "@prisma/client";

import type { AiraloClient } from "../airalo/client";
import type {
  Order as AiraloOrder,
  OrderResponse,
  Sim,
  SimResponse,
} from "../airalo/schemas";
import prismaClient from "../db/client";
import { logOrderWarn } from "../observability/logging";
import {
  createInstallationPayload,
  resolveAiraloOrderApn,
  resolveAiraloOrderActivationCode as resolveAiraloInstallActivationCode,
  resolveAiraloSimActivationCode,
  resolveAiraloSimStatus,
} from "./airalo-metadata";
import {
  resolveAiraloClient,
  resolveAiraloIccid,
  resolveAiraloOrderId,
  resolveAiraloStatus,
} from "./airalo-ordering";
import {
  isPrismaClient,
  toPrismaJson,
  type CreateOrderResult,
  type PrismaDbClient,
} from "./persistence";

export function parseInstallationPayloadJson(
  payload: string | null | undefined,
): Record<string, unknown> | null {
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hasGetSimHydratedInstallationPayload(
  payload: string | null | undefined,
): boolean {
  const parsed = parseInstallationPayloadJson(payload);
  if (!parsed) {
    return false;
  }

  return (
    parsed.source === "sim" &&
    "qrCodeData" in parsed &&
    "qrCodeUrl" in parsed &&
    "directAppleUrl" in parsed &&
    "matchingId" in parsed &&
    "recycled" in parsed
  );
}

export function resolveStringFromPayload(
  payload: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildCreateOrderInstallationResult(
  airaloOrder: AiraloOrder | null,
): CreateOrderResult["installation"] {
  if (!airaloOrder) {
    return undefined;
  }

  const installationPayload = parseInstallationPayloadJson(
    createInstallationPayload(airaloOrder),
  );

  return {
    qrCodeData: resolveStringFromPayload(installationPayload, "qrCodeData"),
    qrCodeUrl: resolveStringFromPayload(installationPayload, "qrCodeUrl"),
    smdpAddress: resolveStringFromPayload(installationPayload, "lpa"),
    activationCode: resolveStringFromPayload(
      installationPayload,
      "activationCode",
    ),
    apn:
      resolveStringFromPayload(installationPayload, "apn") ??
      resolveAiraloOrderApn(airaloOrder),
  };
}

function resolveExistingOrderIccid(order: OrderWithDetails): string | null {
  const profileIccid = order.profiles[0]?.iccid;
  if (profileIccid) {
    return profileIccid;
  }

  return resolveStringFromPayload(
    parseInstallationPayloadJson(order.installation?.payload),
    "iccid",
  );
}

function resolveHydratedStatus(
  order: AiraloOrder | null,
  sim: Sim | null,
  fallback: string,
): string {
  const orderStatus = order ? resolveAiraloStatus(order) : null;
  const simStatus = resolveAiraloSimStatus(sim);

  if (orderStatus && orderStatus !== "pending") {
    return orderStatus;
  }

  return simStatus ?? orderStatus ?? fallback;
}

const ORDER_DETAILS_INCLUDE = {
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

function buildOrderIdentifierWhere(
  identifier: string,
): Prisma.EsimOrderWhereInput {
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
  const hasHydratedInstallation = hasGetSimHydratedInstallationPayload(
    existing.installation?.payload,
  );

  if (hasInstallation && hasProfile && hasHydratedInstallation) {
    return existing;
  }

  const existingIccid = resolveExistingOrderIccid(existing);
  if (!existing.orderNumber && !existingIccid) {
    return existing;
  }

  const airalo = options.airaloClient ?? resolveAiraloClient();
  let airaloOrderResponse: OrderResponse | null = null;
  let airaloOrder: AiraloOrder | null = null;
  let orderFetchError: unknown;

  if (existing.orderNumber) {
    try {
      airaloOrderResponse = await airalo.getOrderResponseById(
        existing.orderNumber,
      );
      airaloOrder = airaloOrderResponse.data;
    } catch (error) {
      orderFetchError = error;
      if (!existingIccid && !hasInstallation && !hasProfile) {
        throw error;
      }

      logOrderWarn("order.installation.order_fetch_failed", {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const resolvedIccid = resolveAiraloIccid(airaloOrder) ?? existingIccid;
  let simResponse: SimResponse | null = null;
  let simDetails: Sim | null = null;

  try {
    if (resolvedIccid) {
      simResponse = await airalo.getSimResponse(resolvedIccid, {
        include: ["order", "order.status", "share"],
      });
      simDetails = simResponse.data;
    }
  } catch (error) {
    if (!airaloOrder && !hasInstallation && !hasProfile) {
      throw error;
    }

    logOrderWarn("order.installation.sim_fetch_failed", {
      orderId: existing.id,
      iccid: resolvedIccid,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  if (!airaloOrder && !simDetails) {
    if (orderFetchError && !hasInstallation && !hasProfile) {
      throw orderFetchError;
    }

    return existing;
  }

  const payload = createInstallationPayload(airaloOrder, simDetails);
  const resolvedStatus = resolveHydratedStatus(
    airaloOrder,
    simDetails,
    existing.status,
  );
  const activationCode =
    resolveAiraloInstallActivationCode(airaloOrder, simDetails) ??
    resolveAiraloSimActivationCode(simDetails);

  const performUpdate = async (tx: Prisma.TransactionClient) => {
    await tx.esimOrder.update({
      where: { id: existing.id },
      data: {
        status: resolvedStatus,
      },
    });

    if (airaloOrderResponse) {
      await tx.airaloOrderSnapshot.create({
        data: {
          orderId: existing.id,
          source: "orders",
          requestId: airaloOrder?.order_reference ?? existing.requestId,
          orderNumber:
            resolveAiraloOrderId(airaloOrder) ?? existing.orderNumber,
          rawPayloadJson: toPrismaJson(airaloOrderResponse),
        },
      });
    }

    if (simResponse) {
      await tx.airaloOrderSnapshot.create({
        data: {
          orderId: existing.id,
          source: "sim",
          requestId: existing.requestId,
          orderNumber:
            resolveAiraloOrderId(airaloOrder) ?? existing.orderNumber,
          rawPayloadJson: toPrismaJson(simResponse),
        },
      });
    }

    if (resolvedIccid) {
      await tx.esimProfile.upsert({
        where: { iccid: resolvedIccid },
        create: {
          iccid: resolvedIccid,
          status: resolvedStatus,
          activationCode,
          orderId: existing.id,
        },
        update: {
          status: resolvedStatus,
          ...(activationCode ? { activationCode } : {}),
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
