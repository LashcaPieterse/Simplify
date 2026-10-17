import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, CircleDollarSign, LockKeyhole, MailCheck } from "lucide-react";

import { TrackView } from "@/components/analytics/TrackView";
import { PlanExplorer } from "@/components/plans/PlanExplorer";
import { UsageRecommender } from "@/components/plans/UsageRecommender";
import { getStorefrontPlansForCountry } from "@/lib/catalog/storefront";

export const dynamic = "force-static";
export const revalidate = 300;

type CountryPageProps = { params: Promise<{ slug: string }> };

// Catalogue routes use lazy ISR. Prebuilding every destination multiplies remote
// database reads during deploys and can exhaust a pooled connection.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const plans = await getStorefrontPlansForCountry(slug);
  const country = plans[0]?.destination;
  if (!country) return {};

  const title = `eSIM for ${country.title} | Prepaid Travel Data`;
  const description = `Buy an eSIM for ${country.title} before you travel. Compare currently available prepaid data plans, install online, and follow the package activation instructions.`;
  return {
    title,
    description,
    alternates: { canonical: `/country/${country.slug}` },
    openGraph: { title, description, url: `/country/${country.slug}`, type: "website" },
  };
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { slug } = await params;
  const plans = await getStorefrontPlansForCountry(slug);
  if (!plans.length) notFound();
  const country = plans[0]!.destination;
  const packageOperators = Array.from(new Set(plans.map((plan) => plan.operatorName).filter((value): value is string => Boolean(value)))).sort();
  const namedCarriers = Array.from(new Set(plans.flatMap((plan) => plan.networks))).sort();
  const networkTypes = Array.from(new Set(plans.flatMap((plan) => plan.networkTypes)));
  const rechargeablePlanCount = plans.filter((plan) => plan.topUpAvailable === true).length;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://sim.africa" },
      { "@type": "ListItem", position: 2, name: "Destinations", item: "https://sim.africa/destinations" },
      { "@type": "ListItem", position: 3, name: country.title, item: `https://sim.africa/country/${country.slug}` },
    ],
  };
  const countryFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `When should I install an eSIM for ${country.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Use the installation window and activation policy shown on the selected package page because supplier rules can vary by package.",
        },
      },
      {
        "@type": "Question",
        name: `Can I keep WhatsApp while using an eSIM in ${country.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "On most dual-SIM phones, WhatsApp can stay registered to the existing number while the eSIM is selected for mobile data.",
        },
      },
      {
        "@type": "Question",
        name: `Does my phone need to be unlocked for a ${country.title} eSIM?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "The phone needs eSIM support and generally must be carrier or network unlocked.",
        },
      },
    ],
  };

  return (
    <div>
      <TrackView event="country_view" properties={{ country: country.title, country_code: country.countryCode }} />
      <div className="border-b border-brand-100 bg-brand-50">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-brand-600">
            <Link href="/">Home</Link><ChevronRight className="h-4 w-4" aria-hidden /><Link href="/destinations">Destinations</Link><ChevronRight className="h-4 w-4" aria-hidden /><span aria-current="page">{country.title}</span>
          </nav>
          <p className="mt-9 text-xs font-black uppercase tracking-[0.2em] text-brand-600">{country.countryCode} travel connectivity</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-900 sm:text-6xl">eSIM for {country.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-700">Stay connected in {country.title} without relying on your home network&apos;s international roaming. Compare the available plans below.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-brand-700">
            <span className="rounded-full border border-brand-200 bg-white px-4 py-2">{plans.length} active plan{plans.length === 1 ? "" : "s"}</span>
            <span className="rounded-full border border-brand-200 bg-white px-4 py-2">Current catalogue pricing</span>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16" aria-labelledby="available-plans">
        <div className="mb-8 max-w-3xl"><h2 id="available-plans" className="text-3xl font-black text-brand-900 sm:text-4xl">Available {country.title} eSIM plans</h2><p className="mt-3 leading-7 text-brand-600">Unknown plan attributes are labelled as unknown. Recommendation labels use explicit price, data, validity, and trip-estimate calculations within this eligible result set.</p></div>
        <div className="mb-10">
          <UsageRecommender country={country.title} plans={plans} />
        </div>
        <PlanExplorer plans={plans} />
      </section>

      <section className="border-y border-brand-100 bg-brand-50">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">Current catalogue snapshot</p><h2 className="mt-2 text-3xl font-black text-brand-900">What the available {country.title} packages tell us</h2><p className="mt-3 text-sm leading-6 text-brand-600">These details are derived only from the currently sellable supplier package records. A missing value is left unknown.</p></div>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SnapshotFact label="Package operator(s)" value={packageOperators.length ? packageOperators.join(", ") : "Not supplied"} />
            <SnapshotFact label="Named carrier(s)" value={namedCarriers.length ? namedCarriers.join(", ") : "Not supplied"} />
            <SnapshotFact label="Network types" value={networkTypes.length ? networkTypes.join(" / ") : "Not supplied"} />
            <SnapshotFact label="Top-up availability" value={rechargeablePlanCount ? `${rechargeablePlanCount} of ${plans.length} plans marked available` : "No current plan marked available"} />
          </dl>
        </div>
      </section>

      <section className="border-y border-brand-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          <CountryTrust icon={CircleDollarSign} title="Transparent price" body="The displayed selling price comes from the current active package record." />
          <CountryTrust icon={LockKeyhole} title="Secure checkout" body="Payment is handled by the configured provider; raw card details are not stored here." />
          <CountryTrust icon={MailCheck} title="Order instructions" body="Your fulfilled order includes the available installation and activation information." />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black text-brand-900">Using an eSIM in {country.title}</h2>
        <div className="mt-8 divide-y divide-brand-100 rounded-3xl border border-brand-100 bg-white px-6">
          <details className="py-5"><summary className="cursor-pointer font-bold text-brand-900">When should I install it?</summary><p className="mt-3 text-sm leading-6 text-brand-600">Use the installation window and activation policy shown on the individual package page. These rules can vary between supplier packages.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold text-brand-900">Can I keep WhatsApp and my normal SIM?</summary><p className="mt-3 text-sm leading-6 text-brand-600">Yes, on most dual-SIM devices. Keep WhatsApp registered to your existing number and select the eSIM as the mobile-data line.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold text-brand-900">Is my phone compatible?</summary><p className="mt-3 text-sm leading-6 text-brand-600">Your device needs eSIM support and generally must be carrier unlocked. <Link href="/compatibility" className="font-bold text-brand-700 underline">Check the compatibility tool</Link>.</p></details>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(countryFaqSchema).replace(/</g, "\\u003c") }} />
    </div>
  );
}

function CountryTrust({ icon: Icon, title, body }: { icon: typeof CircleDollarSign; title: string; body: string }) {
  return <div className="rounded-2xl bg-brand-50 p-5"><Icon className="h-6 w-6 text-brand-600" aria-hidden /><h3 className="mt-4 font-black text-brand-900">{title}</h3><p className="mt-2 text-sm leading-6 text-brand-600">{body}</p></div>;
}

function SnapshotFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-brand-100 bg-white p-5"><dt className="text-xs font-black uppercase tracking-wide text-brand-500">{label}</dt><dd className="mt-2 break-words text-sm font-semibold leading-6 text-brand-900">{value}</dd></div>;
}
