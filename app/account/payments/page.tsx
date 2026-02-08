import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

export default async function AccountPaymentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/account/payments")}`);
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-brand-900">Payment methods</h2>
      <p className="mt-2 text-sm text-brand-600">
        Simplify does not store card details. Payments are securely handled by our payment provider.
      </p>
      <div className="mt-5 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-6 text-sm text-brand-700">
        No saved payment methods yet. You can add a card during checkout.
      </div>
    </div>
  );
}
