"use server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { enforceRates, trustedClientIp, AbuseError } from "@/lib/security/rate-limit";

const registration = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).refine(value => Buffer.byteLength(value, "utf8") <= 72, "Password must fit in 72 UTF-8 bytes."),
  name: z.string().trim().max(160),
});
export async function registerWithPassword(formData: FormData) {
  try {
    await enforceRates([{ scope: "signup-ip", identifier: trustedClientIp(await headers()), limit: 5, windowSeconds: 3600 }]);
    const parsed = registration.safeParse({ email: formData.get("email"), password: formData.get("password"), name: formData.get("name") ?? "" });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form fields." };
    const { email, password, name } = parsed.data;
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { email, name: name || null, passwordHash } });
      await tx.userIdentity.create({ data: { userId: user.id, provider: "credentials", providerUserId: user.id, type: "credentials", email } });
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AbuseError) return { success: false, error: error.message, status: error.status, retryAfter: error.retryAfter };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, error: "Unable to create this account. Try signing in or recovering your email." };
    return { success: false, error: "Account creation is temporarily unavailable." };
  }
}
