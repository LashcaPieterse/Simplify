import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { syncAiraloPackages } from "@/lib/catalog/sync";
import prisma from "@/lib/db/client";
import { sendEmail } from "@/lib/notifications/email";

const ALERT_RECIPIENT = process.env.AIRALO_SYNC_ALERT_EMAIL ?? "pieterselashca@gmail.com";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronToken = process.env.AIRALO_SYNC_CRON_TOKEN;

  if (!cronToken) return true;

  const headerToken = request.headers.get("x-airalo-sync-key");
  const queryToken = request.nextUrl.searchParams.get("key");

  return headerToken === cronToken || queryToken === cronToken;
}

function fingerprint(value?: string | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function notifyFailure(error: unknown) {
  const failureReason = error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error);
  const timestamp = new Date().toISOString();

  await sendEmail({
    to: ALERT_RECIPIENT,
    subject: "Airalo package sync failed",
    text: `The hourly Airalo package sync failed at ${timestamp}.\n\n${failureReason}`,
  });
}

export async function GET(request: NextRequest) {
  const startedAt = new Date();
  const debugFlag = request.nextUrl.searchParams.get("debug");
  const wantsDebug = debugFlag === "1" || debugFlag === "true";

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (wantsDebug) {
      const clientId = process.env.AIRALO_CLIENT_ID ?? "";
      const clientSecret = process.env.AIRALO_CLIENT_SECRET ?? "";
      const databaseUrl = process.env.DATABASE_URL ?? "";
      const trimmedClientId = clientId.trim();
      const trimmedClientSecret = clientSecret.trim();

      return NextResponse.json({
        debug: true,
        env: {
          vercelEnv: process.env.VERCEL_ENV ?? null,
          vercelUrl: process.env.VERCEL_URL ?? null,
          nodeEnv: process.env.NODE_ENV ?? null,
          airaloBaseUrl:
            process.env.AIRALO_BASE_URL ?? "https://partners-api.airalo.com/v2",
          airaloClientIdPresent: Boolean(clientId),
          airaloClientSecretPresent: Boolean(clientSecret),
          airaloClientIdLength: clientId.length,
          airaloClientSecretLength: clientSecret.length,
          airaloClientIdTrimmedLength: trimmedClientId.length,
          airaloClientSecretTrimmedLength: trimmedClientSecret.length,
          airaloClientIdHasOuterWhitespace: trimmedClientId.length !== clientId.length,
          airaloClientSecretHasOuterWhitespace:
            trimmedClientSecret.length !== clientSecret.length,
          airaloClientIdFingerprint: fingerprint(trimmedClientId),
          airaloClientSecretFingerprint: fingerprint(trimmedClientSecret),
          databaseUrlPresent: Boolean(databaseUrl),
          cronTokenPresent: Boolean(process.env.AIRALO_SYNC_CRON_TOKEN),
        },
      });
    }

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
