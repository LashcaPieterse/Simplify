import prisma from "../db/client";
import { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminEmailAllowed, verifySessionToken } from "@/lib/auth";

export async function requireAdminApiSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  const state = await prisma.adminAuthState.findUnique({ where: { id: "admin" } });
  if (state?.version === session.version && isAdminEmailAllowed(session.email)) {
    return session;
  }

  return null;
}
