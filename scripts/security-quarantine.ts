import prisma from "../lib/db/client";

async function main() {
  const cutoff = new Date(process.argv.find(arg => arg.startsWith("--before="))?.slice(9) ?? "invalid");
  if (!Number.isFinite(cutoff.getTime()) || cutoff > new Date()) throw new Error("Specify --before=<past ISO timestamp>.");
  const where = { emailProofAt: null, recoveryRequired: false, createdAt: { lt: cutoff } };
  const count = await prisma.user.count({ where });
  console.log(JSON.stringify({ action: "quarantine-inventory", cutoff: cutoff.toISOString(), uncertainAccounts: count }));
  if (!process.argv.includes("--apply")) return;
  if (!process.argv.includes("--recovery-delivery-verified")) throw new Error("Verify the recovery sender and journey before activation; then pass --recovery-delivery-verified.");
  let changed = 0;
  while (true) {
    const users = await prisma.user.findMany({ where, orderBy: { id: "asc" }, take: 25, select: { id: true, passwordHash: true } });
    if (!users.length) break;
    for (const user of users) {
      await prisma.$transaction(async tx => {
        const claimed = await tx.user.updateMany({ where: { id: user.id, ...where }, data: {
          recoveryRequired: true, passwordResetRequired: Boolean(user.passwordHash), authVersion: { increment: 1 },
        } });
        if (!claimed.count) return;
        await tx.userIdentity.updateMany({ where: { userId: user.id }, data: { quarantined: true } });
        await tx.checkoutSession.updateMany({ where: { userId: user.id }, data: { ownershipReviewRequired: true, accessVersion: { increment: 1 } } });
        await tx.esimOrder.updateMany({ where: { userId: user.id }, data: { ownershipReviewRequired: true, accessVersion: { increment: 1 } } });
        await tx.paymentTransaction.updateMany({ where: { userId: user.id }, data: { ownershipReviewRequired: true } });
        await tx.auditLog.create({ data: { action: "identity.quarantined", entityType: "User", entityId: user.id, details: JSON.stringify({ cutoff: cutoff.toISOString() }) } });
        changed++;
      });
    }
  }
  console.log(JSON.stringify({ action: "quarantine-completed", changed }));
}
main().catch(() => { console.error("Quarantine stopped; inspect configuration and retry the same cutoff."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
