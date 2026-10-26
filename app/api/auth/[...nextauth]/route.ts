import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { readBoundedText, BodyError } from "@/lib/http/bounded-body";
import { enforceRates, trustedClientIp, abuseResponse } from "@/lib/security/rate-limit";
import { withCustomerLoginReservation } from "@/lib/security/login-context";

const handler = NextAuth(authOptions);
export const GET = handler;
export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  try {
    const parts = (await context.params).nextauth;
    const raw = await readBoundedText(request.clone());
    if (parts[0] === "signin" && parts[1] === "email") {
      let email = "";
      if (request.headers.get("content-type")?.includes("application/json")) {
        try { const data = JSON.parse(raw) as { email?: unknown }; if (typeof data.email === "string") email = data.email; } catch { throw new BodyError(400, "Invalid request body."); }
      } else email = new URLSearchParams(raw).get("email") ?? "";
      if (email.length > 254) throw new BodyError(400, "Invalid email.");
      await enforceRates([
        { scope: "verification-email", identifier: email, limit: 3, windowSeconds: 3600 },
        { scope: "verification-ip", identifier: trustedClientIp(request.headers), limit: 10, windowSeconds: 3600 },
      ]);
    }
    if (parts[0] === "callback" && parts[1] === "credentials") {
      await enforceRates([{ scope: "login-ip", identifier: trustedClientIp(request.headers), limit: 30, windowSeconds: 900 }]);
      let email = "";
      if (request.headers.get("content-type")?.includes("application/json")) {
        try { const data = JSON.parse(raw) as { email?: unknown }; if (typeof data.email === "string") email = data.email; } catch { throw new BodyError(400, "Invalid request body."); }
      } else email = new URLSearchParams(raw).get("email") ?? "";
      if (email.length > 254) throw new BodyError(400, "Invalid email.");
      const failures = await enforceRates([{ scope: "login-account", identifier: email, limit: 10, windowSeconds: 900 }]);
      return await withCustomerLoginReservation(failures, () => handler(request, context));
    }
    return await handler(request, context);
  } catch (error) {
    return abuseResponse(error) ?? NextResponse.json({ message: error instanceof BodyError ? error.message : "Authentication is temporarily unavailable." }, { status: error instanceof BodyError ? error.status : 503 });
  }
}
