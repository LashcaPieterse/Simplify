import { NextResponse } from "next/server";

import { getCheckoutSummary, verifyCheckoutPayment } from "@/lib/payments/checkouts";

export const dynamic = "force-dynamic";

interface Params {
  checkoutId: string;
}

export async function GET(request: Request, context: { params: Params }) {
  const { checkoutId } = context.params;

  if (!checkoutId) {
    return NextResponse.json({ message: "Checkout ID is required." }, { status: 400 });
  }

  try {
    const summary = await getCheckoutSummary(checkoutId);

    if (!summary) {
      return NextResponse.json({ message: "Checkout not found." }, { status: 404 });
    }

    let paymentStatus = summary.paymentStatus;
    let orderId = summary.orderId;

    if (!orderId) {
      const verification = await verifyCheckoutPayment(checkoutId);
      paymentStatus = verification.paymentStatus;
      orderId = verification.orderId ?? null;
    }

    return NextResponse.json({
      checkoutId: summary.id,
      status: summary.status,
      paymentStatus,
      orderId,
      paymentUrl: summary.paymentUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch checkout status.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
