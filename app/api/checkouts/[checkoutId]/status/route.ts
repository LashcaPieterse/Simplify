import { NextResponse } from "next/server";
import { authorizedCheckout, checkoutStatusResponse } from "@/lib/payments/checkout-status";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ checkoutId: string }> }) {
  const { checkoutId } = await context.params;
  try {
    const checkout = await authorizedCheckout(request, checkoutId);
    if (!checkout) return NextResponse.json({ message: "Checkout not found." }, { status: 404 });
    return checkoutStatusResponse(checkout);
  } catch { return NextResponse.json({ message: "Checkout status is temporarily unavailable." }, { status: 503 }); }
}
