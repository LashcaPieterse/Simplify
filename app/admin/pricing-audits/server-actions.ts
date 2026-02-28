"use server";

import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";

export async function resolvePricingAuditAction(formData: FormData) {
  const session = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");

  if (!id || !["resolved", "ignored"].includes(action)) {
    throw new Error("Invalid audit action payload");
  }

  await prisma.pricingAudit.update({
    where: { id },
    data: {
      status: action,
      resolvedBy: session.email,
      resolvedAt: new Date(),
      resolutionNotes: action === "ignored" ? "Ignored from admin portal" : "Resolved from admin portal",
    },
  });
}
