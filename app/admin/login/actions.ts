"use server";

import { createAdminSession, clearAdminSession, validateAdminCredentials } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { redirect } from "next/navigation";

export async function loginAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");

  const isValid = validateAdminCredentials(email, password);
  if (!isValid) {
    return { success: false, error: "Invalid credentials" } as const;
  }

  createAdminSession(email);
  await prisma.auditLog.create({
    data: {
      action: "admin.login",
      entityType: "AdminUser",
      entityId: email,
      details: JSON.stringify({ email }),
    },
  });

  return { success: true } as const;
}

export async function logoutAdmin() {
  clearAdminSession();
  redirect("/admin/login");
}
