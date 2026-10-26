import { readJsonBody, BodyError } from "@/lib/http/bounded-body";
import { limitCheckout, abuseResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth/options";
import { createCheckoutQuote, newQuoteSessionId, QUOTE_SESSION_COOKIE } from "@/lib/payments/quotes";
import { CheckoutRequestError } from "@/lib/payments/checkout-request";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const session = await getServerSession(authOptions);
    const guestSessionId = request.cookies.get(QUOTE_SESSION_COOKIE)?.value ?? newQuoteSessionId();
    await limitCheckout(request.headers, guestSessionId);
    const quote = await createCheckoutQuote(await readJsonBody(request) as Parameters<typeof createCheckoutQuote>[0], { userId: (session?.user?.emailProofVerified && !session.user.recoveryRequired ? session.user.id : undefined), guestSessionId });
    const response = NextResponse.json(quote, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(QUOTE_SESSION_COOKIE, guestSessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
    return response;
  } catch (error) {
    const limited = abuseResponse(error);
    if (limited) return limited;
    if (error instanceof BodyError) return NextResponse.json({ message: error.message }, { status: error.status });
    const status = error instanceof CheckoutRequestError ? error.status : error instanceof ZodError ? 422 : 503;
    if (status === 503) console.error("payments.quote.unavailable", { name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ message: status === 503 ? "Checkout quotes are temporarily unavailable." : error instanceof Error ? error.message : "Invalid quote request." }, { status });
  }
}
