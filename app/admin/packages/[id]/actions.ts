"use server";

import prisma from "@/lib/db/client";
import { revalidatePath } from "next/cache";

export async function updateSellingPrice(packageId: string, sellingPriceCents: number) {
  await prisma.airaloPackage.update({
    where: { id: packageId },
    data: { sellingPriceCents, updatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      action: "package.price.updated",
      entityType: "AiraloPackage",
      entityId: packageId,
      details: JSON.stringify({ sellingPriceCents }),
    },
  });
  revalidatePath(`/admin/packages/${packageId}`);
}

export async function updateStatus(packageId: string, isActive: boolean) {
  await prisma.airaloPackage.update({
    where: { id: packageId },
    data: { isActive, deactivatedAt: isActive ? null : new Date() },
  });
  await prisma.auditLog.create({
    data: {
      action: isActive ? "package.activated" : "package.deactivated",
      entityType: "AiraloPackage",
      entityId: packageId,
      details: JSON.stringify({ isActive }),
    },
  });
  revalidatePath(`/admin/packages/${packageId}`);
}

export async function saveTags(packageId: string, tags: string[]) {
  const sanitized = tags.map((t) => t.trim()).filter(Boolean);
  const tagRecords = await Promise.all(
    sanitized.map((name) =>
      prisma.packageTag.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  await prisma.airaloPackageTag.deleteMany({ where: { packageId } });
  await prisma.airaloPackageTag.createMany({
    data: tagRecords.map((tag) => ({ packageId, tagId: tag.id })),
  });
  await prisma.auditLog.create({
    data: {
      action: "package.tags.updated",
      entityType: "AiraloPackage",
      entityId: packageId,
      details: JSON.stringify({ tags: sanitized }),
    },
  });
  revalidatePath(`/admin/packages/${packageId}`);
}

export async function addNote(packageId: string, body: string) {
  await prisma.packageNote.create({ data: { packageId, body } });
  await prisma.auditLog.create({
    data: {
      action: "package.note.added",
      entityType: "AiraloPackage",
      entityId: packageId,
      details: JSON.stringify({ body }),
    },
  });
  revalidatePath(`/admin/packages/${packageId}`);
}
