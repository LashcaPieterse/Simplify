"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MapPin, Route, Search, X } from "lucide-react";

import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { StorefrontPlanCard } from "@/components/plans/StorefrontPlanCard";
import { Button } from "@/components/ui/button";
import { storefrontPlanToCartItem } from "@/lib/catalog/presentation";
import {
  comparePlansForTripNeed,
  planMeetsTripNeed,
  USAGE_PROFILES,
  type UsageProfileId,
} from "@/lib/catalog/recommendations";
import {
  planCoversEveryDestination,
  type StorefrontCountry,
  type StorefrontPlan,
} from "@/lib/catalog/storefront";
import { formatMoneyAmount } from "@/lib/format";
import { trackEvent } from "@/lib/analytics";
import { findSmallestRouteCombination } from "@/lib/routes/route-matcher";

export function RouteBuilder({ countries, regionalPlans, localPlans }: { countries: StorefrontCountry[]; regionalPlans: StorefrontPlan[]; localPlans: StorefrontPlan[] }) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(14);
  const [usageId, setUsageId] = useState<UsageProfileId>("regular");
  const [submitted, setSubmitted] = useState(false);
  const selected = selectedSlugs.map((slug) => countries.find((country) => country.slug === slug)).filter((country): country is StorefrontCountry => Boolean(country));
  const usage = USAGE_PROFILES.find((option) => option.id === usageId)!;
  const requiredDataMb = Math.ceil(days * usage.perDayMb);

  const filteredCountries = useMemo(() => {
    const term = query.trim().toLowerCase();
    return countries.filter((country) => !selectedSlugs.includes(country.slug) && (!term || country.title.toLowerCase().includes(term) || country.countryCode.toLowerCase().includes(term))).slice(0, 18);
  }, [countries, query, selectedSlugs]);

  const regionalMatches = regionalPlans
    .filter((plan) => planCoversEveryDestination(plan, selected))
    .sort((left, right) => comparePlansForTripNeed(left, right, days, requiredDataMb));
  const recommendedRegional = regionalMatches[0] ?? null;
  const combination = findSmallestRouteCombination({
    destinations: selected,
    regionalPlans,
    localPlans,
    days,
    requiredDataMb,
    excludePlanIds: recommendedRegional
      ? regionalMatches.map((plan) => plan.id)
      : [],
  });
  const recommendedMeetsEstimate = recommendedRegional
    ? planMeetsTripNeed(recommendedRegional, days, requiredDataMb)
    : false;

  const toggleCountry = (country: StorefrontCountry) => {
    setSubmitted(false);
    setSelectedSlugs((current) => current.includes(country.slug) ? current.filter((slug) => slug !== country.slug) : [...current, country.slug]);
    if (selectedSlugs.length === 0) trackEvent("route_builder_started");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(24rem,1.2fr)] lg:items-start">
      <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-subtle sm:p-7">
        <h2 className="text-xl font-black text-brand-900">1. Which countries are you visiting?</h2>
        {selected.length ? <div className="mt-4 flex flex-wrap gap-2">{selected.map((country) => <button key={country.id} type="button" onClick={() => toggleCountry(country)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-bold text-white">{country.title}<X className="h-4 w-4" aria-hidden /></button>)}</div> : <p className="mt-3 text-sm text-brand-600">Select at least two destinations.</p>}
        <label className="mt-5 flex h-12 items-center gap-2 rounded-xl border border-brand-200 px-3"><Search className="h-4 w-4 text-brand-500" aria-hidden /><span className="sr-only">Search countries</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-brand-900 focus:outline-none" placeholder="Search available countries" /></label>
        <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{filteredCountries.map((country) => <button key={country.id} type="button" onClick={() => toggleCountry(country)} className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-100 px-3 text-left text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50"><MapPin className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />{country.title}</button>)}</div>

        <div className="mt-7 border-t border-brand-100 pt-7">
          <h2 className="text-xl font-black text-brand-900">2. Trip length</h2>
          <label className="mt-4 block text-sm font-bold text-brand-700">Days<input type="number" min={1} max={90} value={days} onChange={(event) => { setSubmitted(false); setDays(Math.max(1, Math.min(90, Number(event.target.value) || 1))); }} className="mt-2 h-12 w-full rounded-xl border border-brand-200 px-3 text-base text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" /></label>
        </div>

        <div className="mt-7 border-t border-brand-100 pt-7">
          <h2 className="text-xl font-black text-brand-900">3. Estimated usage</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{USAGE_PROFILES.map((option) => <button key={option.id} type="button" aria-pressed={usageId === option.id} onClick={() => { setUsageId(option.id); setSubmitted(false); }} className={`rounded-xl border p-3 text-left ${usageId === option.id ? "border-brand-500 bg-brand-50" : "border-brand-100"}`}><span className="block font-black text-brand-900">{option.label}</span><span className="mt-1 block text-xs leading-5 text-brand-600">{option.detail}</span></button>)}</div>
          <p className="mt-3 text-xs leading-5 text-brand-500">Estimate: about {Math.ceil(requiredDataMb / 1024)} GB for {days} days. Actual usage varies.</p>
        </div>

        <Button type="button" className="mt-7 w-full" disabled={selected.length < 2} onClick={() => { setSubmitted(true); trackEvent("route_builder_completed", { destination_count: selected.length, days, usage: usageId, regional_match: Boolean(recommendedRegional) }); }}>Find route plans</Button>
      </div>

      <div className="lg:sticky lg:top-28">
        {!submitted ? <div className="rounded-3xl border border-dashed border-brand-200 bg-brand-50 p-10 text-center"><Route className="mx-auto h-8 w-8 text-brand-500" aria-hidden /><h2 className="mt-4 text-xl font-black text-brand-900">Your route recommendation will appear here</h2><p className="mt-2 text-sm leading-6 text-brand-600">Coverage is validated against every selected destination before a regional plan can be recommended.</p></div> : recommendedRegional ? (
          <div>
            <div className="mb-5 rounded-2xl bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
              <div className="flex items-center gap-2 font-black"><CheckCircle2 className="h-5 w-5" aria-hidden />One eSIM covers all {selected.length} destinations</div>
              <p className="mt-2">{recommendedRegional.coverage.filter((covered) => selected.some((country) => country.countryCode === covered.code || country.slug === covered.slug)).map((covered) => covered.name).join(", ")}</p>
              <p className="mt-2 font-semibold">{recommendedMeetsEstimate ? "This plan also meets the estimated trip length and data need." : "Coverage is verified, but this closest regional option does not fully meet the estimated trip length or data need. Review its allowance before buying."}</p>
              {combination?.totalCents !== null && combination?.currency === recommendedRegional.price.currency ? <p className="mt-2">Verified {combination.matches.length}-eSIM alternative: {formatMoneyAmount(combination.totalCents / 100, combination.currency)}. One regional eSIM: {formatMoneyAmount(recommendedRegional.price.amount, recommendedRegional.price.currency)}.</p> : null}
            </div>
            <StorefrontPlanCard plan={recommendedRegional} badge="Route match" />
          </div>
        ) : combination ? (
          <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-subtle sm:p-7"><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">Smallest verified combination</p><h2 className="mt-2 text-2xl font-black text-brand-900">{combination.matches.length} eSIM{combination.matches.length === 1 ? "" : "s"} cover this route</h2><p className="mt-3 text-sm leading-6 text-brand-600">No single regional package in the current catalogue explicitly covers every selected country. This exact set-cover result can mix verified regional and local packages to minimize the number of eSIMs.</p><div className="mt-6 grid gap-4">{combination.matches.map(({ plan, destinations, meetsEstimate }) => <div key={plan.id} className="rounded-2xl border border-brand-100 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-brand-500">Covers {destinations.map((destination) => destination.title).join(", ")}</p><h3 className="mt-1 font-black text-brand-900">{plan.title}</h3><p className="mt-1 text-sm text-brand-600">{plan.dataLabel} · {plan.validityDays ? `${plan.validityDays} days` : "Validity unknown"}</p>{!meetsEstimate ? <p className="mt-2 text-xs font-semibold text-amber-800">Closest current option; it does not fully meet the usage or duration estimate.</p> : null}</div><p className="shrink-0 font-black text-brand-900">{formatMoneyAmount(plan.price.amount, plan.price.currency)}</p></div><AddToCartButton item={storefrontPlanToCartItem(plan)} label="Add this eSIM" goToCart={false} className="mt-4" /></div>)}</div>{combination.totalCents !== null && combination.currency ? <p className="mt-6 border-t border-brand-100 pt-5 text-right text-lg font-black text-brand-900">Total: {formatMoneyAmount(combination.totalCents / 100, combination.currency)}</p> : <p className="mt-6 text-xs text-brand-500">A combined total is not shown because plans use different currencies.</p>}</div>
        ) : (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8"><h2 className="text-xl font-black text-amber-950">No complete route match is available</h2><p className="mt-3 text-sm leading-6 text-amber-900">At least one selected destination has no active local plan, and no verified regional package covers the full route. Change the route or contact support.</p></div>
        )}
      </div>
    </div>
  );
}
