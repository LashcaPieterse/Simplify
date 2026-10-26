import { NextRequest, NextResponse } from "next/server";
import { readJsonBody, BodyError } from "@/lib/http/bounded-body";
import { z } from "zod";
import prisma from "@/lib/db/client";
import { andPackageWhere, isUuid, publicSellablePackageWhere } from "@/lib/catalog/package-policy";
import { resolveRetailPrices } from "@/lib/catalog/retail-prices";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
  const parsed = z.object({ packageIds: z.array(z.string().min(1).max(200)).max(100) }).safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json({ message: "Provide at most 100 package IDs." }, { status: 422 });
  const ids = Array.from(new Set(parsed.data.packageIds));
  const records = await prisma.package.findMany({
    where: andPackageWhere(publicSellablePackageWhere(), { OR: [{ airaloPackageId: { in: ids } }, { id: { in: ids.filter(isUuid) } }] }),
    select: { id: true, airaloPackageId: true, pricesRecommendedRetailPrice: true },
  });
  return NextResponse.json({ packages: records.flatMap(pkg => {
    const prices = resolveRetailPrices(pkg.pricesRecommendedRetailPrice);
    return prices ? [{ id: pkg.id, externalId: pkg.airaloPackageId, prices }] : [];
  }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof BodyError ? error.message : "Prices are temporarily unavailable." }, { status: error instanceof BodyError ? error.status : 503 });
  }
}
