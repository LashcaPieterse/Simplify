import { NextResponse } from "next/server";

import { syncAiraloPackages } from "@/lib/catalog/sync";
import prisma from "@/lib/db/client";
import { sendEmail } from "@/lib/notifications/email";

const ALERT_RECIPIENT = process.env.AIRALO_SYNC_ALERT_EMAIL ?? "pieterselashca@gmail.com";

export const dynamic = "force-dynamic";

async function notifyFailure(error: unknown) {
  const failureReason = error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error);
  const timestamp = new Date().toISOString();

  await sendEmail({
    to: ALERT_RECIPIENT,
    subject: "Airalo package sync failed",
    text: `The hourly Airalo package sync failed at ${timestamp}.\n\n${failureReason}`,
  });
}

export async function GET() {
  const startedAt = new Date();

  try {
    const result = await syncAiraloPackages({ logger: console });

    return NextResponse.json({
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error("[airalo-sync] Failed to sync Airalo packages", error);

    try {
      await notifyFailure(error);
    } catch (notificationError) {
      console.error("[airalo-sync] Failed to send failure notification", notificationError);
    }

    return NextResponse.json({ error: "Airalo sync failed" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
