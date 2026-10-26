import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin/guards";
import prisma from "@/lib/db/client";
import { isCatalogPriceFresh } from "@/lib/catalog/retail-prices";

export async function GET(request: NextRequest) {
  if (!(await requireAdminApiSession(request))) return NextResponse.json({ message: "Administrator sign-in required." }, { status: 401 });
  const orderId = request.nextUrl.searchParams.get("targetId")?.slice(0, 200);
  const packageId = request.nextUrl.searchParams.get("packageId")?.slice(0, 200);
  if (!orderId) return NextResponse.json({ message: "Order reference required." }, { status: 400 });
  try {
    const order = await prisma.esimOrder.findUniqueOrThrow({ where: { id: orderId }, include: { package: true, checkout: true, saleCheckout: true } });
    const pkg = await prisma.package.findUniqueOrThrow({ where: { id: packageId || order.packageId }, include: { state: true, operator: { include: { country: true } } } });
    const topUp = (order.saleCheckout ?? order.checkout)?.intent === "top-up";
    if (pkg.netPrice === null || !Number.isFinite(Number(pkg.netPrice)) || Number(pkg.netPrice) < 0) return NextResponse.json({ message: "Supplier cost is unavailable. Sync the catalogue before authorizing a replacement." }, { status: 409 });
    if (!pkg.state?.isActive || !isCatalogPriceFresh(pkg.state.lastSyncedAt) || pkg.type !== (topUp ? "topup" : "sim")) return NextResponse.json({ message: "Choose a fresh, active package of the same purchase type." }, { status: 409 });
    const previewVersion = createHash("sha256").update(`${pkg.id}:${pkg.updatedAt.toISOString()}:${pkg.netPrice ?? pkg.price}`).digest("hex");
    const supplierOrigin = new URL(process.env.AIRALO_BASE_URL ?? "https://partners-api.airalo.com/v2").origin;
    return NextResponse.json({ previewVersion, packageId: pkg.id, summary: `${pkg.title} · ${pkg.data} · ${pkg.day} days · ${pkg.operator.country.title} · ${pkg.operator.title}. Supplier USD unit cost: ${pkg.netPrice!.toString()}. Supplier environment: ${supplierOrigin}. Customer charge: zero. ${pkg.id === order.packageId ? "Same package as the original purchase." : `Replaces ${order.package.title}; confirm coverage, allowance and validity suit the customer.`}${topUp ? " The original ICCID and live top-up eligibility will be checked before purchase." : ""}` }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ message: "Package preview unavailable. Verify the order and package references." }, { status: 409 }); }
}
