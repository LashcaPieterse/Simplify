import prismaClient from "../db/client";
import {
  recordPaymentEvent,
  setCheckoutStatus,
  updatePaymentStatus,
  verifyPaymentTransaction,
} from "./checkouts";
import { handleDpoPushPayment } from "./dpo-ipn";

export async function handleDpoPushRoute(request: Request): Promise<Response> {
  const rawBody = await request.text();
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
      recordPaymentEvent: (transactionId, eventType, payload) =>
        recordPaymentEvent(transactionId, eventType, payload, {
          prisma: prismaClient,
        }),
      updatePaymentStatus: (transactionId, status, options) =>
        updatePaymentStatus(transactionId, status, {
          prisma: prismaClient,
          metadata: options.metadata,
        }),
      verifyPaymentTransaction: (transactionId) =>
        verifyPaymentTransaction(transactionId, {
          prisma: prismaClient,
          source: "dpo-push",
        }),
      setCheckoutStatus: (checkoutId, status) =>
        setCheckoutStatus(checkoutId, status, { prisma: prismaClient }),
    },
  });

  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
