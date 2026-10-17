import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DestinationSearch, type DestinationSearchOption } from "@/components/search/DestinationSearch";
import { getRegionalStorefrontPlans, getStorefrontCountries } from "@/lib/catalog/storefront";
import { citySearchTermsForCountry } from "@/lib/content/destination-search";
import { formatMoneyAmount } from "@/lib/format";

export const metadata: Metadata = {
  title: "African eSIM destinations",
  description: "Browse African destinations with currently available prepaid travel eSIM plans.",
  alternates: { canonical: "/destinations" },
};

export const revalidate = 300;

export default async function DestinationsPage() {
  const [countryResult, regionalResult] = await Promise.allSettled([
    getStorefrontCountries(),
    getRegionalStorefrontPlans(),
  ]);
  const countries = countryResult.status === "fulfilled" ? countryResult.value : [];
  const regionalPlans = regionalResult.status === "fulfilled" ? regionalResult.value : [];
  const countryOptions: DestinationSearchOption[] = countries.map((country) => ({
    id: country.id,
    title: country.title,
    subtitle: "Country eSIM",
    href: `/country/${country.slug}` as Route,
    type: "country",
    searchTerms: citySearchTermsForCountry(country.slug),
    countryCode: country.countryCode,
  }));
  const seenRegions = new Set<string>();
  const regionalOptions: DestinationSearchOption[] = regionalPlans
    .filter((plan) => {
      if (seenRegions.has(plan.destination.slug)) return false;
      seenRegions.add(plan.destination.slug);
      return true;
    })
    .map((plan) => ({
      id: `region-${plan.destination.id}`,
      title: plan.destination.title,
      subtitle: "Regional eSIM",
      href: `/regional-esims#${plan.destination.slug}` as Route,
      type: "region",
      searchTerms: plan.coverage.map((destination) => destination.name),
      countryCode: null,
    }));

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">Destinations</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-brand-900 sm:text-6xl">Travel eSIMs for African destinations</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-600">Only countries with at least one active, positively priced supplier package appear here.</p>
      <div className="mt-9 max-w-3xl"><DestinationSearch options={[...countryOptions, ...regionalOptions]} /></div>

      {countries.length ? (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <Link key={country.id} href={`/country/${country.slug}`} className="group flex items-center justify-between gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-subtle hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
              <div><h2 className="font-black text-brand-900">{country.title}</h2><p className="mt-1 text-sm text-brand-500">From {formatMoneyAmount(country.minimumPrice.amount, country.minimumPrice.currency)} · {country.planCount} plan{country.planCount === 1 ? "" : "s"}</p></div>
              <ArrowRight className="h-5 w-5 shrink-0 text-brand-500 transition group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-3xl border border-dashed border-brand-200 bg-brand-50 p-10 text-center"><h2 className="font-black text-brand-900">Catalogue unavailable</h2><p className="mt-2 text-sm text-brand-600">We could not safely load destination availability. Please try again shortly.</p></div>
      )}
    </div>
  );
}
