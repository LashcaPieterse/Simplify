"use client";

import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import type {
  CountrySummary,
  EsimProductSummary,
  HeroSection,
  Link as SanityLink,
  RegionBundle
} from "@/lib/sanity.queries";
import { getExternalLinkProps, resolveLinkHref } from "@/lib/links";
import { TripPlanWidget } from "./TripPlanWidget";

type HeroProps = {
  hero: HeroSection;
  tagline: string;
  highlightedProducts: EsimProductSummary[];
  allProducts: EsimProductSummary[];
  fallbackCountries?: CountrySummary[];
  regionalBundle?: RegionBundle | null;
};

const getCtaHref = (cta: SanityLink) => resolveLinkHref(cta);

export function Hero({
  hero,
  tagline,
  highlightedProducts,
  allProducts,
  fallbackCountries = [],
  regionalBundle = null
}: HeroProps) {
  return (
    <section className="relative mb-24 grid gap-10 lg:mb-0 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(38rem,40rem)] xl:gap-14 min-[1440px]:grid-cols-[minmax(36rem,1fr)_minmax(42rem,43rem)] min-[1440px]:gap-16 2xl:grid-cols-[minmax(38rem,1fr)_minmax(44rem,46rem)] 2xl:gap-20">
      <div className="max-w-[44rem] space-y-8 lg:pt-8 xl:pt-12 min-[1440px]:pt-16 2xl:max-w-[46rem] 2xl:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-subtle">
          <Star className="h-4 w-4 text-sand-500" aria-hidden />
          {tagline}
        </span>
        <h1 className="font-display text-4xl tracking-tight text-brand-900 sm:text-5xl lg:text-[3.35rem] xl:text-[3.55rem] 2xl:text-[3.75rem]">{hero.headline}</h1>
        <p className="max-w-2xl text-lg text-brand-700">{hero.subhead}</p>
        {hero.ctas?.length ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            {hero.ctas.map((cta, index) => {
              const href = getCtaHref(cta);
              const externalProps = getExternalLinkProps(href);

              return (
                <Button
                  key={cta.label}
                  size="lg"
                  asChild
                  variant={index === 0 ? "primary" : "secondary"}
                  className={index === 0 ? "shadow-subtle" : undefined}
                >
                  <a href={href} {...externalProps}>
                    {cta.label}
                  </a>
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="relative w-full lg:max-w-[36rem] lg:justify-self-end xl:max-w-[40rem] min-[1440px]:max-w-[43rem] 2xl:max-w-[46rem]">
        <TripPlanWidget
          highlightedProducts={highlightedProducts}
          allProducts={allProducts}
          fallbackCountries={fallbackCountries}
          regionalBundle={regionalBundle}
          settings={hero.tripMatcherSettings}
        />
      </div>
    </section>
  );
}
