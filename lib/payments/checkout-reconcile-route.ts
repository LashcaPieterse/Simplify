import { enforceRates, trustedClientIp, abuseResponse } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import prismaClient from "../db/client";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { authorizedCheckout, checkoutStatusResponse } from "@/lib/payments/checkout-status";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { requestPaymentProcessing, processPaymentWorkflow } from "@/lib/jobs/lifecycle";

export async function handleCheckoutReconcileRoute(request: Request, checkoutId: string, options: {
  prisma?: PrismaClient;
  authorize?: typeof authorizedCheckout;
  afterResponse?: (work: () => Promise<void>) => void;
  process?: typeof processPaymentWorkflow;
} = {}) {
  const db = options.prisma ?? prismaClient;
  const authorize = options.authorize ?? authorizedCheckout;
  const afterResponse = options.afterResponse ?? after;
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const checkout = await authorize(request, checkoutId, db);
    if (!checkout) return NextResponse.json({ message: "Checkout not found." }, { status: 404 });
    await enforceRates([
      { scope: "reconcile-checkout", identifier: checkoutId, limit: 1, windowSeconds: 15 },
      { scope: "reconcile-ip", identifier: trustedClientIp(request.headers), limit: 10, windowSeconds: 60 },
    ], db);
    const correlationId = randomUUID();
    const payment = checkout.payments[0];
    if (payment) {
      await requestPaymentProcessing(payment.id, db, "browser", correlationId);
      afterResponse(async () => {
        try { await (options.process ?? processPaymentWorkflow)(payment.id, db, { trigger: "browser", correlationId }); }
        catch { console.error("checkout.processing.failed", { paymentId: payment.id, trigger: "browser", correlationId }); }
      });
    }
    const current = await authorize(request, checkoutId, db);
    if (!current) return NextResponse.json({ message: "Checkout not found." }, { status: 404 });
    const response = await checkoutStatusResponse(current, db);
    response.headers.set("X-Correlation-ID", correlationId);
    return response;
  } catch (error) { const limited = abuseResponse(error); if (limited) return limited; return NextResponse.json({ message: "Payment is being checked. Please do not pay again." }, { status: 503 }); }
}
