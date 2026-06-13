"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StarIcon } from "@heroicons/react/24/outline";
import type {
  CountrySummary,
  EsimProductSummary,
  HeroSection,
  Link as SanityLink,
  RegionBundle
} from "@/lib/sanity.queries";
import { getExternalLinkProps, resolveLinkHref } from "@/lib/links";
import { TripPlanWidget } from "./TripPlanWidget";

const fadeIn = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.6, ease: "easeOut" }
};

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
    <section className="relative mb-24 grid gap-10 lg:mb-0 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(38rem,40rem)] xl:gap-14 min-[1440px]:grid-cols-[minmax(36rem,1fr)_minmax(44rem,44rem)] min-[1440px]:gap-16 2xl:grid-cols-[minmax(38rem,1fr)_minmax(46rem,48rem)] 2xl:gap-20">
      <motion.div
        className="max-w-[44rem] space-y-8 lg:pt-8 xl:pt-12 min-[1440px]:pt-16 2xl:max-w-[46rem] 2xl:pt-20"
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        variants={{ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 } }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-subtle">
          <StarIcon className="h-4 w-4 text-sand-500" />
          {tagline}
        </span>
        <h1 className="font-display text-4xl tracking-tight text-brand-900 sm:text-5xl lg:text-[3.35rem] xl:text-[3.55rem] 2xl:text-[3.75rem]">{hero.headline}</h1>
        <p className="max-w-2xl text-lg text-brand-700">{hero.subhead}</p>
        {hero.ctas?.length ? (
          <motion.div
            className="flex flex-col gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
          >
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
          </motion.div>
        ) : null}
        {hero.stats?.length ? (
          <div className="pt-2">
            <div className="flex flex-wrap gap-5 xl:gap-8">
              {hero.stats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <p className="text-2xl font-semibold text-brand-900">{stat.value}</p>
                  <p className="text-sm text-brand-600">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </motion.div>

      <motion.div
        className="relative w-full lg:max-w-[36rem] lg:justify-self-end xl:max-w-[40rem] min-[1440px]:max-w-[44rem] 2xl:max-w-[48rem]"
        {...fadeIn}
        transition={{ ...fadeIn.transition, delay: 0.2 }}
      >
        <TripPlanWidget
          highlightedProducts={highlightedProducts}
          allProducts={allProducts}
          fallbackCountries={fallbackCountries}
          regionalBundle={regionalBundle}
          settings={hero.tripMatcherSettings}
        />
      </motion.div>
    </section>
  );
}
