"use server";

import prisma from "@/lib/db/client";
import { revalidatePath } from "next/cache";

export async function applyRegionMarkup(countryId: string, percent: number) {
  const packages = await prisma.package.findMany({ where: { countryId } });
  for (const pkg of packages) {
    const selling = pkg.priceCents + Math.round((pkg.priceCents * percent) / 100);
    await prisma.package.update({ where: { id: pkg.id }, data: { sellingPriceCents: selling } });
    await prisma.auditLog.create({
      data: {
        action: "package.bulk-price",
        entityType: "Package",
        entityId: pkg.id,
        details: JSON.stringify({ percent, source: "markup", countryId }),
      },
    });
  }
  revalidatePath("/admin/operations");
}

export async function saveBulkPrices(updates: { id: string; sellingPriceCents: number }[]) {
  for (const update of updates) {
    await prisma.package.update({ where: { id: update.id }, data: { sellingPriceCents: update.sellingPriceCents } });
    await prisma.auditLog.create({
      data: {
        action: "package.bulk-price",
        entityType: "Package",
        entityId: update.id,
        details: JSON.stringify({ sellingPriceCents: update.sellingPriceCents }),
      },
    });
  }
  revalidatePath("/admin/operations");
}
