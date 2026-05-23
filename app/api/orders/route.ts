import { NextResponse } from "next/server";

import { jsonApiError, jsonForbidden, jsonServerError } from "@/lib/api/errors";
import {
  OrderOutOfStockError,
  OrderServiceError,
  OrderValidationError,
  createOrder,
} from "@/lib/orders/service";

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
    return jsonApiError(error.status, "order_out_of_stock", error.message);
  }

  if (error instanceof OrderValidationError) {
    return jsonApiError(error.status, "order_validation_error", error.message, {
      issues: error.issues,
    });
  }

  if (error instanceof OrderServiceError) {
    return jsonApiError(error.status, "order_service_error", error.message);
  }

  return jsonServerError("order_create_failed", "Unexpected error while creating the order.");
}

export async function POST(request: Request) {
  if (!hasValidBearerToken(request)) {
    return jsonForbidden(
      "direct_order_creation_disabled",
      "Direct order creation is no longer available. Use the checkout flow.",
    );
  }

  const body = await parseBody(request);

  if (!body) {
    return jsonApiError(422, "invalid_request_body", "Request body must be JSON.");
  }

  try {
    const result = await createOrder(body, { submissionMode: "sync" });

    return NextResponse.json({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      requestId: result.requestId,
      ...(result.installation ? { installation: result.installation } : {}),
    });
  } catch (error: unknown) {
    console.error("Failed to create order", error);
    return buildErrorResponse(error);
  }
}
