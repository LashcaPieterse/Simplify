"use server";

import prisma from "@/lib/db/client";

export async function credentialsExist(email: string) {
  if (!email) return false;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return Boolean(user?.passwordHash);
}
