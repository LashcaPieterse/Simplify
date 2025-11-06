import Image from "next/image";
import Link from "next/link";
import type { CountryGridSection } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";
import { Button } from "@/components/ui/button";

export function CountryGrid({ section }: { section: CountryGridSection }) {
  return (
    <section id="store" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">{section.title}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {section.countries.map((country) => {
          const imageUrl = country.coverImage ? urlForImage(country.coverImage)?.width(360).height(240).url() : null;
          const plan = country.plan;

          return (
            <div
              key={country._id}
              className="flex h-full flex-col rounded-3xl border border-brand-100/80 bg-white p-6 shadow-card"
            >
              <div className="relative mb-5 h-40 w-full overflow-hidden rounded-2xl bg-sand-100/60">
                {imageUrl ? (
                  <Image src={imageUrl} alt={`${country.title} cover`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 360px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-brand-400">Image coming soon</div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl text-brand-900">{country.title}</h3>
                  {country.badge ? (
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase text-brand-600">
                      {country.badge}
                    </span>
                  ) : null}
                </div>
                {plan?.provider?.title ? (
                  <p className="text-sm text-brand-500">{plan.provider.title}</p>
                ) : null}
                <p className="text-sm text-brand-600">{plan?.shortBlurb ?? country.summary}</p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                {plan?.priceUSD ? (
                  <p className="text-lg font-semibold text-brand-900">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                      plan.priceUSD
                    )}
                  </p>
                ) : (
                  <span className="text-sm text-brand-500">Multiple plans</span>
                )}
                <Button size="sm" asChild>
                  <Link href={`/country/${country.slug}`}>View plans</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
