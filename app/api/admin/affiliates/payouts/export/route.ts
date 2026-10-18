import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";
import { requireAdminApiSession } from "@/lib/admin/guards";
import { affiliateInfrastructureEnabled } from "@/lib/affiliates/referral";
import { csvCell } from "@/lib/affiliates/rules";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!await requireAdminApiSession(request)) return new NextResponse("Unauthorized", { status: 401 });
  if (!affiliateInfrastructureEnabled()) return new NextResponse("Program unavailable", { status: 503 });
  const id = request.nextUrl.searchParams.get("id");
  const payouts = await prisma.affiliatePayout.findMany({ where: { ...(id ? { id } : {}), status: { in: ["prepared", "processing"] } }, orderBy: { createdAt: "asc" }, include: { affiliate: { select: { legalName: true, contactEmail: true, code: true, country: true } } } });
  if (id && !payouts.length) return new NextResponse("Payout is unavailable or no longer transferable", { status: 409 });
  const rows = [
    ["Payout ID", "Guide", "Code", "Contact email", "Country", "Currency", "Amount", "Period", "Status"],
    ...payouts.map(payout => [payout.id, payout.affiliate.legalName, payout.affiliate.code, payout.affiliate.contactEmail, payout.affiliate.country, payout.currency, (payout.amountCents / 100).toFixed(2), payout.period, payout.status]),
  ];
  return new NextResponse(rows.map(row => row.map(csvCell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="affiliate-payouts.csv"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
