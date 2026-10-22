import { RetailPrice } from "@/components/currency/CurrencyProvider";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { StorefrontCountry } from "@/lib/catalog/storefront";
import { destinationArt } from "@/lib/content/destination-art";
import { formatMoneyAmount } from "@/lib/format";

export function DestinationCard({ country, photograph = false }: { country: StorefrontCountry; photograph?: boolean }) {
  const art = photograph ? destinationArt[country.slug] : undefined;
  return (
    <Link href={`/country/${country.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white transition-colors duration-200 hover:border-brand-300 hover:shadow-card">
      {art ? <div className="relative aspect-[4/3] overflow-hidden bg-brand-100"><Image src={art.src} alt={art.alt} fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw" className="object-cover" /><span className="absolute left-4 top-4 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-900">{country.countryCode}</span></div> : null}
      <div className="flex flex-1 items-center justify-between gap-3 p-5">
        <div className="flex min-w-0 items-center gap-3">{!art ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold tracking-wider text-brand-600" aria-hidden>{country.countryCode}</span> : null}<div><h3 className="text-lg font-semibold text-brand-900">{country.title}</h3><p className="mt-1 text-xs leading-5 text-brand-500">From <span className="font-semibold text-brand-900">{<RetailPrice prices={country.minimumPrices} fallback={formatMoneyAmount(country.minimumPrice.amount, country.minimumPrice.currency)} />}</span><span className="mx-1.5 text-brand-300">/</span>{country.planCount} plan{country.planCount === 1 ? "" : "s"}</p></div></div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-100 transition-colors group-hover:border-accent-200 group-hover:bg-accent-200"><ArrowUpRight className="h-4 w-4" aria-hidden /></span>
      </div>
    </Link>
  );
}
