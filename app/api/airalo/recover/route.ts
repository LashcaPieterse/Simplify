import { NextResponse } from "next/server";

import { recoverAiraloOrders } from "@/lib/orders/recovery";
import { authenticateRecoveryRequest } from "@/lib/orders/recovery-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!authenticateRecoveryRequest(request.headers, process.env.AIRALO_SYNC_CRON_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await recoverAiraloOrders({ limit: 5 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Airalo recovery job failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}
