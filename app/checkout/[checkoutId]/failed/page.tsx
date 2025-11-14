import { PaymentErrorActions } from "@/components/checkout/PaymentErrorActions";
import { PaymentStatusBanner } from "@/components/checkout/PaymentStatusBanner";

interface CheckoutFailedPageProps {
  params: { checkoutId: string };
}

export default function CheckoutFailedPage({ params }: CheckoutFailedPageProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Payment not completed</h1>
        <p className="text-sm text-slate-600">
          We didn&apos;t receive a successful payment for this checkout. You can try again or choose another plan.
        </p>
      </div>
      <PaymentStatusBanner status="failed" message="The payment provider marked this attempt as failed." />
      <PaymentErrorActions checkoutId={params.checkoutId} />
      <p className="text-xs text-slate-500">
        If you believe this is an error, <a className="text-slate-900 underline" href="mailto:support@simplify.africa">
          contact support
        </a>{" "}
        with your checkout reference {params.checkoutId}.
      </p>
    </div>
  );
}
