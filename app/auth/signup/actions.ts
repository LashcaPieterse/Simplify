"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";

export async function registerWithPassword(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string)?.trim() || null;

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.passwordHash) {
      return { success: false, error: "This email is already registered via social login. Use Google to sign in." };
    }
    return { success: false, error: "An account with this email already exists. Try logging in." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  await prisma.userIdentity.create({
    data: {
      userId: user.id,
      provider: "credentials",
      providerUserId: user.id,
      type: "credentials",
      email: user.email,
    },
  });

  revalidatePath("/");
  // Sign them in; note: next-auth/react signIn cannot be used server-side in app router server actions
  return { success: true };
}
