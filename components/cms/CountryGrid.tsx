import type { Route } from "next";
import type { CountryGridSection } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";
import { EsimProductCard } from "@/components/ui/EsimProductCard";
import type { EsimProductCardData } from "@/lib/products";

const mapCountryToProductCard = (country: CountryGridSection["countries"][number]): EsimProductCardData => {
  const imageUrl = country.coverImage ? urlForImage(country.coverImage)?.width(360).height(240).url() ?? null : null;
  const plan = country.plan;

  return {
    id: country._id,
    title: country.title,
    badge: country.badge,
    providerName: plan?.provider?.title,
    description: plan?.shortBlurb ?? country.summary,
    href: `/country/${country.slug}` as Route,
    ctaLabel: "View plans",
    image: {
      url: imageUrl,
      alt: `${country.title} cover`
    },
    price:
      typeof plan?.priceUSD === "number"
        ? { amount: plan.priceUSD, currency: "USD" }
        : { label: "Multiple plans" }
  };
};

export function CountryGrid({ section }: { section: CountryGridSection }) {
  return (
    <section id="store" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">{section.title}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {section.countries.map((country) => {
          const productCard = country.productCard ?? mapCountryToProductCard(country);

          return <EsimProductCard key={productCard.id} product={productCard} />;
        })}
      </div>
    </section>
  );
}
