import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { CheckoutRedirector } from "@/components/checkout/CheckoutRedirector";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { PaymentStatusBanner } from "@/components/checkout/PaymentStatusBanner";
import prisma from "@/lib/db/client";
import { authOptions } from "@/lib/auth/options";
import {
  canAccessOwnerScopedRecord,
  hasScopedAccessFromCookieStore,
} from "@/lib/orders/access";
import { getCheckoutSummary } from "@/lib/payments/checkouts";

interface CheckoutPageProps {
  params: { checkoutId: string };
}

async function requireCheckoutAccess(checkoutId: string): Promise<void> {
  const checkout = await prisma.checkoutSession.findUnique({
    where: { id: checkoutId },
    select: { id: true, userId: true },
  });

  if (!checkout) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const hasCheckoutToken = hasScopedAccessFromCookieStore(
    cookies(),
    "checkout",
    checkoutId,
  );

  if (canAccessOwnerScopedRecord(checkout, session, hasCheckoutToken)) {
    return;
  }

  if (checkout.userId && !session?.user?.id) {
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/checkout/${checkoutId}`)}`,
    );
  }

  notFound();
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  await requireCheckoutAccess(params.checkoutId);
  const summary = await getCheckoutSummary(params.checkoutId);

  if (!summary) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Complete your purchase</h1>
        <p className="text-sm text-slate-600">
          You&apos;re almost there. Review your plan and continue to the secure payment page.
        </p>
      </div>
      <PaymentStatusBanner status={summary.paymentStatus ?? "pending"} />
      <CheckoutSummary
        packageName={summary.packageName}
        packageDescription={summary.packageDescription}
        quantity={summary.quantity}
        totalCents={summary.totalCents}
        currency={summary.currency}
      />
      {summary.paymentUrl ? <CheckoutRedirector paymentUrl={summary.paymentUrl} /> : null}
    </div>
  );
}
