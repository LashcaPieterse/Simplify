import type { Metadata } from "next";
import Link from "next/link";
import { Route, ShieldCheck } from "lucide-react";

import { StorefrontPlanCard } from "@/components/plans/StorefrontPlanCard";
import { getRegionalStorefrontPlans } from "@/lib/catalog/storefront";

export const metadata: Metadata = {
  title: "Regional eSIMs for Africa",
  description: "Compare currently purchasable regional travel eSIM packages and verify their named African destination coverage.",
  alternates: { canonical: "/regional-esims" },
};

export const revalidate = 300;

export default async function RegionalEsimsPage() {
  const result = await Promise.allSettled([getRegionalStorefrontPlans()]);
  const catalogueUnavailable = result[0]!.status === "rejected";
  const plans = result[0]!.status === "fulfilled" ? result[0]!.value : [];
  const groups = new Map<string, typeof plans>();
  for (const plan of plans) {
    const current = groups.get(plan.destination.slug) ?? [];
    current.push(plan);
    groups.set(plan.destination.slug, current);
  }

  return (
    <div>
      <section className="border-b border-brand-100 bg-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-300">Regional eSIMs</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">Fewer eSIMs for multi-country African trips</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-100">Only active supplier packages appear here. Coverage is read from the package catalogue and unverified lists are clearly flagged.</p>
          <Link href="/route-builder" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-black text-brand-900"><Route className="h-5 w-5" aria-hidden />Build a multi-country route</Link>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
        {catalogueUnavailable ? (
          <div className="rounded-3xl border border-dashed border-brand-200 bg-brand-50 p-10 text-center"><h2 className="text-xl font-black text-brand-900">Regional catalogue temporarily unavailable</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-brand-600">We could not safely load the current regional packages. Try again shortly or compare country plans; no cached price is being presented as current.</p><Link href="/destinations" className="mt-6 inline-block font-black text-brand-700 underline underline-offset-4">Browse country plans</Link></div>
        ) : groups.size ? (
          <div className="space-y-16">
            {Array.from(groups.entries()).map(([slug, groupPlans]) => (
              <section key={slug} id={slug} className="scroll-mt-28">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">Supplier region</p><h2 className="mt-2 text-3xl font-black text-brand-900 sm:text-4xl">{groupPlans[0]!.destination.title}</h2></div>
                  <p className="text-sm font-semibold text-brand-600">{groupPlans.length} active plan{groupPlans.length === 1 ? "" : "s"}</p>
                </div>
                {groupPlans.some((plan) => !plan.coverageVerified) ? <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />One or more packages do not include a parseable supplier coverage list. Those plans remain purchasable but are excluded from automatic route recommendations.</div> : null}
                <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{groupPlans.map((plan) => <StorefrontPlanCard key={plan.id} plan={plan} />)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-brand-200 bg-brand-50 p-10 text-center"><h2 className="text-xl font-black text-brand-900">No regional plans are currently available</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-brand-600">The catalogue does not currently contain a positively priced, active regional package. We will not invent one; compare country plans instead.</p><Link href="/destinations" className="mt-6 inline-block font-black text-brand-700 underline underline-offset-4">Browse country plans</Link></div>
        )}
      </div>
    </div>
  );
}
