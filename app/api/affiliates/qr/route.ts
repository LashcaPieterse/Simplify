import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import QRCode from "qrcode";
import prisma from "@/lib/db/client";
import { authOptions } from "@/lib/auth/options";
import { affiliateInfrastructureEnabled } from "@/lib/affiliates/referral";
import { affiliateAppOrigin } from "@/lib/affiliates/http";
import { safeReferralDestination } from "@/lib/affiliates/rules";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  if (!affiliateInfrastructureEnabled()) return new NextResponse("Program unavailable", { status: 503 });
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId: session.user.id }, select: { code: true, status: true } });
  if (profile?.status !== "approved") return new NextResponse("Guide approval is required", { status: 403 });
  const destination = safeReferralDestination(request.nextUrl.searchParams.get("to"));
  const link = `${affiliateAppOrigin(request.url)}/r/${profile.code}?to=${encodeURIComponent(destination)}`;
  const svg = await QRCode.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 440 });
  return new NextResponse(svg, { headers: {
    "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    ...(request.nextUrl.searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="sim-africa-guide-${profile.code}.svg"` } : {}),
  } });
}
