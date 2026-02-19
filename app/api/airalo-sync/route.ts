import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { syncAiraloPackages } from "@/lib/catalog/sync";
import { sendEmail } from "@/lib/notifications/email";

const ALERT_RECIPIENT = process.env.AIRALO_SYNC_ALERT_EMAIL ?? "pieterselashca@gmail.com";

export const dynamic = "force-dynamic";

interface TokenProbeResult {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
  token: string | null;
}

async function requestFreshTokenForDebug(): Promise<TokenProbeResult> {
  const clientId = (process.env.AIRALO_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.AIRALO_CLIENT_SECRET ?? "").trim();
  const baseUrl = (process.env.AIRALO_BASE_URL ?? "https://partners-api.airalo.com/v2").trim().replace(/\/+$/, "");

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      status: 500,
      statusText: "Missing credentials",
      body: { error: "AIRALO_CLIENT_ID/AIRALO_CLIENT_SECRET are not configured" },
      token: null,
    };
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "client_credentials");

  const response = await fetch(`${baseUrl}/token`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Airalo-Debug-Token-Probe": String(Date.now()),
    },
    body,
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep raw text when JSON parsing fails
  }

  const token =
    parsed && typeof parsed === "object" && "data" in parsed
      ? (((parsed as { data?: { access_token?: unknown } }).data?.access_token as string | undefined) ?? null)
      : null;

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: parsed,
    token,
  };
}


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

  console.info("[airalo-sync][step-1][request] Incoming request", {
    path: request.nextUrl.pathname,
    debug: wantsDebug,
    method: request.method,
  });

  if (!isAuthorized(request)) {
    console.warn("[airalo-sync][step-1][auth] Unauthorized request", {
      path: request.nextUrl.pathname,
      hasHeaderKey: Boolean(request.headers.get("x-airalo-sync-key")),
      hasQueryKey: Boolean(request.nextUrl.searchParams.get("key")),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.info("[airalo-sync][step-1][auth] Authorization passed");

  try {
    if (wantsDebug) {
      console.info("[airalo-sync][debug] Debug diagnostics requested");
      const clientId = process.env.AIRALO_CLIENT_ID ?? "";
      const clientSecret = process.env.AIRALO_CLIENT_SECRET ?? "";
      const databaseUrl = process.env.DATABASE_URL ?? "";
      const trimmedClientId = clientId.trim();
      const trimmedClientSecret = clientSecret.trim();
      const wantsTokenProbe =
        request.nextUrl.searchParams.get("token") === "1" ||
        request.nextUrl.searchParams.get("token") === "true";

      if (wantsTokenProbe) {
        const probe = await requestFreshTokenForDebug();
        console.warn("[airalo-sync][debug][token-probe] Fresh token probe requested; logging full token for Postman validation", {
          status: probe.status,
          statusText: probe.statusText,
          token: probe.token,
        });

        return NextResponse.json({
          debug: true,
          tokenProbe: probe,
          warning:
            "This response includes a full access token for manual Postman validation. Treat it as sensitive and rotate if shared.",
        });
      }

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
          airaloSyncTestTokenPresent: Boolean(process.env.AIRALO_SYNC_TEST_TOKEN),
          airaloSyncTestTokenFingerprint: fingerprint(process.env.AIRALO_SYNC_TEST_TOKEN?.trim()),
          tokenProbeHint: "Add ?debug=1&token=1 to request and return a fresh full access token for Postman testing.",
        },
      });
    }

    console.info("[airalo-sync][step-2/3] Starting Airalo sync job");
    const result = await syncAiraloPackages({ logger: console });
    console.info("[airalo-sync][step-3][packages] Sync completed", result);

    revalidatePath("/");
    revalidatePath("/country", "layout");
    revalidatePath("/plan", "layout");

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
  }
}
