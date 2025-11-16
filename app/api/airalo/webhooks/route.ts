import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/client";
import { logOrderError, logOrderInfo } from "@/lib/observability/logging";
import { recordRateLimit, recordWebhookMetrics } from "@/lib/observability/metrics";
import { WebhookPayloadSchema, type WebhookPayload } from "@/lib/airalo/schemas";

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

function isValidSignature(body: string, signature: string | null, secret: string): boolean {
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

function resolveEventId(headers: Headers, payload: WebhookPayload, rawBody: string): string {
  const headerId =
    headers.get("x-airalo-event-id") ??
    headers.get("x-airalo-request-id") ??
    headers.get("x-request-id");

  if (headerId) {
    return headerId;
  }

  const composite = [
    payload.data.reference,
    payload.event,
    payload.data.order_id,
    payload.timestamp,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(":");

  if (composite.trim()) {
    return composite;
  }

  return createHash("sha256").update(rawBody).digest("hex");
}

interface UsageMetadata {
  usedMb?: number;
  remainingMb?: number;
}

function extractActivationCode(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const value =
    (metadata as { activation_code?: unknown }).activation_code ??
    (metadata as { activationCode?: unknown }).activationCode;

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

function readNumber(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function extractUsage(metadata: unknown): UsageMetadata | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const maybeContainer = (metadata as { usage?: unknown }).usage;
  const source = typeof maybeContainer === "object" && maybeContainer !== null ? maybeContainer : metadata;

  const usedMb =
    readNumber((source as { used_mb?: unknown }).used_mb) ??
    readNumber((source as { usedMb?: unknown }).usedMb) ??
    readNumber((source as { used?: unknown }).used);
  const remainingMb =
    readNumber((source as { remaining_mb?: unknown }).remaining_mb) ??
    readNumber((source as { remainingMb?: unknown }).remainingMb) ??
    readNumber((source as { remaining?: unknown }).remaining);

  if (usedMb === null && remainingMb === null) {
    return null;
  }

  return {
    usedMb: usedMb ?? undefined,
    remainingMb: remainingMb ?? undefined,
  };
}

export async function POST(request: Request) {
  const secret = process.env.AIRALO_WEBHOOK_SECRET;
  if (!secret) {
    logOrderError("webhook.secret.missing");
    return NextResponse.json({ message: "Webhook secret is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-airalo-signature");

  if (!isValidSignature(rawBody, signature, secret)) {
    recordWebhookMetrics({ eventType: "unknown", result: "rejected", durationMs: 0, reason: "invalid_signature" });
    return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    recordWebhookMetrics({ eventType: "unknown", result: "rejected", durationMs: 0, reason: "invalid_json" });
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  let payload: WebhookPayload;
  try {
    payload = WebhookPayloadSchema.parse(parsed);
  } catch (error: unknown) {
    logOrderError("webhook.payload.invalid", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    recordWebhookMetrics({
      eventType: "unknown",
      result: "rejected",
      durationMs: 0,
      reason: "schema_validation_failed",
    });
    return NextResponse.json({ message: "Invalid webhook payload." }, { status: 422 });
  }

  const processingStartedAt = Date.now();
  const eventId = resolveEventId(request.headers, payload, rawBody);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.webhookEvent.findUnique({ where: { eventId } });
      if (existing) {
        return { status: "duplicate" as const };
      }

      const orderClauses: Prisma.EsimOrderWhereInput[] = [
        { orderNumber: payload.data.order_id },
      ];

      if (payload.data.reference) {
        orderClauses.push({ requestId: payload.data.reference });
      }

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

        if (!order.requestId && payload.data.reference) {
          updateData.requestId = payload.data.reference;
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

    return NextResponse.json({ message: "Failed to process webhook." }, { status: 500 });
  }
}

function isWebhookDuplicateError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isPrismaRetryableTransactionError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
