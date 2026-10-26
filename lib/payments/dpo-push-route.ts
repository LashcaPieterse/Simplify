import { randomUUID } from "node:crypto";
import { enforceRates } from "../security/rate-limit";
import { readBoundedText, BodyError } from "../http/bounded-body";
import { reconcilePayment } from "../jobs/lifecycle";
import prismaClient from "../db/client";
import {
  recordPaymentEvent,
} from "./checkouts";
import { handleDpoPushPayment } from "./dpo-ipn";

export async function handleDpoPushRoute(request: Request): Promise<Response> {
  let rawBody: string;
  try { rawBody = await readBoundedText(request, 256 * 1024); } catch (error) { return new Response("Invalid callback body.", { status: error instanceof BodyError ? error.status : 400 }); }
  const contentType = request.headers.get("content-type");

  const result = await handleDpoPushPayment({
    rawBody,
    contentType,
    deps: {
      findPaymentTransactionByToken: (token) =>
        prismaClient.paymentTransaction.findFirst({
          where: { transactionToken: token },
          select: {
            id: true,
            checkoutId: true,
            amountCents: true,
            currency: true,
          },
        }),
      findPaymentTransactionByReference: (reference) =>
        prismaClient.paymentTransaction.findFirst({
          where: { providerReference: reference },
          select: {
            id: true,
            checkoutId: true,
            amountCents: true,
            currency: true,
          },
        }),
      findPaymentTransactionByCheckoutId: (checkoutId) =>
        prismaClient.paymentTransaction.findFirst({
          where: { checkoutId },
          select: {
            id: true,
            checkoutId: true,
            amountCents: true,
            currency: true,
          },
        }),
      recordPaymentEvent: (transactionId, eventType, payload) =>
        recordPaymentEvent(transactionId, eventType, payload, {
          prisma: prismaClient,
        }),
      verifyPaymentTransaction: async transactionId => {
        await reconcilePayment(transactionId, prismaClient);
        return { paymentStatus: "pending" };
      },
    },
  });

  const correlationId = randomUUID();
  try {
    await enforceRates([{ scope: "callback-diagnostics", identifier: "dpo", limit: 60, windowSeconds: 60 }]);
    await prismaClient.paymentCallbackDiagnostic.create({ data: { correlationId, status: result.status, result: result.status === 200 ? "matched_notification" : "rejected_unmatched_or_unavailable" } });
  } catch { /* Diagnostics must not change the gateway's callback acknowledgement. */ }
  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "X-Correlation-ID": correlationId,
    },
  });
}
