import { Prisma, type PrismaClient } from "@prisma/client";

export type EmailProofSource = "email" | "google" | "apple";
const normalize = (email: string) => email.trim().toLowerCase();

/** Only consume claims obtained by NextAuth's verified provider callback. */
export function verifiedOAuthEmail(provider: string, profile: unknown, email: string): boolean {
  if (!profile || typeof profile !== "object") return false;
  const claims = profile as Record<string, unknown>;
  const verified = provider === "google"
    ? claims.email_verified === true
    : provider === "apple" && (claims.email_verified === true || claims.email_verified === "true");
  return verified && typeof claims.email === "string" && normalize(claims.email) === normalize(email);
}

export async function recordEmailProof(db: PrismaClient, input: {
  userId: string; email: string; source: EmailProofSource; providerAccountId?: string;
}) {
  const email = normalize(input.email);
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
        if (normalize(user.email) !== email) throw new Error("Verified provider email does not match this account.");
        // A pre-registered password/identity is untrusted until the FIRST proof,
        // even if the historical quarantine batch has not reached this account yet.
        const recovering = !user.emailProofAt || user.recoveryRequired || user.passwordResetRequired;
        const now = new Date();
        const updated = await tx.user.update({ where: { id: user.id }, data: {
          email, emailProofAt: now, emailProofSource: input.source, emailVerifiedAt: now,
          recoveryRequired: false,
          ...(recovering ? { authVersion: { increment: 1 }, passwordHash: null, passwordResetRequired: Boolean(user.passwordHash || user.passwordResetRequired) } : {}),
        } });
        if (recovering) {
          await tx.userIdentity.updateMany({ where: { userId: user.id }, data: { quarantined: true } });
          await tx.esimOrder.updateMany({ where: { userId: user.id }, data: { ownershipReviewRequired: true, accessVersion: { increment: 1 } } });
          await tx.checkoutSession.updateMany({ where: { userId: user.id }, data: { ownershipReviewRequired: true, accessVersion: { increment: 1 } } });
          await tx.paymentTransaction.updateMany({ where: { userId: user.id }, data: { ownershipReviewRequired: true } });
        }
        if (input.source !== "email" && input.providerAccountId) {
          await tx.userIdentity.updateMany({ where: { userId: user.id, provider: input.source, providerUserId: input.providerAccountId }, data: { quarantined: false, email } });
        }
        const customerEmail = { equals: email, mode: Prisma.QueryMode.insensitive };
        // Review flags are cleared only for matching ownership; nothing is reassigned.
        const orders = await tx.esimOrder.updateMany({ where: { customerEmail, OR: [{ userId: null }, { userId: user.id }] }, data: { userId: user.id, ownershipReviewRequired: false } });
        const checkouts = await tx.checkoutSession.updateMany({ where: { customerEmail, OR: [{ userId: null }, { userId: user.id }] }, data: { userId: user.id, ownershipReviewRequired: false } });
        const payments = await tx.paymentTransaction.updateMany({ where: {
          OR: [{ userId: null }, { userId: user.id }],
          AND: [{ OR: [
            { checkout: { is: { userId: user.id, customerEmail, ownershipReviewRequired: false } } },
            { orders: { some: { userId: user.id, customerEmail, ownershipReviewRequired: false } } },
          ] }],
        }, data: { userId: user.id, ownershipReviewRequired: false } });
        await tx.auditLog.create({ data: { action: "identity.email-proof", entityType: "User", entityId: user.id,
          details: JSON.stringify({ source: input.source, recovered: recovering, orders: orders.count, checkouts: checkouts.count, payments: payments.count }) } });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}
