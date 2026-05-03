"use server";

import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function applyRegionMarkup(countryId: string, percent: number) {
  await requireAdminSession();

  const packages = await prisma.package.findMany({
    where: { operator: { is: { countryId } } },
    select: {
      id: true,
      netPrice: true,
      price: true,
      state: { select: { basePriceCents: true } },
    },
  });
  for (const pkg of packages) {
    const basePriceCents =
      pkg.state?.basePriceCents ??
      Math.round(Number(pkg.netPrice ?? pkg.price) * 100);
    const selling = basePriceCents + Math.round((basePriceCents * percent) / 100);
    await prisma.packageState.upsert({
      where: { packageId: pkg.id },
      create: { packageId: pkg.id, sellingPriceCents: selling, basePriceCents },
      update: { sellingPriceCents: selling, updatedAt: new Date() },
    });
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
  await requireAdminSession();

  for (const update of updates) {
    await prisma.packageState.upsert({
      where: { packageId: update.id },
      create: { packageId: update.id, sellingPriceCents: update.sellingPriceCents },
      update: { sellingPriceCents: update.sellingPriceCents, updatedAt: new Date() },
    });
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
