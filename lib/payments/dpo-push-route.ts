import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { enforceRates } from "../security/rate-limit";
import { readBoundedText, BodyError } from "../http/bounded-body";
import { processPaymentCallback, requestPaymentProcessing } from "../jobs/lifecycle";
import prismaClient from "../db/client";
import {
  recordPaymentEvent,
} from "./checkouts";
import { handleDpoPushPayment, type DpoPushResult } from "./dpo-push";

export async function handleDpoPushRoute(request: Request, options: {
  prisma?: PrismaClient;
  afterResponse?: (work: () => Promise<void>) => void;
  processCallback?: typeof processPaymentCallback;
} = {}): Promise<Response> {
  const db = options.prisma ?? prismaClient;
  const afterResponse = options.afterResponse ?? after;
  // Server-observed transport metadata, separate from the untrusted provider XML.
  // Exclude URL queries, headers and customer/payment data from request logs.
  const requestTrace = {
    correlationId: randomUUID(),
    pathname: new URL(request.url).pathname,
    method: request.method,
    receivedAt: new Date().toISOString(),
  };
  console.info("payments.dpo.push.received", requestTrace);
  const respond = async (result: DpoPushResult, contentType = "application/xml; charset=utf-8") => {
    console.info("payments.dpo.push.response", { ...requestTrace, status: result.status });
    try {
      await enforceRates([{ scope: "callback-diagnostics", identifier: "dpo", limit: 60, windowSeconds: 60 }], db);
      await db.paymentCallbackDiagnostic.create({ data: {
        correlationId: requestTrace.correlationId,
        status: result.status,
        result: result.status === 200 ? "matched_notification" : "rejected_unmatched_or_unavailable",
      } });
    } catch { /* Diagnostics must not change the gateway's callback acknowledgement. */ }
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": contentType, "X-Correlation-ID": requestTrace.correlationId },
    });
  };
  let rawBody: string;
  try { rawBody = await readBoundedText(request, 256 * 1024); } catch (error) {
    return respond({ body: "Invalid callback body.", status: error instanceof BodyError ? error.status : 400 }, "text/plain; charset=utf-8");
  }
  const contentType = request.headers.get("content-type");

  const result = await handleDpoPushPayment({
    rawBody,
    contentType,
    deps: {
      findPaymentTransactionByToken: (token) =>
        db.paymentTransaction.findFirst({
          where: { transactionToken: token },
          select: {
            id: true,
            checkoutId: true,
            amountCents: true,
            currency: true,
          },
        }),
      findPaymentTransactionByReference: (reference) =>
        db.paymentTransaction.findFirst({
          where: { providerReference: reference },
          select: {
            id: true,
            checkoutId: true,
            amountCents: true,
            currency: true,
          },
        }),
      findPaymentTransactionByCheckoutId: (checkoutId) =>
        db.paymentTransaction.findFirst({
          where: { checkoutId },
          select: {
            id: true,
            checkoutId: true,
            amountCents: true,
            currency: true,
          },
        }),
      recordPaymentEvent: (transactionId, eventType, payload) =>
        recordPaymentEvent(transactionId, eventType, { ...payload, request: requestTrace }, {
          prisma: db,
        }),
      verifyPaymentTransaction: async transactionId => {
        await requestPaymentProcessing(transactionId, db, "dpo_push", requestTrace.correlationId);
        afterResponse(async () => {
          try {
            await (options.processCallback ?? processPaymentCallback)(transactionId, db, { trigger: "dpo_push", correlationId: requestTrace.correlationId });
          } catch {
            // The work was persisted before acknowledgement; the recovery worker retries it.
            console.error("payments.callback.processing_failed", { transactionId, correlationId: requestTrace.correlationId });
          }
        });
        return { paymentStatus: "pending" };
      },
    },
  });

  return respond(result);
}
