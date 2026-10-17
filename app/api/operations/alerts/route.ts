import { NextResponse } from "next/server";

import prisma from "@/lib/db/client";
import { sendEmail } from "@/lib/notifications/email";
import { productionAlertStore, readAlertConfig } from "@/lib/operations/alert-store";
import { runProductionAlerts } from "@/lib/operations/alerts";
import { authenticateRecoveryRequest } from "@/lib/orders/recovery-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!authenticateRecoveryRequest(request.headers, process.env.AIRALO_SYNC_CRON_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const config = await readAlertConfig(prisma);
    if (!config?.enabled) return NextResponse.json({ ok: false, enabled: false }, { status: 503 });
    const result = await runProductionAlerts({
      store: productionAlertStore(prisma, config), send: sendEmail,
      recipient: config.recipient, sender: config.sender,
    });
    console.info("operations.alerts.completed", result);
    return NextResponse.json({ ...result, enabled: true }, { status: result.ok ? 200 : 503 });
  } catch {
    console.error("operations.alerts.failed");
    return NextResponse.json({ ok: false, error: "Production alert monitor failed" }, { status: 503 });
  }
}
