import { NextRequest, NextResponse } from "next/server";
import { findPublicGuide, getAffiliateProgram } from "@/lib/affiliates/program";
import { isAffiliateSameOrigin, affiliateAppOrigin } from "@/lib/affiliates/http";
import { REFERRAL_COOKIE, readReferral, signReferral } from "@/lib/affiliates/referral";
import { safeReferralDestination, REFERRAL_DAYS } from "@/lib/affiliates/rules";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const program = await getAffiliateProgram();
  const code = request.nextUrl.searchParams.get("code")?.slice(0, 33) || readReferral(request.cookies.get(REFERRAL_COOKIE)?.value);
  const guide = code ? await findPublicGuide(code) : null;
  return NextResponse.json({ enabled: Boolean(program?.enabled && program.defaultRateBps), guide }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isAffiliateSameOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const form = await request.formData();
  const code = String(form.get("code") ?? "").slice(0, 33);
  const destination = safeReferralDestination(String(form.get("to") ?? ""));
  const response = NextResponse.redirect(new URL(destination, affiliateAppOrigin(request.url)), 303);
  response.headers.set("Cache-Control", "private, no-store");
  if (form.get("remember") === "yes") {
    const guide = await findPublicGuide(code);
    if (!guide) return NextResponse.json({ message: "This guide referral is no longer active." }, { status: 422 });
    response.cookies.set(REFERRAL_COOKIE, signReferral(guide.code), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: REFERRAL_DAYS * 86400 });
  } else {
    response.cookies.set(REFERRAL_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isAffiliateSameOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(REFERRAL_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
