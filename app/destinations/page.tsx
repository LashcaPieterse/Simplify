import type { Metadata } from "next";
import type { Route } from "next";

import { DestinationSearch, type DestinationSearchOption } from "@/components/search/DestinationSearch";
import { getRegionalStorefrontPlans, getStorefrontCountries } from "@/lib/catalog/storefront";
import { citySearchTermsForCountry } from "@/lib/content/destination-search";
import { DestinationCard } from "@/components/destinations/DestinationCard";

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

  const featuredCountries = ["south-africa", "kenya", "tanzania", "egypt"].flatMap((slug) => {
    const country = countries.find((item) => item.slug === slug);
    return country ? [country] : [];
  });

  return (
    <div className="page-container section-space">
      <p className="eyebrow">Destinations</p>
      <h1 className="mt-5 max-w-4xl text-4xl font-medium leading-[1.08] tracking-[-0.05em] text-brand-900 sm:text-6xl">Find your next<br /><span className="editorial">African adventure.</span></h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-600">From wild coastlines to city streets. Explore available eSIM plans and take your connection with you.</p>
      <div className="mt-9 max-w-3xl"><DestinationSearch options={[...countryOptions, ...regionalOptions]} /></div>

      {countries.length ? (
        <div className="mt-14">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featuredCountries.map((country) => <DestinationCard key={country.id} country={country} photograph />)}</div>
          <div className="mb-6 mt-14 flex items-center justify-between border-b border-brand-100 pb-5"><h2 className="text-2xl font-medium">All destinations</h2><span className="text-xs text-brand-500">{countries.length} places to explore</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{countries.map((country) => <DestinationCard key={country.id} country={country} />)}</div>
        </div>
      ) : (
        <div className="mt-12 rounded-3xl border border-dashed border-brand-200 bg-brand-50 p-10 text-center"><h2 className="font-black text-brand-900">Catalogue unavailable</h2><p className="mt-2 text-sm text-brand-600">We could not safely load destination availability. Please try again shortly.</p></div>
      )}
    </div>
  );
}
