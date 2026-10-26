import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import prisma from "../db/client";

export class AbuseError extends Error {
  constructor(readonly status: 429 | 503, readonly retryAfter = 60) {
    super(status === 429 ? "Too many attempts. Please try again later." : "This service is temporarily unavailable.");
  }
}

export function trustedClientIp(headers: Headers, env: NodeJS.ProcessEnv = process.env): string {
  // Vercel overwrites x-forwarded-for. Other ingress must explicitly strip and set its chosen header.
  const header = env.VERCEL === "1" ? "x-forwarded-for" : env.TRUSTED_CLIENT_IP_HEADER;
  if (!header) {
    if (env.NODE_ENV !== "production") return "127.0.0.1";
    throw new AbuseError(503);
  }
  const ip = headers.get(header)?.trim();
  // A chain is ambiguous: never choose an attacker-controlled prefix.
  if (!ip || !isIP(ip)) throw new AbuseError(503);
  return ip;
}

export type RateRule = { scope: string; identifier: string; limit: number; windowSeconds: number };
export async function enforceRates(rules: RateRule[], db: PrismaClient = prisma) {
  const secret = process.env.RATE_LIMIT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new AbuseError(503);
  const reservations: string[] = [];
  try {
    for (const rule of rules) {
      const digest = createHmac("sha256", secret).update(`${rule.scope}:${rule.identifier.trim().toLowerCase()}`).digest("hex");
      const rows = await db.$queryRaw<Array<{ key: string; count: number; retryAfter: number }>>`
        WITH bucket AS (
          SELECT ${digest} || ':' || floor(extract(epoch FROM clock_timestamp()) / ${rule.windowSeconds})::text AS key,
            to_timestamp((floor(extract(epoch FROM clock_timestamp()) / ${rule.windowSeconds}) + 1) * ${rule.windowSeconds}) AS expiry
        ), consumed AS (
          INSERT INTO "RateBucket" (key, count, "expiresAt") SELECT key, 1, expiry FROM bucket
          ON CONFLICT (key) DO UPDATE SET count = LEAST("RateBucket".count + 1, ${rule.limit + 1})
          RETURNING key, count, "expiresAt"
        ) SELECT key, count, GREATEST(1, ceil(extract(epoch FROM ("expiresAt" - clock_timestamp()))))::int AS "retryAfter" FROM consumed`;
      if (!rows[0]) throw new AbuseError(503);
      if (rows[0].count > rule.limit) throw new AbuseError(429, rows[0].retryAfter);
      reservations.push(rows[0].key);
    }
    return reservations;
  } catch (error) { throw error instanceof AbuseError ? error : new AbuseError(503); }
}

export async function refundRates(keys: string[], db: PrismaClient = prisma) {
  for (const key of keys) await db.$executeRaw`UPDATE "RateBucket" SET count = GREATEST(count - 1, 0) WHERE key = ${key}`;
}

export function abuseResponse(error: unknown) {
  if (!(error instanceof AbuseError)) return null;
  return NextResponse.json({ message: error.message }, { status: error.status, headers: { "Retry-After": String(error.retryAfter) } });
}

export async function limitCheckout(headers: Headers, sessionId: string) {
  return enforceRates([
    { scope: "checkout-session", identifier: sessionId, limit: 60, windowSeconds: 600 },
    { scope: "checkout-ip", identifier: trustedClientIp(headers), limit: 120, windowSeconds: 600 },
  ]);
}
