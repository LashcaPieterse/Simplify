import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Headset, SignalHigh } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBundleBySlug, getRegionBundles } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  const bundles = await getRegionBundles();
  return bundles.map((bundle) => ({ slug: bundle.slug }));
}

type BundlePageProps = {
  params: { slug: string };
};

export default async function BundlePage({ params }: BundlePageProps) {
  const bundle = await getBundleBySlug(params.slug);

  if (!bundle) {
    notFound();
  }

  const heroImage = bundle.heroImage ? urlForImage(bundle.heroImage)?.width(960).height(600).url() : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
            Regional bundle
          </span>
          <h1 className="font-display text-4xl text-brand-900 sm:text-5xl">{bundle.title}</h1>
          <p className="text-base text-brand-600">
            Shared {bundle.sharedDataGB}GB of data across {bundle.countries.length} destinations with {bundle.support} support.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-brand-600">
            {bundle.fiveG ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-600">
                <SignalHigh className="h-5 w-5 text-brand-400" />
                5G ready
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-600">
              <Headset className="h-5 w-5 text-brand-400" />
              {bundle.support}
            </span>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {bundle.ctaTarget && bundle.ctaLabel ? (
              <Button size="lg" className="shadow-subtle" asChild>
                <a href={bundle.ctaTarget}>{bundle.ctaLabel}</a>
              </Button>
            ) : null}
            <Button variant="ghost" size="lg" asChild>
              <Link href="/#coverage">Compare bundles</Link>
            </Button>
          </div>
        </div>
        {heroImage ? (
          <div className="relative h-80 w-full overflow-hidden rounded-[2rem] border border-brand-100/80 bg-sand-100/60 shadow-card">
            <Image src={heroImage} alt={`${bundle.title} hero`} fill className="object-cover" />
          </div>
        ) : null}
      </div>

      <section className="mt-16 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">Included destinations</h2>
          <ul className="mt-4 space-y-3 text-sm text-brand-600">
            {bundle.countries.map((country) => (
              <li key={country._id} className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                <span>{country.title}</span>
                <Link href={`/country/${country.slug}`} className="text-brand-600 hover:text-brand-800">
                  Explore
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">Perks &amp; support</h2>
          <ul className="mt-4 space-y-3 text-sm text-brand-600">
            {bundle.includes.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-brand-400" />
                {item}
              </li>
            ))}
          </ul>
          {bundle.perks?.length ? (
            <div className="mt-6 space-y-2">
              {bundle.perks.map((perk) => (
                <div key={perk} className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-600">
                  {perk}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
