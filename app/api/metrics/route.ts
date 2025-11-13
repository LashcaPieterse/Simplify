import { NextResponse } from "next/server";

import { getPrometheusRegistry } from "@/lib/observability/metrics";

export async function GET() {
  const registry = getPrometheusRegistry();
  const body = await registry.metrics();

  return new NextResponse(body, {
    headers: {
      "Content-Type": registry.contentType,
      "Cache-Control": "no-store",
    },
  });
}
