"use server";

import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateStatus(packageId: string, isActive: boolean, reason: string) {
  const session = await requireAdminSession();
  if (!/^[a-f0-9-]{36}$/i.test(packageId) || typeof isActive !== "boolean" || reason.trim().length < 5 || reason.length > 500) throw new Error("Enter a valid package and a reason of at least five characters.");

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
      details: JSON.stringify({ isActive, actor: session.email, reason: reason.trim() }),
    },
  });
  revalidatePath(`/admin/packages/${packageId}`);
  revalidatePath("/", "layout");
}
