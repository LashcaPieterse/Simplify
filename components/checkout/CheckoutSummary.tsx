interface CheckoutSummaryProps {
  packageName: string;
  packageDescription?: string | null;
  quantity: number;
  totalCents: number;
  currency: string;
}

function formatCurrency(amountCents: number, currency: string): string {
  try {
    const hasCents = amountCents % 100 !== 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export function CheckoutSummary({
  packageName,
  packageDescription,
  quantity,
  totalCents,
  currency,
}: CheckoutSummaryProps) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Plan summary</h2>
        <p className="mt-1 text-sm text-slate-600">Review the details before continuing to payment.</p>
      </div>
      <dl className="space-y-3">
        <div>
          <dt className="text-sm font-medium text-slate-500">Plan</dt>
          <dd className="text-base font-semibold text-slate-900">{packageName}</dd>
          {packageDescription ? (
            <p className="mt-1 text-sm text-slate-600">{packageDescription}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-slate-500">Quantity</dt>
          <dd className="text-base text-slate-900">{quantity}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-slate-500">Total due</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {formatCurrency(totalCents, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
