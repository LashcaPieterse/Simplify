import Link from "next/link";

import { CheckoutStatusPoller } from "@/components/checkout/CheckoutStatusPoller";
import { PaymentStatusBanner } from "@/components/checkout/PaymentStatusBanner";

interface CheckoutReturnPageProps {
  params: { checkoutId: string };
}

export default function CheckoutReturnPage({ params }: CheckoutReturnPageProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Processing your payment</h1>
        <p className="text-sm text-slate-600">
          Thanks for returning to Simplify. We&apos;re confirming your payment with our provider.
        </p>
      </div>
      <PaymentStatusBanner status="pending" message="This usually takes a few seconds." />
      <CheckoutStatusPoller checkoutId={params.checkoutId} />
      <p className="text-xs text-slate-500">
        Need help? <Link className="text-slate-900 underline" href="/contact">Contact support</Link> with your
        payment reference.
      </p>
    </div>
  );
}
