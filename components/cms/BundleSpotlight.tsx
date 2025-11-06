import Image from "next/image";
import Link from "next/link";
import type { RegionalBundleSpotlightSection } from "@/lib/sanity.queries";
import { Button } from "@/components/ui/button";
import { urlForImage } from "@/lib/image";

export function BundleSpotlight({ section }: { section: RegionalBundleSpotlightSection }) {
  const bundle = section.bundle;
  const heroImage = bundle.heroImage ? urlForImage(bundle.heroImage)?.width(640).height(480).url() : null;

  return (
    <section id="coverage" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Coverage spotlight</p>
        <h2 className="mt-3 font-display text-3xl text-brand-900 sm:text-4xl">{section.title}</h2>
        <p className="mt-3 max-w-2xl text-base text-brand-700">
          Shared data across multiple destinations with seamless handoffs and dependable support from the Simplify crew.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-brand-100/80 bg-gradient-to-br from-white via-white to-brand-100/60 p-8 shadow-card">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-2xl text-brand-900">{bundle.title}</h3>
            {bundle.fiveG ? (
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase text-brand-600">5G ready</span>
            ) : null}
          </div>
          <p className="max-w-md text-sm text-brand-600">
            {bundle.support} · {bundle.sharedDataGB}GB shared data across {bundle.countries.length} countries.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {bundle.includes.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3">
                <span className="material-symbols-rounded text-brand-500">check_circle</span>
                <span className="text-sm font-medium text-brand-700">{item}</span>
              </div>
            ))}
          </div>
          {bundle.perks?.length ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {bundle.perks.map((perk) => (
                <div key={perk} className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-brand-600">
                  {perk}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {bundle.ctaTarget && bundle.ctaLabel ? (
              <Button size="lg" className="shadow-subtle" asChild>
                <Link href={bundle.ctaTarget}>{bundle.ctaLabel}</Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="lg" asChild>
              <Link href="/#coverage">Compare all regions</Link>
            </Button>
          </div>
        </div>

        <div className="relative rounded-[2rem] border border-brand-100/80 bg-white/70 p-8 shadow-card backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-700">Included destinations</p>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-brand-500">
              <span className="material-symbols-rounded text-brand-400">map</span>
              {bundle.countries.length} countries
            </span>
          </div>
          <ul className="space-y-4">
            {bundle.countries.map((country) => (
              <li key={country._id} className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-brand-800">{country.title}</p>
                  <p className="text-xs text-brand-500">/country/{country.slug}</p>
                </div>
                <span className="material-symbols-rounded text-brand-400">trending_up</span>
              </li>
            ))}
          </ul>
          {heroImage ? (
            <div className="mt-6 overflow-hidden rounded-2xl">
              <Image src={heroImage} alt={`${bundle.title} hero`} width={640} height={360} className="h-auto w-full object-cover" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
