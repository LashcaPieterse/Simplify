import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Session } from "next-auth";

const TOKEN_VERSION = "v2";
const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60 * 24 * 14;

export type ScopedAccessScope = "checkout" | "order";

export type SessionLike = Pick<Session, "user"> | null | undefined;

export type OwnerScopedRecord = {
  userId?: string | null;
  ownershipReviewRequired?: boolean;
};

export type CookieSetter = {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      maxAge: number;
      path: string;
    },
  ) => void;
};

function resolveAccessSecret(): string | null {
  const value = process.env.ORDER_ACCESS_SECRET ?? process.env.NEXTAUTH_SECRET;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveRequiredAccessSecret(): string {
  const secret = resolveAccessSecret();
  if (!secret) {
    throw new Error(
      "ORDER_ACCESS_SECRET or NEXTAUTH_SECRET must be configured to issue guest access tokens.",
    );
  }

  return secret;
}

export function canIssueScopedAccessTokens(): boolean {
  return Boolean(resolveAccessSecret());
}

function scopedValue(scope: ScopedAccessScope, id: string): string {
  return `${scope}:${id}`;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function scopedAccessCookieName(
  scope: ScopedAccessScope,
  id: string,
): string {
  const digest = createHash("sha256")
    .update(scopedValue(scope, id))
    .digest("hex")
    .slice(0, 20);
  return `simplify-${scope}-access-${digest}`;
}

export function createScopedAccessToken(
  scope: ScopedAccessScope,
  id: string,
  options: { issuedAt?: number; ttlSeconds?: number; accessVersion?: number } = {},
): string {
  const secret = resolveRequiredAccessSecret();
  const issuedAt = options.issuedAt ?? Date.now();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS;
  const payload = [
    TOKEN_VERSION,
    scope,
    id,
    String(issuedAt),
    String(ttlSeconds),
    String(options.accessVersion ?? 0),
  ].join("|");
  const signature = signPayload(payload, secret);
  return `${payload}|${signature}`;
}

export function createOrderAccessLink(
  orderId: string,
  baseUrl: string,
  options: { issuedAt?: number; ttlSeconds?: number; accessVersion?: number } = {},
): string {
  const url = new URL(`/orders/${encodeURIComponent(orderId)}/access`, baseUrl);
  url.searchParams.set(
    "token",
    createScopedAccessToken("order", orderId, options),
  );
  return url.toString();
}

export function verifyScopedAccessToken(
  token: string | null | undefined,
  scope: ScopedAccessScope,
  id: string,
  options: { now?: number; accessVersion?: number } = {},
): boolean {
  const secret = resolveAccessSecret();
  if (!token || !secret) {
    return false;
  }

  const parts = token.split("|");
  if (parts.length !== 6 && parts.length !== 7) {
    return false;
  }

  const [version, tokenScope, tokenId, issuedAtRaw, ttlRaw] = parts;
  const tokenVersion = version === "v1" && parts.length === 6 ? 0 : version === TOKEN_VERSION && parts.length === 7 ? Number(parts[5]) : -1;
  const signature = parts[parts.length - 1];
  if (tokenVersion !== (options.accessVersion ?? 0) || tokenScope !== scope || tokenId !== id) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  const ttlSeconds = Number(ttlRaw);
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(ttlSeconds) ||
    ttlSeconds <= 0
  ) {
    return false;
  }

  const expiresAt = issuedAt + ttlSeconds * 1000;
  const now = options.now ?? Date.now();
  if (now > expiresAt || issuedAt > now + 60_000) {
    return false;
  }

  const payload = parts.slice(0, -1).join("|");
  return safeEqual(signPayload(payload, secret), signature);
}

export function setScopedAccessCookie(
  cookies: CookieSetter,
  scope: ScopedAccessScope,
  id: string,
  accessVersion = 0,
): void {
  const token = createScopedAccessToken(scope, id, { accessVersion });
  cookies.set(scopedAccessCookieName(scope, id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DEFAULT_ACCESS_TTL_SECONDS,
    path: "/",
  });
}

export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const pair of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = pair.trim().split("=");
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValueParts.join("="));
      } catch {
        return rawValueParts.join("=");
      }
    }
  }

  return null;
}

export function hasScopedAccessFromCookieHeader(
  cookieHeader: string | null | undefined,
  scope: ScopedAccessScope,
  id: string,
  accessVersion = 0,
): boolean {
  const token = readCookieValue(cookieHeader, scopedAccessCookieName(scope, id));
  return verifyScopedAccessToken(token, scope, id, { accessVersion });
}

export function hasScopedAccessFromCookieStore(
  cookieStore: { get: (name: string) => { value?: string } | undefined },
  scope: ScopedAccessScope,
  id: string,
  accessVersion = 0,
): boolean {
  const token = cookieStore.get(scopedAccessCookieName(scope, id))?.value;
  return verifyScopedAccessToken(token, scope, id, { accessVersion });
}

export function isSessionOwner(
  record: OwnerScopedRecord,
  session: SessionLike,
): boolean {
  const sessionUserId = session?.user?.id;
  return Boolean(!record.ownershipReviewRequired && !session?.user?.recoveryRequired && session?.user?.emailProofVerified !== false && record.userId && sessionUserId && record.userId === sessionUserId);
}

export function canAccessOwnerScopedRecord(
  record: OwnerScopedRecord,
  session: SessionLike,
  hasScopedToken: boolean,
): boolean {
  return isSessionOwner(record, session) || hasScopedToken;
}

export function canStartTopUpCheckout(
  record: OwnerScopedRecord,
  session: SessionLike,
): boolean {
  return isSessionOwner(record, session);
}
