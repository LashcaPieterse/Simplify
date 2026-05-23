import { NextResponse } from "next/server";

import prismaClient from "@/lib/db/client";
import {
  finaliseOrderFromCheckout,
  recordPaymentEvent,
  setCheckoutStatus,
  updatePaymentStatus,
} from "@/lib/payments/checkouts";
import { handleDpoIpn } from "@/lib/payments/dpo-ipn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-dpo-signature");
  const contentType = request.headers.get("content-type");

  const result = await handleDpoIpn({
    rawBody,
    signature,
    contentType,
    secret: process.env.DPO_IPN_SECRET,
    nodeEnv: process.env.NODE_ENV,
    deps: {
      findPaymentTransaction: (token) =>
        prismaClient.paymentTransaction.findFirst({
          where: {
            OR: [{ transactionToken: token }, { providerReference: token }],
          },
          select: {
            id: true,
            checkoutId: true,
          },
        }),
      recordPaymentEvent,
      updatePaymentStatus,
      finaliseOrderFromCheckout: async (checkoutId, options) => {
        try {
          return await finaliseOrderFromCheckout(checkoutId, {
            prisma: prismaClient,
            forceStatus: options.forceStatus,
          });
        } catch (error) {
          console.error("Failed to finalise order from checkout", error);
          throw error;
        }
      },
      setCheckoutStatus: (checkoutId, status) =>
        setCheckoutStatus(checkoutId, status, { prisma: prismaClient }),
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
