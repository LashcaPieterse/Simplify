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
  params: Promise<{ checkoutId: string }>;
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
  const cookieStore = await cookies();
  const hasCheckoutToken = hasScopedAccessFromCookieStore(
    cookieStore,
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
  const { checkoutId } = await params;
  await requireCheckoutAccess(checkoutId);
  const summary = await getCheckoutSummary(checkoutId);

  if (!summary) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-brand-900 sm:text-5xl">Complete your purchase</h1>
        <p className="text-sm leading-6 text-brand-600">
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
        destination={summary.destination}
        dataLabel={summary.dataLabel}
        validityDays={summary.validityDays}
        customerEmail={summary.customerEmail}
      />
      {summary.paymentUrl ? <CheckoutRedirector paymentUrl={summary.paymentUrl} /> : null}
    </div>
  );
}
