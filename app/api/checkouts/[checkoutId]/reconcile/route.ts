import { handleCheckoutReconcileRoute } from "@/lib/payments/checkout-reconcile-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request, context: { params: Promise<{ checkoutId: string }> }) {
  const { checkoutId } = await context.params;
  return handleCheckoutReconcileRoute(request, checkoutId);
}
