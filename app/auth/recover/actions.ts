"use server";

import { redirect } from "next/navigation";
import prisma from "@/lib/db/client";
import { requireVerifiedCustomerSession, safeReturnPath } from "@/lib/auth/customer";
import { hashPassword } from "@/lib/auth/password";

export async function setRecoveredPassword(form: FormData) {
  const session = await requireVerifiedCustomerSession("/auth/recover");
  const password = form.get("password");
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) throw new Error("Use a password with at least 8 characters and no more than 72 UTF-8 bytes.");
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: session.user!.id! } });
    if (!user.emailProofAt || user.recoveryRequired) throw new Error("Fresh email verification is required.");
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordResetRequired: false, authVersion: { increment: 1 } } });
    await tx.auditLog.create({ data: { action: "identity.password-reset", entityType: "User", entityId: user.id } });
  });
  redirect(`/auth/signin?callbackUrl=${encodeURIComponent(safeReturnPath(form.get("returnTo")))}`);
}
