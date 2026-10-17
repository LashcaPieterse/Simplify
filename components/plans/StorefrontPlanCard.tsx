import Link from "next/link";
import { CalendarDays, Database, Radio, RefreshCw, Router, Phone } from "lucide-react";

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
    <article className="flex h-full flex-col rounded-3xl border border-brand-100 bg-white p-5 shadow-subtle transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card motion-reduce:transform-none sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-brand-500">{plan.destination.title}</p>
          <h3 className="mt-2 text-xl font-black leading-tight text-brand-900">{plan.title}</h3>
          {plan.operatorName ? <p className="mt-1 text-sm text-brand-500">{plan.operatorName}</p> : null}
        </div>
        {badge ? <span className="shrink-0 rounded-full bg-sand-100 px-3 py-1 text-[0.65rem] font-black uppercase tracking-wide text-sand-800">{badge}</span> : null}
      </div>

      <dl className={`mt-6 grid gap-3 text-sm ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
        <PlanFact icon={Database} label="Data" value={plan.dataLabel} />
        <PlanFact icon={CalendarDays} label="Validity" value={plan.validityDays ? `${plan.validityDays} days` : "Unknown"} />
        <PlanFact icon={Radio} label="Network" value={networkLabel} />
        <PlanFact icon={Router} label="Hotspot" value={formatKnownBoolean(plan.hotspot)} />
        {!compact ? <PlanFact icon={Phone} label="Calls & SMS" value={callsLabel} /> : null}
        {!compact ? <PlanFact icon={RefreshCw} label="Top-up" value={formatKnownBoolean(plan.topUpAvailable, { yes: "Available", no: "Not available" })} /> : null}
      </dl>

      <div className="mt-auto pt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Price</p>
            <p className="mt-1 text-2xl font-black text-brand-900">{formatMoneyAmount(plan.price.amount, plan.price.currency)}</p>
          </div>
          <Link href={`/plan/${encodeURIComponent(plan.externalId)}`} className="rounded-md text-sm font-bold text-brand-700 underline-offset-4 hover:text-brand-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            Details
          </Link>
        </div>
        <AddToCartButton item={storefrontPlanToCartItem(plan)} className="mt-5" />
      </div>
    </article>
  );
}

function PlanFact({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl bg-brand-50 px-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-500">{label}</dt>
        <dd className="mt-0.5 break-words font-semibold text-brand-900">{value}</dd>
      </div>
    </div>
  );
}
