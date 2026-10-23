"use server";
import { headers } from "next/headers";
import { enforceRates, refundRates, trustedClientIp, AbuseError } from "@/lib/security/rate-limit";

import {
  createAdminSession,
  clearAdminSession,
  isAdminEmailAllowed,
  validateAdminCredentials,
} from "@/lib/auth";
import prisma from "@/lib/db/client";
import { redirect } from "next/navigation";

export async function loginAdmin(formData: FormData) {
  try {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (email.length > 254 || password.length > 1024) return { success: false, error: "Invalid credentials" } as const;
  const reservations = await enforceRates([
    { scope: "admin-login-ip", identifier: trustedClientIp(await headers()), limit: 5, windowSeconds: 900 },
    { scope: "admin-login-account", identifier: email, limit: 20, windowSeconds: 3600 },
  ]);
  if (!isAdminEmailAllowed(email)) {
    return { success: false, error: "Invalid credentials" } as const;
  }

  const isValid = validateAdminCredentials(email, password);
  if (!isValid) {
    return { success: false, error: "Invalid credentials" } as const;
  }

  await refundRates(reservations);
  await createAdminSession(email);
  await prisma.auditLog.create({
    data: {
      action: "admin.login",
      entityType: "AdminUser",
      entityId: email,
      details: JSON.stringify({ email }),
    },
  });

  return { success: true } as const;
  } catch (error) {
    return { success: false, error: error instanceof AbuseError ? error.message : "Sign-in is temporarily unavailable.", status: error instanceof AbuseError ? error.status : 503, retryAfter: error instanceof AbuseError ? error.retryAfter : 60 } as const;
  }
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}
