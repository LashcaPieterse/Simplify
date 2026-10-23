import prisma from "./db/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "simplify-admin-session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function envValue(name: "ADMIN_SESSION_SECRET" | "ADMIN_EMAIL" | "ADMIN_PASSWORD") {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function envCredentials() {
  const email = envValue("ADMIN_EMAIL");
  const password = envValue("ADMIN_PASSWORD");
  if (!email || !password) {
    return null;
  }

  return {
    email: email.toLowerCase(),
    password,
  };
}

function adminAllowlist(): Set<string> {
  const values = (process.env.ADMIN_ALLOWED_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

export function isAdminEmailAllowed(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const allowed = adminAllowlist();
  return allowed.size === 0 || allowed.has(normalizedEmail);
}

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function hmacHex(payload: string, secret: string) {
  if (!cachedKey || cachedSecret !== secret) {
    cachedSecret = secret;
    cachedKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }

  const signature = await crypto.subtle.sign(
    "HMAC",
    cachedKey,
    new TextEncoder().encode(payload)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildToken(email: string, issuedAt: number, secret: string, version: number) {
  const payload = `v2|${email}|${issuedAt}|${version}`;
  const signature = await hmacHex(payload, secret);
  return `${payload}|${signature}`;
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return null;
  const secret = envValue("ADMIN_SESSION_SECRET");
  if (!secret) return null;

  const parts = token.split("|");
  if (parts.length !== 5 || parts[0] !== "v2") return null;
  const [, email, issuedAtRaw, versionRaw, signature] = parts;
  const payload = parts.slice(0, 4).join("|");
  const expected = await hmacHex(payload, secret);
  if (signature.length !== expected.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index++) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (mismatch) return null;
  const version = Number(versionRaw);
  if (!Number.isSafeInteger(version) || version < 0) return null;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() || issuedAt < 0) return null;
  const expiresAt = issuedAt + SESSION_TTL_SECONDS * 1000;
  if (Date.now() > expiresAt) return null;

  return { email, version, issuedAt: new Date(issuedAt), expiresAt: new Date(expiresAt) };
}

export async function requireAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const state = session ? await prisma.adminAuthState.findUnique({ where: { id: "admin" } }) : null;
  const isAllowed = session ? isAdminEmailAllowed(session.email) && state?.version === session.version : false;

  if (!session || !isAllowed) {
    // This guard also runs during Server Component rendering. Cookie mutations
    // belong in login/logout actions; a revoked cookie can safely reach login.
    redirect("/admin/login");
  }

  return session;
}

export async function createAdminSession(email: string) {
  const secret = envValue("ADMIN_SESSION_SECRET");
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET must be configured before creating admin sessions.");
  }

  const state = await prisma.adminAuthState.upsert({ where: { id: "admin" }, update: {}, create: { id: "admin" } });
  const token = await buildToken(email, Date.now(), secret, state.version);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export function validateAdminCredentials(email: string, password: string) {
  const credentials = envCredentials();
  if (!credentials) return false;

  const { email: expectedEmail, password: expectedPassword } = credentials;
  const equal = (left: string, right: string) => {
    const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right);
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
    return difference === 0;
  };
  return equal(email, expectedEmail) && equal(password, expectedPassword);
}

export async function requestHasValidSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return Boolean(session && isAdminEmailAllowed(session.email));
}

export async function revokeAdminSessions(actor: string) {
  await prisma.$transaction(async tx => {
    await tx.adminAuthState.upsert({ where: { id: "admin" }, create: { id: "admin", version: 1 }, update: { version: { increment: 1 } } });
    await tx.auditLog.create({ data: { action: "admin.sessions-revoked", entityType: "AdminAuthState", entityId: "admin", details: JSON.stringify({ actor }) } });
  });
}
