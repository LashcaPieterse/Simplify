import { formatCurrency } from "@/lib/format";

interface CheckoutSummaryProps {
  packageName: string;
  packageDescription?: string | null;
  quantity: number;
  totalCents: number;
  currency: string;
  destination?: string | null;
  dataLabel?: string | null;
  validityDays?: number | null;
  customerEmail?: string | null;
}

export function CheckoutSummary({
  packageName,
  packageDescription,
  quantity,
  totalCents,
  currency,
  destination,
  dataLabel,
  validityDays,
  customerEmail,
}: CheckoutSummaryProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-brand-100 bg-white p-5 shadow-subtle sm:p-6">
      <div>
        <h2 className="text-lg font-black text-brand-900">Plan summary</h2>
        <p className="mt-1 text-sm text-brand-600">Review the details before continuing to payment.</p>
      </div>
      <dl className="space-y-3">
        <div>
          <dt className="text-sm font-medium text-brand-500">Plan</dt>
          <dd className="text-base font-bold text-brand-900">{packageName}</dd>
          {packageDescription ? (
            <p className="mt-1 text-sm text-brand-600">{packageDescription}</p>
          ) : null}
        </div>
        {destination ? <div className="flex items-center justify-between gap-4"><dt className="text-sm font-medium text-brand-500">Destination</dt><dd className="text-right text-base font-bold text-brand-900">{destination}</dd></div> : null}
        {dataLabel ? <div className="flex items-center justify-between gap-4"><dt className="text-sm font-medium text-brand-500">Data</dt><dd className="text-right text-base text-brand-900">{dataLabel}</dd></div> : null}
        {validityDays ? <div className="flex items-center justify-between gap-4"><dt className="text-sm font-medium text-brand-500">Validity</dt><dd className="text-right text-base text-brand-900">{validityDays} days</dd></div> : null}
        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-brand-500">Quantity</dt>
          <dd className="text-base text-brand-900">{quantity}</dd>
        </div>
        {customerEmail ? <div className="rounded-2xl bg-brand-50 p-3 text-sm leading-6 text-brand-900"><dt className="font-bold">Delivery email</dt><dd className="break-all">{customerEmail}</dd></div> : null}
        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-brand-500">Total due</dt>
          <dd className="text-lg font-black text-brand-900">
            {formatCurrency(totalCents, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
