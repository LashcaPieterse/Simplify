import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getCountryBySlug,
  getCountriesList,
  getPlansForCountry,
  type PlanDetail
} from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";

export const revalidate = 60;

export async function generateStaticParams() {
  const countries = await getCountriesList();
  return countries.map((country) => ({ slug: country.slug }));
}

type CountryPageProps = {
  params: { slug: string };
};

export default async function CountryPage({ params }: CountryPageProps) {
  const country = await getCountryBySlug(params.slug);

  if (!country) {
    notFound();
  }

  const plans = await getPlansForCountry(params.slug);
  const heroImage = country.coverImage ? urlForImage(country.coverImage)?.width(800).height(480).url() : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-[1fr,0.9fr] lg:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
            Country guide
          </span>
          <h1 className="font-display text-4xl text-brand-900 sm:text-5xl">eSIM plans for {country.title}</h1>
          <p className="text-lg text-brand-700">{country.summary}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-brand-600">
            {country.badge ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-600">
                <span className="material-symbols-rounded text-brand-400">star</span>
                {country.badge}
              </span>
            ) : null}
            {country.carriers?.length ? <span>{country.carriers.length} partner carriers</span> : null}
            {plans.length ? <span>{plans.length} curated plans</span> : null}
          </div>
        </div>
        {heroImage ? (
          <div className="relative h-72 w-full overflow-hidden rounded-[2rem] border border-brand-100/80 bg-sand-100/60 shadow-card">
            <Image src={heroImage} alt={`${country.title} cover`} fill className="object-cover" />
          </div>
        ) : null}
      </div>

      {country.carriers?.length ? (
        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-brand-900">Featured carriers</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {country.carriers.map((carrier) => {
              const logoUrl = carrier.logo ? urlForImage(carrier.logo)?.width(160).height(160).url() : null;
              return (
                <div key={carrier._id} className="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white px-5 py-4 shadow-card">
                  {logoUrl ? (
                    <Image src={logoUrl} alt={carrier.title} width={48} height={48} className="rounded-full" />
                  ) : (
                    <span className="material-symbols-rounded text-brand-400">wifi</span>
                  )}
                  <div>
                    <p className="font-semibold text-brand-800">{carrier.title}</p>
                    <p className="text-xs text-brand-500">Trusted Simplify partner</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-20">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-brand-900">Plans that travellers love</h2>
          <Link href="/#store" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
            Browse all plans
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard key={plan._id} plan={plan} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanDetail }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-3xl border border-brand-100/80 bg-white p-6 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">{plan.provider?.title}</p>
        {plan.label ? (
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase text-brand-600">{plan.label}</span>
        ) : null}
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="font-display text-2xl text-brand-900">{plan.title}</h3>
        <p className="text-sm text-brand-600">{plan.shortBlurb}</p>
      </div>
      <ul className="mt-6 space-y-2 text-sm text-brand-600">
        <li className="flex items-center gap-2">
          <span className="material-symbols-rounded text-brand-400">data_usage</span>
          {plan.dataGB}GB high-speed data
        </li>
        <li className="flex items-center gap-2">
          <span className="material-symbols-rounded text-brand-400">schedule</span>
          {plan.validityDays}-day validity
        </li>
        <li className="flex items-center gap-2">
          <span className="material-symbols-rounded text-brand-400">wifi_tethering</span>
          {plan.hotspot ? "Hotspot enabled" : "Hotspot not supported"}
        </li>
        <li className="flex items-center gap-2">
          <span className="material-symbols-rounded text-brand-400">network_wifi_3_bar</span>
          {plan.fiveG ? "5G where available" : "4G/LTE coverage"}
        </li>
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-2xl font-semibold text-brand-900">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
            plan.priceUSD
          )}
        </p>
        <Button asChild>
          <Link href={`/plan/${plan.slug}`}>View details</Link>
        </Button>
      </div>
    </div>
  );
}
