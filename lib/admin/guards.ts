import { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

function adminAllowlist(): Set<string> {
  const values = (process.env.ADMIN_ALLOWED_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

export async function requireAdminApiSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  const allowed = adminAllowlist();
  if (allowed.size === 0 || allowed.has(session.email.toLowerCase())) {
    return session;
  }

  return null;
}
