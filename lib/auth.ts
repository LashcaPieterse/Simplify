import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "simplify-admin-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function secretKey() {
  return process.env.ADMIN_SESSION_SECRET ?? "dev-session-secret";
}

function envCredentials() {
  return {
    email: process.env.ADMIN_EMAIL ?? "admin@simplify.com",
    password: process.env.ADMIN_PASSWORD ?? "admin1234",
  };
}

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function hmacHex(payload: string) {
  const secret = secretKey();
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

async function buildToken(email: string, issuedAt: number) {
  const payload = `${email}|${issuedAt}`;
  const signature = await hmacHex(payload);
  return `${payload}|${signature}`;
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [email, issuedAtRaw, signature] = parts;
  const payload = `${email}|${issuedAtRaw}`;
  if ((await hmacHex(payload)) !== signature) return null;

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
  const token = await buildToken(email, Date.now());
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
  const { email: expectedEmail, password: expectedPassword } = envCredentials();
  return email === expectedEmail && password === expectedPassword;
}

export async function requestHasValidSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return Boolean(session);
}
