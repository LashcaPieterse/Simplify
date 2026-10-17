import type { Metadata } from "next";

import { RouteBuilder } from "@/components/routes/RouteBuilder";
import { getLocalStorefrontPlans, getRegionalStorefrontPlans, getStorefrontCountries } from "@/lib/catalog/storefront";

export const metadata: Metadata = {
  title: "Africa multi-country eSIM route builder",
  description: "Select the African countries on your trip and compare verified regional coverage with the smallest available mix of regional and country eSIMs.",
  alternates: { canonical: "/route-builder" },
};

export const revalidate = 300;

export default async function RouteBuilderPage() {
  const [countryResult, regionalResult, localResult] = await Promise.allSettled([
    getStorefrontCountries(),
    getRegionalStorefrontPlans(),
    getLocalStorefrontPlans(),
  ]);
  const countries = countryResult.status === "fulfilled" ? countryResult.value : [];
  const regionalPlans = regionalResult.status === "fulfilled" ? regionalResult.value : [];
  const localPlans = localResult.status === "fulfilled" ? localResult.value : [];

  return <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20"><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">Multi-country Africa</p><h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-brand-900 sm:text-6xl">Build an eSIM plan for your route</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-brand-600">Choose every country you&apos;re visiting. A regional plan appears only when its supplier coverage explicitly includes the complete route.</p>{countries.length && localPlans.length ? <div className="mt-10"><RouteBuilder countries={countries} regionalPlans={regionalPlans} localPlans={localPlans} /></div> : <div className="mt-10 rounded-3xl border border-dashed border-brand-200 bg-brand-50 p-8 text-center"><h2 className="font-black text-brand-900">Route catalogue unavailable</h2><p className="mt-2 text-sm text-brand-600">We could not safely load every country plan needed to build a route. Please try again shortly.</p></div>}</div>;
}
