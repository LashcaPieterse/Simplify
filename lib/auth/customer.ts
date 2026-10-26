import type { Route } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";
import { safeReturnPath } from "./return-path";
export { safeReturnPath } from "./return-path";

export async function requireVerifiedCustomerSession(returnTo = "/account/esims") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(safeReturnPath(returnTo))}`);
  if (!session.user.emailProofVerified || session.user.recoveryRequired) {
    redirect(`/auth/recover?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}` as Route);
  }
  return session;
}
