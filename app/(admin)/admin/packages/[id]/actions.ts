"use server";

import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateSellingPrice(packageId: string, sellingPriceCents: number) {
  await requireAdminSession();

  await prisma.packageState.upsert({
    where: { packageId },
    create: { packageId, sellingPriceCents },
    update: { sellingPriceCents, updatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      action: "package.price.updated",
      entityType: "Package",
      entityId: packageId,
      details: JSON.stringify({ sellingPriceCents }),
    },
  });
  revalidatePath(`/admin/packages/${packageId}`);
}

export async function updateStatus(packageId: string, isActive: boolean) {
  await requireAdminSession();

  await prisma.packageState.upsert({
    where: { packageId },
    create: { packageId, isActive, deactivatedAt: isActive ? null : new Date() },
    update: { isActive, deactivatedAt: isActive ? null : new Date(), updatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      action: isActive ? "package.activated" : "package.deactivated",
      entityType: "Package",
      entityId: packageId,
      details: JSON.stringify({ isActive }),
    },
  });
  revalidatePath(`/admin/packages/${packageId}`);
}
