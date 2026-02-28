"use server";

import prisma from "@/lib/db/client";
import { revalidatePath } from "next/cache";

export async function updateSellingPrice(packageId: string, sellingPriceCents: number) {
  await prisma.package.update({
    where: { id: packageId },
    data: { sellingPriceCents, updatedAt: new Date() },
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
  await prisma.package.update({
    where: { id: packageId },
    data: { isActive, deactivatedAt: isActive ? null : new Date() },
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
