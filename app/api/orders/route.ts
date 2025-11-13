import { NextResponse } from "next/server";

import {
  OrderOutOfStockError,
  OrderServiceError,
  OrderValidationError,
  createOrder,
} from "@/lib/orders/service";

const allowedOrigins = (process.env.ORDERS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function hasValidBearerToken(request: Request): boolean {
  const expected = process.env.ORDERS_API_SECRET;
  if (!expected) {
    return false;
  }

  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice("Bearer ".length).trim();
  return token === expected;
}

function isAllowedOrigin(request: Request): boolean {
  if (hasValidBearerToken(request)) {
    return true;
  }

  if (allowedOrigins.length === 0) {
    const originHeader = request.headers.get("origin");
    if (!originHeader) {
      return false;
    }

    const requestUrl = new URL(request.url);
    const expectedOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
    return originHeader === expectedOrigin;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  return allowedOrigins.includes(origin);
}

async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function buildErrorResponse(error: unknown): NextResponse {
  if (error instanceof OrderOutOfStockError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  if (error instanceof OrderValidationError) {
    return NextResponse.json(
      {
        message: error.message,
        issues: error.issues,
      },
      { status: error.status },
    );
  }

  if (error instanceof OrderServiceError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return NextResponse.json({ message: "Unexpected error while creating the order." }, { status: 500 });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(request);

  if (!body) {
    return NextResponse.json({ message: "Request body must be JSON." }, { status: 422 });
  }

  try {
    const result = await createOrder(body);

    return NextResponse.json({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    });
  } catch (error: unknown) {
    console.error("Failed to create order", error);
    return buildErrorResponse(error);
  }
}
