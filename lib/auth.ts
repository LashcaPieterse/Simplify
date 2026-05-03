import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "simplify-admin-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

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

async function buildToken(email: string, issuedAt: number, secret: string) {
  const payload = `${email}|${issuedAt}`;
  const signature = await hmacHex(payload, secret);
  return `${payload}|${signature}`;
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return null;
  const secret = envValue("ADMIN_SESSION_SECRET");
  if (!secret) return null;

  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [email, issuedAtRaw, signature] = parts;
  const payload = `${email}|${issuedAtRaw}`;
  if ((await hmacHex(payload, secret)) !== signature) return null;

  const issuedAt = Number(issuedAtRaw);
  if (Number.isNaN(issuedAt)) return null;
  const expiresAt = issuedAt + SESSION_TTL_SECONDS * 1000;
  if (Date.now() > expiresAt) return null;

  return { email, issuedAt: new Date(issuedAt), expiresAt: new Date(expiresAt) };
}

export async function requireAdminSession() {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

export async function createAdminSession(email: string) {
  const secret = envValue("ADMIN_SESSION_SECRET");
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET must be configured before creating admin sessions.");
  }

  const token = await buildToken(email, Date.now(), secret);
  cookies().set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export function clearAdminSession() {
  cookies().delete(ADMIN_SESSION_COOKIE);
}

export function validateAdminCredentials(email: string, password: string) {
  const credentials = envCredentials();
  if (!credentials) return false;

  const { email: expectedEmail, password: expectedPassword } = credentials;
  return email === expectedEmail && password === expectedPassword;
}

export async function requestHasValidSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return Boolean(session);
}
