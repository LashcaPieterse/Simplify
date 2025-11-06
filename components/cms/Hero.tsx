"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MagnifyingGlassIcon, StarIcon } from "@heroicons/react/24/outline";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import type { CountrySummary, HeroSection, Link as SanityLink } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";
import { getExternalLinkProps, resolveLinkHref } from "@/lib/links";

const fadeIn = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.6, ease: "easeOut" }
};

type HeroProps = {
  hero: HeroSection;
  tagline: string;
  featuredCountries?: CountrySummary[];
};

const formatPrice = (price?: number) => {
  if (typeof price !== "number") {
    return "";
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
};

const getCtaHref = (cta: SanityLink) => resolveLinkHref(cta);

export function Hero({ hero, tagline, featuredCountries }: HeroProps) {
  const staggeredCountries = useMemo(() => {
    if (!featuredCountries?.length) {
      return [];
    }

    return featuredCountries.map((country, index) => ({ country, delay: 0.2 * index }));
  }, [featuredCountries]);

  return (
    <section className="relative mb-24 grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
      <motion.div
        className="space-y-8"
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
        <h1 className="font-display text-4xl tracking-tight text-brand-900 sm:text-5xl lg:text-[3.35rem]">{hero.headline}</h1>
        <p className="max-w-xl text-lg text-brand-700">{hero.subhead}</p>
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
            <div className="flex flex-wrap gap-5">
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
        className="relative rounded-3xl border border-brand-100/80 bg-white/70 p-6 shadow-card backdrop-blur-lg"
        {...fadeIn}
        transition={{ ...fadeIn.transition, delay: 0.2 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-700">Where do you need an eSIM?</p>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-600">Live</span>
        </div>
        <label className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-inner">
          <MagnifyingGlassIcon className="h-5 w-5 text-brand-500" />
          <input
            type="search"
            placeholder="Search by country or city"
            className="w-full border-none bg-transparent text-sm text-brand-900 placeholder:text-brand-400 focus:outline-none"
          />
          <ArrowUpRight className="h-5 w-5 text-brand-500" />
        </label>

        <div className="space-y-4">
          {staggeredCountries.length ? (
            staggeredCountries.map(({ country, delay }) => {
              const plan = country.plan;
              const imageUrl = country.coverImage ? urlForImage(country.coverImage)?.width(240).height(160).url() : null;

              return (
                <motion.article
                  key={country._id}
                  className="flex items-start gap-4 rounded-2xl border border-brand-100/80 bg-white px-4 py-4 shadow-sm"
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay, duration: 0.5, ease: "easeOut" }}
                >
                  <div className="relative h-16 w-20 overflow-hidden rounded-xl bg-sand-100/70">
                    {imageUrl ? (
                      <Image src={imageUrl} alt={`${country.title} cover`} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-brand-400">No image</div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-brand-800">{country.title}</p>
                      {country.badge ? (
                        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase text-brand-600">
                          {country.badge}
                        </span>
                      ) : null}
                    </div>
                    {plan?.provider?.title ? <p className="text-xs text-brand-500">{plan.provider.title}</p> : null}
                    <p className="font-medium text-brand-900">{plan?.title ?? "View plans"}</p>
                    <p className="text-sm text-brand-600">{plan?.shortBlurb ?? country.summary}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    {plan?.priceUSD ? (
                      <p className="font-semibold text-brand-900">{formatPrice(plan.priceUSD)}</p>
                    ) : null}
                    <Button variant="ghost" size="sm" className="text-xs" asChild>
                      <Link href={`/country/${country.slug}`}>View</Link>
                    </Button>
                  </div>
                </motion.article>
              );
            })
          ) : (
            <p className="text-sm text-brand-500">Add featured countries to this section to highlight plans.</p>
          )}
        </div>
      </motion.div>
    </section>
  );
}
