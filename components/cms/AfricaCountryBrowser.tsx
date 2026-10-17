"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  AFRICA_REGION_TABS,
  type AfricaCountryListing,
  type AfricaRegionFilter,
} from "@/lib/catalog/africa-directory";
import { formatMoneyAmount } from "@/lib/format";
import { urlForImage } from "@/lib/image";

const ALL_AFRICA_PREVIEW_COUNT = 12;

type AfricaCountryBrowserProps = {
  countries: AfricaCountryListing[];
  title?: string | null;
};

export function AfricaCountryBrowser({ countries, title }: AfricaCountryBrowserProps) {
  const [activeRegion, setActiveRegion] = useState<AfricaRegionFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs = useMemo(
    () =>
      AFRICA_REGION_TABS.filter(
        (tab) => tab.id === "all" || countries.some((country) => country.region === tab.id),
      ),
    [countries],
  );

  const filteredCountries = useMemo(
    () =>
      activeRegion === "all"
        ? countries
        : countries.filter((country) => country.region === activeRegion),
    [activeRegion, countries],
  );

  const visibleCountries =
    activeRegion === "all" && !showAll
      ? filteredCountries.slice(0, ALL_AFRICA_PREVIEW_COUNT)
      : filteredCountries;
  const canExpand = activeRegion === "all" && filteredCountries.length > ALL_AFRICA_PREVIEW_COUNT;

  const focusTab = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    setActiveRegion(tab.id);
    tabRefs.current[index]?.focus();
  };

  return (
    <section id="store" className="mx-auto mb-24 w-full max-w-6xl scroll-mt-8 px-5 sm:px-6 lg:px-10">
      <div className="overflow-hidden rounded-[2rem] border border-brand-200/80 bg-brand-100/80 p-5 shadow-card sm:p-8 lg:rounded-[2.5rem] lg:p-10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">African eSIMs</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-brand-900 sm:text-4xl">
              {title?.trim() || "Choose your African destination"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-brand-700 sm:text-base">
              Browse every available African destination. Prices start from the lowest currently sellable package.
            </p>
          </div>
          {countries.length ? (
            <p className="text-sm font-medium text-brand-700" aria-live="polite">
              {countries.length} destination{countries.length === 1 ? "" : "s"} available
            </p>
          ) : null}
        </div>

        {countries.length ? (
          <>
            <div
              className="-mx-1 mt-8 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Filter African destinations by region"
            >
              <div className="flex min-w-max gap-2 border-b border-brand-300/70">
                {tabs.map((tab, index) => {
                  const selected = activeRegion === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(element) => {
                        tabRefs.current[index] = element;
                      }}
                      type="button"
                      role="tab"
                      id={`africa-region-tab-${tab.id}`}
                      aria-selected={selected}
                      aria-controls="africa-country-panel"
                      tabIndex={selected ? 0 : -1}
                      className={`relative whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-100 sm:px-5 ${
                        selected
                          ? "bg-white text-brand-900 shadow-[0_-1px_0_0_rgba(138,216,214,0.8)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-600"
                          : "text-brand-700 hover:bg-white/55 hover:text-brand-900"
                      }`}
                      onClick={() => setActiveRegion(tab.id)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowRight") {
                          event.preventDefault();
                          focusTab((index + 1) % tabs.length);
                        } else if (event.key === "ArrowLeft") {
                          event.preventDefault();
                          focusTab((index - 1 + tabs.length) % tabs.length);
                        } else if (event.key === "Home") {
                          event.preventDefault();
                          focusTab(0);
                        } else if (event.key === "End") {
                          event.preventDefault();
                          focusTab(tabs.length - 1);
                        }
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              id="africa-country-panel"
              role="tabpanel"
              aria-labelledby={`africa-region-tab-${activeRegion}`}
              className="mt-6"
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {visibleCountries.map((country) => (
                  <CountryLink key={country.id} country={country} />
                ))}
              </div>

              {canExpand ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-300 bg-white px-6 py-2.5 text-sm font-semibold text-brand-800 shadow-subtle transition hover:-translate-y-0.5 hover:border-brand-400 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-100 motion-reduce:transform-none"
                    onClick={() => setShowAll((current) => !current)}
                    aria-expanded={showAll}
                    aria-controls="africa-country-panel"
                  >
                    {showAll ? "Show fewer" : `View all ${filteredCountries.length} countries`}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-brand-300 bg-white/70 px-6 py-10 text-center">
            <p className="font-semibold text-brand-900">Destinations are temporarily unavailable.</p>
            <p className="mt-2 text-sm text-brand-600">Current eSIM plans are syncing. Please check again shortly.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function CountryLink({ country }: { country: AfricaCountryListing }) {
  const flagUrl = country.flagImage
    ? urlForImage(country.flagImage)?.width(132).height(99).fit("max").auto("format").url() ?? null
    : null;
  const formattedPrice = formatMoneyAmount(
    country.minimumPrice.amount,
    country.minimumPrice.currency,
  );

  return (
    <Link
      href={`/country/${country.slug}`}
      className="group flex min-h-[4.75rem] items-center gap-3 rounded-2xl border border-white/90 bg-white px-4 py-3 shadow-subtle transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-100 motion-reduce:transform-none"
      aria-label={`View eSIM plans for ${country.title}, from ${formattedPrice}`}
    >
      <span className="relative flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-brand-100 bg-brand-50">
        {flagUrl ? (
          <Image
            src={flagUrl}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <span className="text-xs font-bold tracking-wide text-brand-700" aria-hidden="true">
            {country.countryCode.slice(0, 2)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-900 sm:text-base">
        {country.title}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-brand-500">From</span>
        <span className="block text-sm font-bold text-brand-900 sm:text-base">{formattedPrice}</span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-brand-500 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden="true"
      />
    </Link>
  );
}
