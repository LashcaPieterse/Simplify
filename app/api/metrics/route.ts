import { NextResponse } from "next/server";

import { getPrometheusRegistry } from "@/lib/observability/metrics";
import { jsonUnauthorized } from "@/lib/api/errors";

function hasValidMetricsToken(request: Request): boolean {
  const expected = process.env.METRICS_BEARER_TOKEN?.trim();

  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  return header.slice("Bearer ".length).trim() === expected;
}

export async function GET(request: Request) {
  if (!hasValidMetricsToken(request)) {
    return jsonUnauthorized(
      "metrics_access_denied",
      "A valid metrics bearer token is required.",
    );
  }

  const registry = getPrometheusRegistry();
  const body = await registry.metrics();

  return new NextResponse(body, {
    headers: {
      "Content-Type": registry.contentType,
      "Cache-Control": "no-store",
    },
  });
}
