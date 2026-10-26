import prisma from "@/lib/db/client";
import { formatCurrencyWithCode } from "@/lib/format";
import { requireVerifiedCustomerSession } from "@/lib/auth/customer";
import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default async function AccountPaymentsPage() {
  const session = await requireVerifiedCustomerSession("/account/payments");

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/account/payments")}`);
  }

  const payments = await prisma.paymentTransaction.findMany({ where: { userId: session.user.id, ownershipReviewRequired: false }, select: { id: true, amountCents: true, currency: true, status: true, createdAt: true, refunds: { select: { amountCents: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-brand-900">Payment security</h2>
      <p className="mt-2 text-sm text-brand-600">
        SIM.Africa does not store raw card details. Payments are securely handled by the configured payment provider.
      </p>
      {payments.length ? <section className="mt-5 space-y-3" aria-label="Recent payments">{payments.map(payment => { const refunded = payment.refunds.filter(refund => refund.status === "confirmed").reduce((sum, refund) => sum + refund.amountCents, 0); const pending = payment.refunds.some(refund => ["reserved", "unknown"].includes(refund.status)); return <div key={payment.id} className="rounded-xl border border-brand-100 p-4 text-sm"><p className="font-semibold">{formatCurrencyWithCode(payment.amountCents, payment.currency)} · {payment.status}</p>{refunded ? <p className="mt-1">Confirmed refund: {formatCurrencyWithCode(refunded, payment.currency)}. Bank processing times may vary.</p> : null}{pending ? <p className="mt-1">A refund is being reconciled. Please contact support if you need an update.</p> : null}</div>; })}</section> : null}
      <div className="mt-5 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-6 text-sm text-brand-700">
        SIM.Africa does not offer saved payment methods. The configured payment provider collects the required payment details during each secure checkout.
      </div>
    </div>
  );
}
