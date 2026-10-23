import { enforceRates, trustedClientIp, abuseResponse } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { authorizedCheckout, checkoutStatusResponse } from "@/lib/payments/checkout-status";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { reconcilePayment } from "@/lib/jobs/lifecycle";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ checkoutId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const { checkoutId } = await context.params;
  try {
    const checkout = await authorizedCheckout(request, checkoutId);
    if (!checkout) return NextResponse.json({ message: "Checkout not found." }, { status: 404 });
    await enforceRates([
      { scope: "reconcile-checkout", identifier: checkoutId, limit: 1, windowSeconds: 15 },
      { scope: "reconcile-ip", identifier: trustedClientIp(request.headers), limit: 10, windowSeconds: 60 },
    ]);
    if (checkout.payments[0]) await reconcilePayment(checkout.payments[0].id);
    const current = await authorizedCheckout(request, checkoutId);
    if (!current) return NextResponse.json({ message: "Checkout not found." }, { status: 404 });
    return checkoutStatusResponse(current);
  } catch (error) { const limited = abuseResponse(error); if (limited) return limited; return NextResponse.json({ message: "Payment is being checked. Please do not pay again." }, { status: 503 }); }
}
