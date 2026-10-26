import { requireVerifiedCustomerSession } from "@/lib/auth/customer";
import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default async function AccountPaymentsPage() {
  const session = await requireVerifiedCustomerSession("/account/payments");

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/account/payments")}`);
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-brand-900">Payment security</h2>
      <p className="mt-2 text-sm text-brand-600">
        SIM.Africa does not store raw card details. Payments are securely handled by the configured payment provider.
      </p>
      <div className="mt-5 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-6 text-sm text-brand-700">
        SIM.Africa does not offer saved payment methods. The configured payment provider collects the required payment details during each secure checkout.
      </div>
    </div>
  );
}
