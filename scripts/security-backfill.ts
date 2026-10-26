import prisma from "../lib/db/client";
import { paymentState } from "../lib/payments/transitions";
import { seedLifecycleWork } from "../lib/jobs/lifecycle";

async function main() {
  const apply = process.argv.includes("--apply");
  const payments = await prisma.paymentTransaction.findMany({ where: { provider: "dpo", providerCode: null }, take: 100, orderBy: { createdAt: "asc" } });
  console.log(JSON.stringify({ action: "payment-backfill-inventory", candidates: payments.length, apply }));
  if (!apply) return;
  for (const payment of payments) {
    // Existing approval is preserved; raw 000 without trusted completion is reverified.
    const code = /^\d{3}$/.test(payment.status) ? payment.status : null;
    const status = payment.status === "approved" ? "approved" : code && code !== "000" ? paymentState(code) : "verification_error";
    await prisma.paymentTransaction.updateMany({ where: { id: payment.id, version: payment.version, providerCode: null }, data: {
      status, providerCode: code ?? "legacy", approvedAt: status === "approved" ? payment.approvedAt ?? payment.updatedAt : null, version: { increment: 1 },
    } });
  }
  await seedLifecycleWork(prisma, 100);
}
main().catch(() => { console.error("Payment backfill failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
