import { NextResponse } from "next/server";

import { jsonBadRequest, jsonNotFound, jsonServerError } from "@/lib/api/errors";
import { getCheckoutSummary, verifyCheckoutPayment } from "@/lib/payments/checkouts";

export const dynamic = "force-dynamic";

interface Params {
  checkoutId: string;
}

export async function GET(request: Request, context: { params: Params }) {
  const { checkoutId } = context.params;

  if (!checkoutId) {
    return jsonBadRequest("checkout_id_required", "Checkout ID is required.");
  }

  try {
    const summary = await getCheckoutSummary(checkoutId);

    if (!summary) {
      return jsonNotFound("checkout_not_found", "Checkout not found.");
    }

    let paymentStatus = summary.paymentStatus;
    let orderId = summary.orderId;
    let message: string | undefined;

    if (!orderId) {
      const verification = await verifyCheckoutPayment(checkoutId);
      paymentStatus = verification.paymentStatus;
      orderId = verification.orderId ?? null;
      message = verification.message;
    }

    return NextResponse.json({
      checkoutId: summary.id,
      status: summary.status,
      paymentStatus,
      orderId,
      message,
      paymentUrl: summary.paymentUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch checkout status.";
    return jsonServerError("checkout_status_failed", message);
  }
}
