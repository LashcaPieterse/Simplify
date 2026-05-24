import { NextResponse } from "next/server";

import {
  setScopedAccessCookie,
  verifyScopedAccessToken,
} from "@/lib/orders/access";

export const dynamic = "force-dynamic";

type OrderAccessRouteContext = {
  params: {
    orderId: string;
  };
};

export async function GET(
  request: Request,
  { params }: OrderAccessRouteContext,
) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const orderId = decodeURIComponent(params.orderId);

  if (!verifyScopedAccessToken(token, "order", orderId)) {
    return new NextResponse("Order link is invalid or expired.", {
      status: 403,
    });
  }

  const destination = new URL(`/orders/${encodeURIComponent(orderId)}`, url);
  const response = NextResponse.redirect(destination);
  setScopedAccessCookie(response.cookies, "order", orderId);
  return response;
}
