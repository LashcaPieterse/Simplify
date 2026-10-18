import { createHmac, timingSafeEqual } from "node:crypto";
import { DAY_MS, REFERRAL_DAYS, normalizeAffiliateCode } from "./rules";

export const REFERRAL_COOKIE = "sim-africa-referral";

function referralSecret(): string | null {
  const value = process.env.AFFILIATE_REFERRAL_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

export function affiliateInfrastructureEnabled(): boolean {
  return process.env.AFFILIATE_PROGRAM_ENABLED === "true";
}

export function canRememberReferral(): boolean {
  return Boolean(referralSecret());
}

export function signReferral(code: string, now = Date.now()): string {
  const secret = referralSecret();
  if (!secret) throw new Error("Referral storage is temporarily unavailable.");
  const payload = Buffer.from(JSON.stringify({ code: normalizeAffiliateCode(code), issuedAt: now, expiresAt: now + REFERRAL_DAYS * DAY_MS })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function readReferral(token?: string | null, now = Date.now()): string | null {
  const secret = referralSecret();
  if (!secret || !token || token.length > 1000) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.code !== "string" || !/^[A-Z0-9]{8,32}$/.test(data.code) || !Number.isSafeInteger(data.issuedAt) || !Number.isSafeInteger(data.expiresAt)) return null;
    if (data.issuedAt > now || data.expiresAt <= now || data.expiresAt - data.issuedAt !== REFERRAL_DAYS * DAY_MS) return null;
    return data.code;
  } catch { return null; }
}
