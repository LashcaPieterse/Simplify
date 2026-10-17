"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { StorefrontPlanCard } from "@/components/plans/StorefrontPlanCard";
import type { StorefrontPlan } from "@/lib/catalog/storefront";

type SortOption = "price" | "data" | "validity";
type DataFilter = "all" | "small" | "medium" | "large" | "unlimited";
type ValidityFilter = "all" | "week" | "month";
type KnownBooleanFilter = "all" | "yes" | "no";

export function PlanExplorer({ plans }: { plans: StorefrontPlan[] }) {
  const [sort, setSort] = useState<SortOption>("price");
  const [dataFilter, setDataFilter] = useState<DataFilter>("all");
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>("all");
  const [networkTypeFilter, setNetworkTypeFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [hotspotFilter, setHotspotFilter] = useState<KnownBooleanFilter>("all");
  const [callsFilter, setCallsFilter] = useState<KnownBooleanFilter>("all");
  const [topUpFilter, setTopUpFilter] = useState<KnownBooleanFilter>("all");

  const networkTypes = Array.from(
    new Set(plans.flatMap((plan) => plan.networkTypes)),
  ).sort();
  const carriers = Array.from(
    new Set(plans.flatMap((plan) => plan.networks)),
  ).sort((left, right) => left.localeCompare(right));
  const hasKnownHotspot = plans.some((plan) => plan.hotspot !== null);
  const hasKnownCalls = plans.some((plan) => plan.callsAndSms !== null);
  const hasKnownTopUp = plans.some((plan) => plan.topUpAvailable !== null);

  const sameCurrency = new Set(plans.map((plan) => plan.price.currency)).size === 1;
  const cheapestId = sameCurrency
    ? [...plans].sort((left, right) => left.price.cents - right.price.cents)[0]?.id
    : null;
  const bestValueId = sameCurrency
    ? [...plans]
        .filter((plan) => !plan.isUnlimited && plan.dataAmountMb && plan.dataAmountMb > 0)
        .sort((left, right) =>
          left.price.cents / left.dataAmountMb! - right.price.cents / right.dataAmountMb!,
        )[0]?.id
    : null;

  const visiblePlans = (() => {
    const filtered = plans.filter((plan) => {
      const dataGb = (plan.dataAmountMb ?? 0) / 1024;
      const dataMatches =
        dataFilter === "all" ||
        (dataFilter === "unlimited" && plan.isUnlimited) ||
        (dataFilter === "small" && !plan.isUnlimited && dataGb > 0 && dataGb <= 3) ||
        (dataFilter === "medium" && !plan.isUnlimited && dataGb > 3 && dataGb <= 10) ||
        (dataFilter === "large" && !plan.isUnlimited && dataGb > 10);
      const validityMatches =
        validityFilter === "all" ||
        (validityFilter === "week" && Boolean(plan.validityDays && plan.validityDays <= 7)) ||
        (validityFilter === "month" && Boolean(plan.validityDays && plan.validityDays >= 30));
      const networkTypeMatches =
        networkTypeFilter === "all" ||
        plan.networkTypes.includes(networkTypeFilter);
      const carrierMatches =
        carrierFilter === "all" || plan.networks.includes(carrierFilter);
      const hotspotMatches =
        hotspotFilter === "all" ||
        plan.hotspot === (hotspotFilter === "yes");
      const callsMatch =
        callsFilter === "all" ||
        plan.callsAndSms === (callsFilter === "yes");
      const topUpMatches =
        topUpFilter === "all" ||
        plan.topUpAvailable === (topUpFilter === "yes");

      return (
        dataMatches &&
        validityMatches &&
        networkTypeMatches &&
        carrierMatches &&
        hotspotMatches &&
        callsMatch &&
        topUpMatches
      );
    });

    return [...filtered].sort((left, right) => {
      if (sort === "data") return (right.dataAmountMb ?? 0) - (left.dataAmountMb ?? 0);
      if (sort === "validity") return (right.validityDays ?? 0) - (left.validityDays ?? 0);
      if (left.price.currency === right.price.currency) return left.price.cents - right.price.cents;
      return left.price.currency.localeCompare(right.price.currency);
    });
  })();

  const filtersActive =
    dataFilter !== "all" ||
    validityFilter !== "all" ||
    networkTypeFilter !== "all" ||
    carrierFilter !== "all" ||
    hotspotFilter !== "all" ||
    callsFilter !== "all" ||
    topUpFilter !== "all";

  const resetFilters = () => {
    setDataFilter("all");
    setValidityFilter("all");
    setNetworkTypeFilter("all");
    setCarrierFilter("all");
    setHotspotFilter("all");
    setCallsFilter("all");
    setTopUpFilter("all");
  };

  return (
    <div>
      <div className="rounded-3xl border border-brand-100 bg-brand-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-brand-900"><SlidersHorizontal className="h-4 w-4" aria-hidden />Filter and sort</div>
          {filtersActive ? <button type="button" onClick={resetFilters} className="min-h-10 rounded-full px-3 text-xs font-black text-brand-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">Reset filters</button> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect label="Data" value={dataFilter} onChange={(value) => setDataFilter(value as DataFilter)} options={[['all', 'All data'], ['small', 'Up to 3 GB'], ['medium', '3–10 GB'], ['large', 'More than 10 GB'], ['unlimited', 'Unlimited']]} />
          <FilterSelect label="Validity" value={validityFilter} onChange={(value) => setValidityFilter(value as ValidityFilter)} options={[['all', 'Any validity'], ['week', 'Up to 7 days'], ['month', '30+ days']]} />
          <FilterSelect label="Sort" value={sort} onChange={(value) => setSort(value as SortOption)} options={[['price', 'Lowest price'], ['data', 'Most data'], ['validity', 'Longest validity']]} />
          {networkTypes.length ? <FilterSelect label="Network type" value={networkTypeFilter} onChange={setNetworkTypeFilter} options={[["all", "Any network type"], ...networkTypes.map((type) => [type, type] as [string, string])]} /> : null}
          {carriers.length ? <FilterSelect label="Carrier" value={carrierFilter} onChange={setCarrierFilter} options={[["all", "Any named carrier"], ...carriers.map((carrier) => [carrier, carrier] as [string, string])]} /> : null}
          {hasKnownHotspot ? <FilterSelect label="Hotspot" value={hotspotFilter} onChange={(value) => setHotspotFilter(value as KnownBooleanFilter)} options={[["all", "Any hotspot status"], ["yes", "Available"], ["no", "Not available"]]} /> : null}
          {hasKnownCalls ? <FilterSelect label="Calls & SMS" value={callsFilter} onChange={(value) => setCallsFilter(value as KnownBooleanFilter)} options={[["all", "Any calls status"], ["yes", "Included"], ["no", "Data only"]]} /> : null}
          {hasKnownTopUp ? <FilterSelect label="Top-up" value={topUpFilter} onChange={(value) => setTopUpFilter(value as KnownBooleanFilter)} options={[["all", "Any top-up status"], ["yes", "Available"], ["no", "Not available"]]} /> : null}
        </div>
      </div>

      <p className="mt-6 text-sm font-semibold text-brand-600" aria-live="polite">Showing {visiblePlans.length} of {plans.length} active plans</p>
      {visiblePlans.length ? (
        <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visiblePlans.map((plan) => {
            const badge = plan.id === bestValueId
              ? "Lowest price per GB"
              : plan.id === cheapestId
                ? "Lowest price"
                : null;
            return <StorefrontPlanCard key={plan.id} plan={plan} badge={badge} />;
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-brand-200 bg-white p-10 text-center"><h3 className="font-black text-brand-900">No plans match these filters</h3><p className="mt-2 text-sm text-brand-600">Reset one or more filters to see other currently available plans.</p><button type="button" onClick={resetFilters} className="mt-5 min-h-11 rounded-full border border-brand-200 bg-brand-50 px-5 text-sm font-black text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">Reset filters</button></div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="text-xs font-bold uppercase tracking-wide text-brand-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-brand-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
