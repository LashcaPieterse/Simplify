import { CheckoutStatusPoller } from "@/components/checkout/CheckoutStatusPoller";

interface CheckoutReturnPageProps {
  params: Promise<{ checkoutId: string }>;
}

export default async function CheckoutReturnPage({ params }: CheckoutReturnPageProps) {
  const { checkoutId } = await params;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-brand-900 sm:text-5xl">Processing your payment</h1>
        <p className="text-sm leading-6 text-brand-600">
          Thanks for returning to SIM.Africa. We&apos;re confirming your payment with the configured provider.
        </p>
      </div>
      <CheckoutStatusPoller checkoutId={checkoutId} />
      <p className="text-xs text-brand-500">You can return to this checkout if your connection drops. Processing continues securely in the background.</p>
      <p className="text-xs text-brand-500">
        Need help? <a className="font-bold text-brand-800 underline" href="mailto:support@sim.africa">
          Contact support
        </a>{" "}
        with your payment reference.
      </p>
    </div>
  );
}
