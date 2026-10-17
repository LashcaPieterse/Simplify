"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowUpRight, Globe2, MapPin, Search } from "lucide-react";

import { trackEvent } from "@/lib/analytics";

export type DestinationSearchOption = {
  id: string;
  title: string;
  subtitle: string;
  href: Route;
  type: "country" | "region";
  searchTerms: string[];
  countryCode?: string | null;
};

function flagEmoji(countryCode?: string | null): string | null {
  const code = countryCode?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...Array.from(code).map((letter) => 127397 + letter.charCodeAt(0)));
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function DestinationSearch({ options, popular = [] }: { options: DestinationSearchOption[]; popular?: string[] }) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return options.slice(0, 10);
    const words = term.split(" ").filter(Boolean);
    return options
      .map((option) => {
        const haystack = normalize([option.title, option.countryCode, option.subtitle, ...option.searchTerms].filter(Boolean).join(" "));
        const score = haystack === term ? 100 : haystack.startsWith(term) ? 80 : words.every((word) => haystack.includes(word)) ? 50 : 0;
        return { option, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.option.title.localeCompare(right.option.title))
      .slice(0, 10)
      .map((entry) => entry.option);
  }, [options, query]);

  const choose = (option: DestinationSearchOption) => {
    setQuery(option.title);
    setOpen(false);
    trackEvent("destination_selected", { destination: option.title, destination_type: option.type });
    router.push(option.href);
  };

  const popularOptions = popular.map((title) => options.find((option) => option.title === title)).filter((option): option is DestinationSearchOption => Boolean(option));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex min-h-16 items-center gap-2 rounded-xl border border-brand-200 bg-white p-2 shadow-subtle focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
        <Search className="ml-3 h-5 w-5 shrink-0 text-brand-500" aria-hidden />
        <label htmlFor="destination-search" className="sr-only">Where are you travelling?</label>
        <input
          id="destination-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="destination-results"
          aria-activedescendant={open && results[activeIndex] ? `destination-${results[activeIndex]!.id}` : undefined}
          autoComplete="off"
          placeholder="Where are you headed?"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
            if (event.target.value.trim().length >= 2) trackEvent("destination_search", { query_length: event.target.value.trim().length });
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && open && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]!); }
          }}
          className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm font-medium text-brand-900 placeholder:font-normal placeholder:text-brand-500 focus:outline-none"
        />
        <button type="button" disabled={!results[0]} className="hidden h-12 shrink-0 items-center justify-center rounded-lg bg-brand-900 px-4 text-xs font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex" onClick={() => results[0] && choose(results[0])}>
          Find my eSIM <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        disabled={!results[0]}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-900 px-4 text-xs font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
        onClick={() => results[0] && choose(results[0])}
      >
        Find my eSIM
      </button>

      {open ? (
        <div id="destination-results" role="listbox" className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 max-h-80 overflow-y-auto rounded-2xl border border-brand-100 bg-white p-2 shadow-card">
          {results.length ? results.map((option, index) => {
            const flag = flagEmoji(option.countryCode);
            const Icon = option.type === "country" ? MapPin : Globe2;
            return (
              <button key={option.id} id={`destination-${option.id}`} type="button" role="option" aria-selected={index === activeIndex} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${index === activeIndex ? "bg-brand-50" : "hover:bg-brand-50"}`} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg">{flag ?? <Icon className="h-5 w-5 text-brand-600" aria-hidden />}</span>
                <span><span className="block font-bold text-brand-900">{option.title}</span><span className="block text-xs text-brand-500">{option.subtitle}</span></span>
              </button>
            );
          }) : (
            <div className="px-4 py-8 text-center"><p className="font-bold text-brand-900">No destination found</p><p className="mt-1 text-sm text-brand-600">Check the spelling or browse all available destinations below.</p></div>
          )}
        </div>
      ) : null}

      {popularOptions.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
          <span className="font-normal text-brand-500">Popular:</span>
          {popularOptions.map((option) => <button key={option.id} type="button" className="min-h-8 rounded-sm font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600" onClick={() => choose(option)}>{option.title}</button>)}
        </div>
      ) : null}
    </div>
  );
}
