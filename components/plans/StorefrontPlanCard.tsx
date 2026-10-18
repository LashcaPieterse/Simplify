import Link from "next/link";
import { ArrowUpRight, Database, Radio, RefreshCw, Phone } from "lucide-react";

import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { formatMoneyAmount } from "@/lib/format";
import { formatKnownBoolean, storefrontPlanToCartItem } from "@/lib/catalog/presentation";
import type { StorefrontPlan } from "@/lib/catalog/storefront";

export function StorefrontPlanCard({
  plan,
  badge,
  compact = false,
}: {
  plan: StorefrontPlan;
  badge?: string | null;
  compact?: boolean;
}) {
  const networkLabel = plan.networkTypes.length ? plan.networkTypes.join(" / ") : "Unknown";
  const callsLabel = formatKnownBoolean(plan.callsAndSms, {
    yes: "Included",
    no: "Data only",
  });

  return (
    <article className={`flex h-full flex-col rounded-2xl border bg-white p-5 transition-colors duration-200 hover:border-brand-300 sm:p-6 ${badge ? "border-brand-300" : "border-brand-100"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-500">{plan.destination.title}</p>
          <h3 className="mt-2 text-base font-semibold leading-tight text-brand-900">{plan.title}</h3>
          {plan.operatorName ? <p className="mt-1.5 text-xs text-brand-500">{plan.operatorName}</p> : null}
        </div>
        {badge ? <span className="max-w-[45%] rounded-full bg-accent-100 px-3 py-1.5 text-center text-[10px] font-semibold leading-4 text-brand-800">{badge}</span> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50"><Database className="h-4 w-4 text-brand-600" strokeWidth={1.5} aria-hidden /></span>}
      </div>

      <dl className="mt-7 flex items-end gap-3 border-b border-brand-100 pb-6"><div><dt className="sr-only">Data</dt><dd className="text-4xl font-medium tracking-[-0.05em] text-brand-900">{plan.dataLabel}</dd></div><div className="pb-1"><dt className="sr-only">Validity</dt><dd className="text-xs text-brand-500">/ {plan.validityDays ? `${plan.validityDays} days` : "Unknown validity"}</dd></div></dl>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
        <PlanFact icon={Radio} label="Network" value={networkLabel} />
        {!compact ? <PlanFact icon={Phone} label="Calls & SMS" value={callsLabel} /> : null}
        {!compact ? <PlanFact icon={RefreshCw} label="Top-up" value={formatKnownBoolean(plan.topUpAvailable, { yes: "Available", no: "Not available" })} /> : null}
      </dl>

      <div className="mt-auto pt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-brand-500">One-time payment</p>
            <p className="mt-1 text-[1.75rem] font-semibold tracking-tight text-brand-900">{formatMoneyAmount(plan.price.amount, plan.price.currency)}</p>
          </div>
          <Link href={`/plan/${encodeURIComponent(plan.externalId)}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-xs font-semibold text-brand-600 underline-offset-4 hover:text-brand-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            Details <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <AddToCartButton item={storefrontPlanToCartItem(plan)} className="mt-5" />
      </div>
    </article>
  );
}

function PlanFact({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[10px] font-medium text-brand-500">{label}</dt>
        <dd className="mt-1 break-words text-xs font-medium text-brand-900">{value}</dd>
      </div>
    </div>
  );
}
