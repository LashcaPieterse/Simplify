import { NextResponse } from "next/server";
import prisma from "@/lib/db/client";

import {
  setScopedAccessCookie,
  verifyScopedAccessToken,
} from "@/lib/orders/access";

export const dynamic = "force-dynamic";

type OrderAccessRouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: OrderAccessRouteContext,
) {
  const { orderId: encodedOrderId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const orderId = decodeURIComponent(encodedOrderId);

  const order = await prisma.esimOrder.findUnique({ where: { id: orderId }, select: { accessVersion: true } });
  if (!order || !verifyScopedAccessToken(token, "order", orderId, { accessVersion: order.accessVersion })) {
    return new NextResponse("Order link is invalid or expired.", {
      status: 403,
    });
  }

  const destination = new URL(`/orders/${encodeURIComponent(orderId)}`, url);
  const response = NextResponse.redirect(destination);
  setScopedAccessCookie(response.cookies, "order", orderId, order.accessVersion);
  return response;
}
