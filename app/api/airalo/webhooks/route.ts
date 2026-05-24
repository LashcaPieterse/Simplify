import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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
  resolveWebhookRequestId,
} from "@/lib/orders/webhook-matching";

function decodeSignature(signature: string): Buffer | null {
  const trimmed = signature.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/^sha256=/i, "");

  if (/^[0-9a-f]+$/i.test(cleaned) && cleaned.length % 2 === 0) {
    return Buffer.from(cleaned, "hex");
  }

  try {
    return Buffer.from(cleaned, "base64");
  } catch {
    return null;
  }
}

function isValidSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const provided = decodeSignature(signature);
  if (!provided) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body).digest();

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

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

export async function POST(request: Request) {
  const secret = process.env.AIRALO_WEBHOOK_SECRET;
  if (!secret) {
    logOrderError("webhook.secret.missing");
    return jsonServerError("webhook_secret_missing", "Webhook secret is not configured.");
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-airalo-signature");

  if (!isValidSignature(rawBody, signature, secret)) {
    logOrderWarn("webhook.signature.invalid", {
      hasSignature: Boolean(signature),
      bodySha256: createHash("sha256").update(rawBody).digest("hex"),
    });

    recordWebhookMetrics({
      eventType: "unknown",
      result: "rejected",
      durationMs: 0,
      reason: "invalid_signature",
    });
    return jsonUnauthorized("invalid_signature", "Invalid signature.");
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
      const existing = await tx.webhookEvent.findUnique({ where: { eventId } });
      if (existing) {
        return { status: "duplicate" as const };
      }

      const orderClauses = buildWebhookOrderClauses(payload.data);

      const order = await tx.esimOrder.findFirst({
        where: { OR: orderClauses },
        include: { profiles: true },
      });

      const eventRecord = await tx.webhookEvent
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
