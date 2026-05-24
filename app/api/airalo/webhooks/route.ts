import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/client";
import { toPrismaJson } from "@/lib/db/json";
import {
  jsonInvalidJson,
  jsonServerError,
  jsonUnauthorized,
  jsonValidationError,
} from "@/lib/api/errors";
import {
  logOrderError,
  logOrderInfo,
  logOrderWarn,
} from "@/lib/observability/logging";
import {
  recordRateLimit,
  recordWebhookMetrics,
} from "@/lib/observability/metrics";
import {
  WebhookPayloadSchema,
  type WebhookPayload,
} from "@/lib/airalo/schemas";
import {
  extractActivationCode,
  extractUsage,
} from "@/lib/orders/airalo-metadata";
import {
  buildWebhookOrderClauses,
  resolveWebhookPackageExternalId,
  resolveWebhookRequestId,
} from "@/lib/orders/webhook-matching";
import { authenticateAiraloWebhookRequest } from "@/lib/orders/webhook-auth";

function resolveEventId(
  headers: Headers,
  payload: WebhookPayload,
  rawBody: string,
): string {
  const headerId =
    headers.get("x-airalo-event-id") ??
    headers.get("x-airalo-request-id") ??
    headers.get("x-request-id");

  if (headerId) {
    return headerId;
  }

  const composite = [
    resolveWebhookRequestId(payload.data),
    payload.event,
    payload.data.order_id,
    payload.timestamp,
  ]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(":");

  if (composite.trim()) {
    return composite;
  }

  return createHash("sha256").update(rawBody).digest("hex");
}

async function recordWebhookSnapshot({
  tx,
  orderId,
  payload,
}: {
  tx: Prisma.TransactionClient;
  orderId: string | null;
  payload: WebhookPayload;
}): Promise<void> {
  await tx.airaloOrderSnapshot.create({
    data: {
      orderId,
      source: "webhook",
      requestId: resolveWebhookRequestId(payload.data),
      orderNumber: payload.data.order_id,
      rawPayloadJson: toPrismaJson(payload),
    },
  });
}

async function findOrderForWebhook(
  tx: Prisma.TransactionClient,
  payload: WebhookPayload,
): Promise<{
  order: Prisma.EsimOrderGetPayload<{ include: { profiles: true } }> | null;
  matchMethod: "direct" | "package_fallback" | null;
  fallbackCandidates: number | null;
}> {
  const orderClauses = buildWebhookOrderClauses(payload.data);

  const directOrder = await tx.esimOrder.findFirst({
    where: { OR: orderClauses },
    include: { profiles: true },
  });

  if (directOrder) {
    return {
      order: directOrder,
      matchMethod: "direct",
      fallbackCandidates: null,
    };
  }

  const packageExternalId = resolveWebhookPackageExternalId(payload.data);
  if (!packageExternalId) {
    return { order: null, matchMethod: null, fallbackCandidates: null };
  }

  const fallbackCandidates = await tx.esimOrder.findMany({
    where: {
      orderNumber: null,
      profiles: { none: {} },
      status: { in: ["pending", "airalo_submitting"] },
      package: { is: { airaloPackageId: packageExternalId } },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    include: { profiles: true },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  if (fallbackCandidates.length === 1) {
    return {
      order: fallbackCandidates[0],
      matchMethod: "package_fallback",
      fallbackCandidates: 1,
    };
  }

  return {
    order: null,
    matchMethod: null,
    fallbackCandidates: fallbackCandidates.length,
  };
}

export async function POST(request: Request) {
  const secret = process.env.AIRALO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logOrderError("webhook.secret.missing");
    return jsonServerError("webhook_secret_missing", "Webhook secret is not configured.");
  }

  const rawBody = await request.text();
  const auth = authenticateAiraloWebhookRequest({
    requestUrl: request.url,
    secret,
  });

  if (!auth.valid) {
    logOrderWarn("webhook.auth.invalid", {
      hasUrlSecret: auth.hasUrlSecret,
      bodySha256: createHash("sha256").update(rawBody).digest("hex"),
    });

    recordWebhookMetrics({
      eventType: "unknown",
      result: "rejected",
      durationMs: 0,
      reason: "invalid_webhook_secret",
    });
    return jsonUnauthorized("invalid_webhook_secret", "Invalid webhook secret.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    recordWebhookMetrics({
      eventType: "unknown",
      result: "rejected",
      durationMs: 0,
      reason: "invalid_json",
    });
    return jsonInvalidJson();
  }

  const parsedPayload = WebhookPayloadSchema.safeParse(parsed);
  if (!parsedPayload.success) {
    logOrderError("webhook.payload.invalid", {
      issues: parsedPayload.error.issues,
    });
    recordWebhookMetrics({
      eventType: "unknown",
      result: "rejected",
      durationMs: 0,
      reason: "schema_validation_failed",
    });
    return jsonValidationError(parsedPayload.error, "Invalid webhook payload.");
  }
  const payload: WebhookPayload = parsedPayload.data;

  const processingStartedAt = Date.now();
  const eventId = resolveEventId(request.headers, payload, rawBody);

  try {
    const result = await prisma.$transaction(async (tx) => {
      let eventRecord = await tx.webhookEvent.findUnique({
        where: { eventId },
      });
      if (eventRecord?.orderId) {
        return { status: "duplicate" as const };
      }

      const match = await findOrderForWebhook(tx, payload);
      const order = match.order;

      if (eventRecord) {
        eventRecord = await tx.webhookEvent.update({
          where: { id: eventRecord.id },
          data: {
            eventType: payload.event,
            orderId: order?.id ?? null,
            payload: rawBody,
          },
        });
      } else {
        eventRecord = await tx.webhookEvent
          .create({
            data: {
              eventId,
              eventType: payload.event,
              orderId: order?.id ?? null,
              payload: rawBody,
            },
          })
          .catch((error: unknown) => {
            if (isWebhookDuplicateError(error)) {
              return null;
            }

            throw error;
          });
      }

      if (!eventRecord) {
        return { status: "duplicate" as const };
      }

      let profileId: string | null = null;

      if (order) {
        const updateData: Prisma.EsimOrderUpdateInput = {
          status: payload.data.status,
        };

        if (!order.orderNumber) {
          updateData.orderNumber = payload.data.order_id;
        }

        const requestId = resolveWebhookRequestId(payload.data);
        if (!order.requestId && requestId) {
          updateData.requestId = requestId;
        }

        await tx.esimOrder.update({
          where: { id: order.id },
          data: updateData,
        });

        const activationCode = extractActivationCode(payload.data.metadata);

        if (payload.data.iccid) {
          const profile = await tx.esimProfile.upsert({
            where: { iccid: payload.data.iccid },
            create: {
              iccid: payload.data.iccid,
              status: payload.data.status,
              activationCode,
              orderId: order.id,
            },
            update: {
              status: payload.data.status,
              activationCode,
              orderId: order.id,
            },
          });

          profileId = profile.id;
        } else if (order.profiles.length > 0) {
          profileId = order.profiles[0].id;
        }

        const usage = extractUsage(payload.data.metadata);
        if (usage && profileId) {
          await tx.usageSnapshot.create({
            data: {
              orderId: order.id,
              profileId,
              usedMb: usage.usedMb ?? null,
              remainingMb: usage.remainingMb ?? null,
            },
          });
        }
      }

      await recordWebhookSnapshot({
        tx,
        orderId: order?.id ?? null,
        payload,
      });

      await tx.webhookEvent.update({
        where: { id: eventRecord.id },
        data: { processedAt: new Date() },
      });

      return {
        status: "processed" as const,
        orderId: order?.id ?? null,
        matchMethod: match.matchMethod,
        fallbackCandidates: match.fallbackCandidates,
      };
    });

    const duration = Date.now() - processingStartedAt;

    if (result.status === "duplicate") {
      logOrderInfo("webhook.event.duplicate", {
        eventId,
        eventType: payload.event,
        orderId: payload.data.order_id,
      });
      recordWebhookMetrics({
        eventType: payload.event,
        result: "duplicate",
        durationMs: duration,
        reason: "already_processed",
      });
      return NextResponse.json({ message: "Event already processed." });
    }

    logOrderInfo("webhook.event.processed", {
      eventId,
      eventType: payload.event,
      orderId: payload.data.order_id,
      matchedOrderId: result.orderId,
      requestId: resolveWebhookRequestId(payload.data),
      authMethod: auth.method,
      matchMethod: result.matchMethod,
      fallbackCandidates: result.fallbackCandidates,
      reason: result.orderId ? "ok" : "order_not_found",
    });

    recordWebhookMetrics({
      eventType: payload.event,
      result: "processed",
      durationMs: duration,
      reason: result.orderId ? "ok" : "order_not_found",
    });

    return NextResponse.json({ message: "Webhook processed." });
  } catch (error: unknown) {
    const duration = Date.now() - processingStartedAt;

    if (isWebhookDuplicateError(error)) {
      logOrderInfo("webhook.event.duplicate", {
        eventId,
        eventType: payload.event,
        orderId: payload.data.order_id,
      });

      recordWebhookMetrics({
        eventType: payload.event,
        result: "duplicate",
        durationMs: duration,
        reason: "already_processed",
      });

      return NextResponse.json({ message: "Event already processed." });
    }

    if (isPrismaRetryableTransactionError(error)) {
      // Prisma transaction aborted due to a retryable failure.
      recordRateLimit("webhooks");
    }

    logOrderError("webhook.processing.failed", {
      eventId,
      eventType: payload.event,
      orderId: payload.data.order_id,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    recordWebhookMetrics({
      eventType: payload.event,
      result: "error",
      durationMs: duration,
      reason: "processing_failed",
    });

    return jsonServerError("webhook_processing_failed", "Failed to process webhook.");
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

function isWebhookDuplicateError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isPrismaRetryableTransactionError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}
