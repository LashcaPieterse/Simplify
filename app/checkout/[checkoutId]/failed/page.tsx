import { PaymentErrorActions } from "@/components/checkout/PaymentErrorActions";
import { PaymentStatusBanner } from "@/components/checkout/PaymentStatusBanner";

interface CheckoutFailedPageProps {
  params: Promise<{ checkoutId: string }>;
}

export default async function CheckoutFailedPage({ params }: CheckoutFailedPageProps) {
  const { checkoutId } = await params;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-brand-900 sm:text-5xl">Payment not completed</h1>
        <p className="text-sm leading-6 text-brand-600">
          We didn&apos;t receive a successful payment for this checkout. You can try again or choose another plan.
        </p>
      </div>
      <PaymentStatusBanner status="failed" message="The payment provider marked this attempt as failed." />
      <PaymentErrorActions checkoutId={checkoutId} />
      <p className="text-xs text-brand-500">
        If you believe this is an error, <a className="font-bold text-brand-800 underline" href="mailto:support@sim.africa">
          contact support
        </a>{" "}
        with your checkout reference {checkoutId}.
      </p>
    </div>
  );
}
