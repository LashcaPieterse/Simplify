"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Database,
  Globe2,
  Info,
  MapPin,
  MessageCircle,
  Route,
  Search,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CountrySummary, EsimProductSummary, RegionBundle } from "@/lib/sanity.queries";
import { OrderButton } from "@/components/orders/OrderButton";
import { cn } from "@/components/utils";
import {
  DEFAULT_TRIP_DURATION_DAYS,
  DEFAULT_USAGE_PROFILE_ID,
  TRIP_DURATION_OPTIONS,
  USAGE_PROFILES,
  formatDataAmount,
  matchTripPlans,
  type TripRecommendation,
  type UsageProfileId,
} from "@/lib/esim/trip-matcher";
import { formatMoneyAmount } from "@/lib/format";
import { urlForImage } from "@/lib/image";
import { getExternalLinkProps, normalizeHref } from "@/lib/links";
import { getEsimProductHref } from "@/lib/products";

type TripPlanWidgetProps = {
  highlightedProducts: EsimProductSummary[];
  allProducts: EsimProductSummary[];
  fallbackCountries?: CountrySummary[];
  regionalBundle?: RegionBundle | null;
};

type DestinationChip = {
  label: string;
  slug: string;
};

const usageIcons: Record<UsageProfileId, LucideIcon> = {
  light: MessageCircle,
  social: Globe2,
  work: Briefcase,
  heavy: Zap,
};

export function TripPlanWidget({
  highlightedProducts,
  allProducts,
  fallbackCountries = [],
  regionalBundle,
}: TripPlanWidgetProps) {
  const [destination, setDestination] = useState("");
  const [durationDays, setDurationDays] = useState<number>(DEFAULT_TRIP_DURATION_DAYS);
  const [usageProfileId, setUsageProfileId] = useState<UsageProfileId>(DEFAULT_USAGE_PROFILE_ID);

  const products = allProducts.length ? allProducts : highlightedProducts;
  const highlightedProductIds = useMemo(() => highlightedProducts.map((product) => product._id), [highlightedProducts]);
  const destinationChips = useMemo(
    () => getDestinationChips({ highlightedProducts, allProducts, fallbackCountries }),
    [allProducts, fallbackCountries, highlightedProducts],
  );

  const match = useMemo(
    () =>
      matchTripPlans({
        destination,
        durationDays,
        usageProfileId,
        products,
        highlightedProductIds,
        fallbackCountries,
      }),
    [destination, durationDays, fallbackCountries, highlightedProductIds, products, usageProfileId],
  );

  const regionalHref =
    regionalBundle && match.isMultiDestination
      ? normalizeHref(regionalBundle.ctaTarget || (regionalBundle.slug ? `/bundle/${regionalBundle.slug}` : null))
      : null;
  const regionalLinkProps = regionalHref ? getExternalLinkProps(regionalHref) : {};
  const hasDestination = destination.trim().length > 0;

  return (
    <div className="relative rounded-3xl border border-brand-100/80 bg-white/75 p-5 shadow-card backdrop-blur-lg sm:p-6 lg:p-5">
      <div className="mb-5 flex items-start justify-between gap-4 lg:mb-4">
        <div>
          <p className="text-sm font-semibold text-brand-800">Plan your African eSIM</p>
          <p className="mt-1 text-xs text-brand-500">Match destination, stay length, and data needs.</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-600">Live match</span>
      </div>

      <div className="space-y-4 lg:space-y-3">
        <label className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-inner lg:py-2.5">
          <Search className="h-5 w-5 shrink-0 text-brand-500" />
          <input
            type="search"
            placeholder="Country or route"
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-brand-900 placeholder:text-brand-400 focus:outline-none"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            autoComplete="off"
          />
          <Route className="h-5 w-5 shrink-0 text-brand-500" />
        </label>

        {destinationChips.length ? (
          <div className="flex flex-wrap gap-2 lg:gap-1.5">
            {destinationChips.map((chip) => (
              <button
                key={chip.slug}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition lg:py-1",
                  destination.trim().toLowerCase() === chip.label.toLowerCase()
                    ? "border-brand-300 bg-brand-100 text-brand-800"
                    : "border-brand-100 bg-white text-brand-600 hover:border-brand-200 hover:text-brand-800",
                )}
                onClick={() => setDestination(chip.label)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-brand-50 p-1 lg:gap-1.5">
          {TRIP_DURATION_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              className={cn(
                "flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition lg:h-9",
                durationDays === days ? "bg-white text-brand-900 shadow-sm" : "text-brand-600 hover:text-brand-900",
              )}
              aria-pressed={durationDays === days}
              onClick={() => setDurationDays(days)}
            >
              {days}d
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {USAGE_PROFILES.map((profile) => {
            const Icon = usageIcons[profile.id];
            const selected = usageProfileId === profile.id;

            return (
              <button
                key={profile.id}
                type="button"
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition lg:min-h-11 xl:min-h-10 xl:gap-1.5 xl:px-2.5 xl:text-[0.7rem]",
                  selected
                    ? "border-brand-300 bg-brand-100 text-brand-900"
                    : "border-brand-100 bg-white text-brand-600 hover:border-brand-200 hover:text-brand-800",
                )}
                aria-pressed={selected}
                onClick={() => setUsageProfileId(profile.id)}
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                <span className="min-w-0 leading-snug xl:whitespace-nowrap">{profile.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-3 lg:mt-4 lg:space-y-2.5">
        {regionalHref ? (
          <a
            href={regionalHref}
            className="flex items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-800 transition hover:border-sand-300 hover:bg-sand-100 lg:py-2.5"
            {...regionalLinkProps}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-sand-500" />
              <span className="min-w-0">
                Multi-country trip? Compare {regionalBundle?.title ?? "regional coverage"}.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </a>
        ) : null}

        {match.primary ? (
          <>
            <RecommendationCard recommendation={match.primary} label="Best match" primary />
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:gap-2.5">
              <CompactAlternative label="Cheapest" recommendation={match.alternatives.cheapest} />
              <CompactAlternative label="More data" recommendation={match.alternatives.moreData} />
            </div>
          </>
        ) : hasDestination ? (
          <NoMatchState destination={destination} suggestions={match.suggestedCountries} onSelect={setDestination} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  label,
  primary = false,
}: {
  recommendation: TripRecommendation;
  label: string;
  primary?: boolean;
}) {
  const { product } = recommendation;
  const imageUrl = product.coverImage ? urlForImage(product.coverImage)?.width(240).height(160).url() : null;
  const href = getEsimProductHref(product);
  const priceLabel = formatMoneyAmount(recommendation.priceAmount, recommendation.priceCurrency, "Price unavailable");
  const validityLabel = recommendation.validityDays ? `${recommendation.validityDays} days` : "Validity varies";

  return (
    <article className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm lg:p-3.5 xl:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 lg:mb-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-[0.68rem] font-bold uppercase text-brand-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="text-sm font-semibold text-brand-900">{priceLabel}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_9.5rem] xl:items-stretch">
        <div className="min-w-0">
          <div className="flex gap-4 lg:gap-3">
            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-sand-100/70">
              {imageUrl ? (
                <Image src={imageUrl} alt={`${product.displayName} cover`} fill className="object-cover" sizes="80px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-brand-400">
                  {product.country?.title?.slice(0, 2).toUpperCase() ?? "SIM"}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className={cn("font-semibold leading-snug text-brand-900", primary ? "text-base" : "text-sm")}>
                {product.displayName}
              </h3>
              <p className="mt-1 text-xs text-brand-500">
                {[product.country?.title, recommendation.providerName].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 text-sm text-brand-700 lg:line-clamp-2 xl:line-clamp-1">
                {recommendation.fitReason}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs lg:mt-3">
            <Metric icon={Database} label={formatDataAmount(recommendation.dataLimitMb)} />
            <Metric icon={CalendarDays} label={validityLabel} />
            <Metric icon={Wifi} label="Install before landing" />
          </div>
        </div>

        <div className="hidden flex-col justify-end gap-2 xl:flex">
          <OrderButton packageId={recommendation.packageId} label="Buy eSIM" pendingLabel="Opening checkout..." fullWidth />
          {href ? (
            <Link
              href={href}
              className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 hover:text-brand-900"
            >
              View details
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row xl:hidden">
        <OrderButton packageId={recommendation.packageId} label="Buy eSIM" pendingLabel="Opening checkout..." fullWidth />
        {href ? (
          <Link
            href={href}
            className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 hover:text-brand-900"
          >
            View details
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function CompactAlternative({
  label,
  recommendation,
}: {
  label: string;
  recommendation: TripRecommendation | null;
}) {
  if (!recommendation) {
    return (
      <div className="rounded-2xl border border-brand-100 bg-white/70 px-4 py-3 text-xs text-brand-500 lg:py-2.5">
        No distinct {label.toLowerCase()} option yet.
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm lg:px-3.5 lg:py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2 lg:mb-1.5">
        <p className="text-xs font-bold uppercase text-brand-500">{label}</p>
        <p className="text-sm font-semibold text-brand-900">
          {formatMoneyAmount(recommendation.priceAmount, recommendation.priceCurrency, "")}
        </p>
      </div>
      <h4 className="line-clamp-2 min-h-9 text-sm font-semibold leading-snug text-brand-900 lg:min-h-0 xl:line-clamp-1">
        {recommendation.product.displayName}
      </h4>
      <p className="mt-1 text-xs text-brand-500">
        {formatDataAmount(recommendation.dataLimitMb)} · {recommendation.validityDays ?? "?"} days
      </p>
      <div className="mt-3 lg:mt-2">
        <OrderButton
          packageId={recommendation.packageId}
          label="Buy"
          pendingLabel="Opening..."
          variant="ghost"
          size="sm"
          fullWidth
        />
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex min-h-14 flex-col justify-center rounded-xl bg-brand-50 px-3 py-2 text-brand-700 lg:min-h-12 xl:min-h-11">
      <Icon className="mb-1 h-4 w-4 text-brand-500" />
      <span className="break-words text-[0.7rem] font-semibold leading-tight">{label}</span>
    </div>
  );
}

function NoMatchState({
  destination,
  suggestions,
  onSelect,
}: {
  destination: string;
  suggestions: CountrySummary[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-4 lg:py-3">
      <div className="flex gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <div>
          <p className="text-sm font-semibold text-brand-900">No active match for “{destination}”.</p>
          <p className="mt-1 text-sm text-brand-600">Try one of the live African destinations below.</p>
        </div>
      </div>
      {suggestions.length ? (
        <div className="mt-4 flex flex-wrap gap-2 lg:mt-3">
          {suggestions.map((country) => (
            <button
              key={country._id}
              type="button"
              className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-200 hover:bg-brand-100"
              onClick={() => onSelect(country.title)}
            >
              {country.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-4 text-sm text-brand-600 lg:py-3">
      Live plans are syncing. Pick a destination to see the best available match.
    </div>
  );
}

function getDestinationChips({
  highlightedProducts,
  allProducts,
  fallbackCountries,
}: {
  highlightedProducts: EsimProductSummary[];
  allProducts: EsimProductSummary[];
  fallbackCountries: CountrySummary[];
}): DestinationChip[] {
  const chips: DestinationChip[] = [];
  const seen = new Set<string>();

  const addCountry = (country: CountrySummary | undefined) => {
    if (!country?.title || !country.slug || seen.has(country.slug)) {
      return;
    }

    seen.add(country.slug);
    chips.push({ label: country.title, slug: country.slug });
  };

  highlightedProducts.forEach((product) => addCountry(product.country));
  fallbackCountries.forEach(addCountry);
  allProducts.forEach((product) => addCountry(product.country));

  return chips.slice(0, 5);
}
