import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/db/client";
import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonServerError,
} from "@/lib/api/errors";
import { authOptions } from "@/lib/auth/options";
import {
  canAccessOwnerScopedRecord,
  canIssueScopedAccessTokens,
  hasScopedAccessFromCookieHeader,
  setScopedAccessCookie,
} from "@/lib/orders/access";
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
    const session = await getServerSession(authOptions);
    const checkoutAccess = await prisma.checkoutSession.findUnique({
      where: { id: checkoutId },
      select: { id: true, userId: true },
    });

    if (!checkoutAccess) {
      return jsonNotFound("checkout_not_found", "Checkout not found.");
    }

    const hasCheckoutToken = hasScopedAccessFromCookieHeader(
      request.headers.get("cookie"),
      "checkout",
      checkoutId,
    );
    if (
      !canAccessOwnerScopedRecord(checkoutAccess, session, hasCheckoutToken)
    ) {
      return jsonForbidden(
        "checkout_access_denied",
        "You do not have access to this checkout.",
      );
    }

    const summary = await getCheckoutSummary(checkoutId);

    if (!summary) {
      return jsonNotFound("checkout_not_found", "Checkout not found.");
    }

    let paymentStatus = summary.paymentStatus;
    let orderId = summary.orderId;
    let redirectOrderId = summary.redirectOrderId ?? null;
    let message: string | undefined;

    if (!orderId) {
      const verification = await verifyCheckoutPayment(checkoutId);
      paymentStatus = verification.paymentStatus;
      orderId = verification.orderId ?? null;
      redirectOrderId = verification.redirectOrderId ?? redirectOrderId;
      message = verification.message;
    }

    const response = NextResponse.json({
      checkoutId: summary.id,
      status: summary.status,
      paymentStatus,
      orderId,
      redirectOrderId,
      message,
      paymentUrl: summary.paymentUrl,
    });

    if (orderId && canIssueScopedAccessTokens()) {
      setScopedAccessCookie(response.cookies, "order", orderId);
    }
    if (
      redirectOrderId &&
      redirectOrderId !== orderId &&
      canIssueScopedAccessTokens()
    ) {
      setScopedAccessCookie(response.cookies, "order", redirectOrderId);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch checkout status.";
    return jsonServerError("checkout_status_failed", message);
  }
}
