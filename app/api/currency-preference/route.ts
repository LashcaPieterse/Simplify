import { isSameOriginRequest } from "@/lib/http/same-origin";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";
import { authOptions } from "@/lib/auth/options";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_SECONDS, isCurrency } from "@/lib/currency";

export const dynamic = "force-dynamic";
async function preference(request: NextRequest, update: boolean) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const session = await getServerSession(authOptions);
    const browserCurrency = request.cookies.get(CURRENCY_COOKIE)?.value;
    const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, preferredCurrency: true } }) : null;
    const incoming = update ? (await request.json()).currency : undefined;
    if (update && !isCurrency(incoming)) return NextResponse.json({ message: "Choose USD, NAD, ZAR, EUR or GBP." }, { status: 422 });
    const currency = update ? incoming : isCurrency(user?.preferredCurrency) ? user.preferredCurrency : isCurrency(browserCurrency) ? browserCurrency : "USD";
    // Adoption is an explicit PUT from the client after authentication; GET remains read-only.
    if (update && user) await prisma.user.update({ where: { id: user.id }, data: { preferredCurrency: currency } });
    const response = NextResponse.json({ currency, needsAdoption: Boolean(user && !isCurrency(user.preferredCurrency)) }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(CURRENCY_COOKIE, currency, { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: CURRENCY_COOKIE_SECONDS });
    return response;
  } catch {
    return NextResponse.json({ message: "Currency preferences are temporarily unavailable." }, { status: 503 });
  }
}
export async function GET(request: NextRequest) { return preference(request, false); }
export async function PUT(request: NextRequest) { return preference(request, true); }
