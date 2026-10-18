import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  Database,
  Globe2,
  Info,
  Phone,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { TrackView } from "@/components/analytics/TrackView";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { WhatsAppSupportLink } from "@/components/site/WhatsAppSupportLink";
import { storefrontPlanToCartItem, formatKnownBoolean } from "@/lib/catalog/presentation";
import {
  getStorefrontPlan,
} from "@/lib/catalog/storefront";
import { formatMoneyAmount } from "@/lib/format";
import { formatActivationPolicy } from "@/lib/esim/activation";

export const dynamic = "force-static";
export const revalidate = 300;

type PlanPageProps = { params: Promise<{ slug: string }> };

// Plans are generated on first request and revalidated for five minutes. This
// keeps deployment independent of the size and momentary health of the catalogue.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({ params }: PlanPageProps): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getStorefrontPlan(slug);
  if (!plan) return {};
  const title = `${plan.dataLabel} eSIM for ${plan.destination.title}`;
  const description = `Explore the ${plan.title} eSIM for ${plan.destination.title}: ${plan.dataLabel}, ${plan.validityDays ? `${plan.validityDays} days` : "package validity"}, coverage, activation, and setup guidance.`;
  return {
    title,
    description,
    alternates: { canonical: `/plan/${encodeURIComponent(plan.externalId)}` },
    openGraph: { title, description, url: `/plan/${encodeURIComponent(plan.externalId)}`, type: "website" },
  };
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { slug } = await params;
  const plan = await getStorefrontPlan(slug);
  if (!plan) notFound();

  const suppliedCallAllowances = [
    plan.callsMinutes ? `${plan.callsMinutes} voice minutes` : null,
    plan.texts ? `${plan.texts} texts` : null,
  ].filter(Boolean).join(" · ");
  const callsAndTexts = suppliedCallAllowances || formatKnownBoolean(plan.callsAndSms, {
    yes: "Included; allowance not provided",
    no: "Data only",
  });
  const networkLabel = plan.networkTypes.length ? plan.networkTypes.join(" / ") : "Unknown";
  const carrierLabel = plan.networks.length ? plan.networks.join(", ") : plan.operatorName ?? "Unknown";
  const cartItem = storefrontPlanToCartItem(plan);
  const activationGuidance = formatActivationPolicy(
    plan.activationPolicy,
    "Contact support to confirm when this plan starts before you buy or install it.",
  );
  const coverageNames = plan.coverage.map((destination) => destination.name);
  const destinationHref = (plan.isRegional
    ? `/regional-esims#${plan.destination.slug}`
    : `/country/${plan.destination.slug}`) as Route;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${plan.title} eSIM for ${plan.destination.title}`,
    description: plan.shortInfo ?? `${plan.dataLabel} travel eSIM for ${plan.destination.title}.`,
    sku: plan.externalId,
    category: "Travel eSIM",
    brand: { "@type": "Brand", name: "SIM.Africa" },
    offers: {
      "@type": "Offer",
      price: plan.price.amount,
      priceCurrency: plan.price.currency,
      availability: "https://schema.org/InStock",
      url: `https://sim.africa/plan/${encodeURIComponent(plan.externalId)}`,
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://sim.africa" },
      { "@type": "ListItem", position: 2, name: plan.isRegional ? "Regional eSIMs" : plan.destination.title, item: `https://sim.africa${destinationHref}` },
      { "@type": "ListItem", position: 3, name: plan.title, item: `https://sim.africa/plan/${encodeURIComponent(plan.externalId)}` },
    ],
  };

  return (
    <div className="pb-24 lg:pb-0">
      <TrackView event="plan_view" properties={{ package_id: plan.externalId, destination: plan.destination.title }} />
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-brand-600">
          <Link href="/">Home</Link><ChevronRight className="h-4 w-4" aria-hidden /><Link href={destinationHref}>{plan.isRegional ? "Regional eSIMs" : plan.destination.title}</Link><ChevronRight className="h-4 w-4" aria-hidden /><span aria-current="page">{plan.title}</span>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">{plan.isRegional ? "Regional travel eSIM" : `eSIM for ${plan.destination.title}`}</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-brand-900 sm:text-6xl">{plan.title}</h1>
            {plan.shortInfo ? <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-600">{plan.shortInfo}</p> : null}

            <dl className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroFact icon={Database} label="Data" value={plan.dataLabel} />
              <HeroFact icon={CalendarDays} label="Validity" value={plan.validityDays ? `${plan.validityDays} days` : "Unknown"} />
              <HeroFact icon={Radio} label="Network" value={networkLabel} />
              <HeroFact icon={Globe2} label="Destination" value={plan.destination.title} />
            </dl>
          </div>

          <aside className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card lg:sticky lg:top-28">
            <p className="text-xs font-black uppercase tracking-wide text-brand-500">Price</p>
            <p className="mt-2 text-4xl font-black text-brand-900">{formatMoneyAmount(plan.price.amount, plan.price.currency)}</p>
            <p className="mt-3 text-sm leading-6 text-brand-600">One-time package price for the selected eSIM. Payment currency: {plan.price.currency}.</p>
            <div className="mt-5 border-t border-brand-100 pt-5">
              <h2 className="text-xs font-black uppercase tracking-wide text-brand-500">Where you can use it</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-brand-900">
                {plan.coverageVerified
                  ? `${coverageNames.slice(0, 6).join(", ")}${coverageNames.length > 6 ? ` and ${coverageNames.length - 6} more countries` : ""}`
                  : "Contact support to confirm the covered countries before buying."}
              </p>
              {plan.isRegional ? <p className="mt-2 text-xs leading-5 text-brand-600">Country inclusion does not guarantee signal throughout a national park, lodge, or remote area.</p> : null}
              <a href="#coverage" className="mt-2 inline-block text-xs font-bold text-brand-700 underline underline-offset-4">View coverage details</a>
            </div>
            <AddToCartButton item={cartItem} label="Add to cart" className="mt-6" />
            <p className="mt-3 text-xs leading-5 text-brand-600">Delivery starts after payment confirmation. <Link href="/help#delivery" className="font-bold text-brand-700 underline underline-offset-4">Delivery and delay guidance</Link></p>
            <div className="mt-5 flex items-start gap-2 border-t border-brand-100 pt-5 text-xs leading-5 text-brand-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Availability and price are revalidated by checkout before payment.</div>
          </aside>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="space-y-8">
            <DetailSection title="Plan details">
              <dl className="grid gap-px overflow-hidden rounded-2xl border border-brand-100 bg-brand-100 sm:grid-cols-2">
                <DetailFact icon={Radio} label="Supported carrier(s)" value={carrierLabel} />
                <DetailFact icon={Phone} label="Calls & SMS" value={callsAndTexts} />
                <DetailFact icon={Smartphone} label="Phone number" value={formatKnownBoolean(plan.includesPhoneNumber, { yes: "Included", no: "Not included" })} />
                <DetailFact icon={RefreshCw} label="Top-up" value={formatKnownBoolean(plan.topUpAvailable, { yes: "Available", no: "Not available" })} />
                <DetailFact icon={Settings2} label="Connection settings (APN)" value="Follow the setup guide in your order" />
              </dl>
            </DetailSection>

            <DetailSection title="Purchase, installation, and activation">
              <ol className="grid gap-4 sm:grid-cols-3">
                <TimelineStep number="1" title="Get your eSIM" body="After payment is confirmed, we request your eSIM. Your QR code and setup guide appear on your secure order page when ready. If you are still waiting after 10 minutes, contact support with your order reference; do not pay again." />
                <TimelineStep number="2" title="Install on Wi-Fi" body={plan.installWindowDays ? `Install within ${plan.installWindowDays} days of purchase using your order's setup guide. Check when validity starts before installing.` : "Use a reliable Wi-Fi connection and your order's setup guide. Contact support to confirm the installation deadline before buying."} />
                <TimelineStep number="3" title="When your days start" body={activationGuidance} />
              </ol>
              <p className="mt-4 text-sm leading-6 text-brand-600">On arrival, select this eSIM for mobile data, follow your order&apos;s data-roaming and connection settings, and connect to a supported network. <Link href="/help/installation" className="font-bold text-brand-700 underline underline-offset-4">Read the setup guide</Link></p>
            </DetailSection>

            {plan.fairUsagePolicy ? <DetailSection title="Fair-use policy"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">{plan.fairUsagePolicy}</div></DetailSection> : null}

            <DetailSection id="coverage" title={plan.isRegional ? "Supported destinations" : "Coverage"}>
              {plan.isRegional && !plan.coverageVerified ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">We could not confirm the countries included in this plan. Contact support before buying.</div>
              ) : (
                <div className="flex flex-wrap gap-2">{plan.coverage.map((destination) => <span key={`${destination.code}-${destination.slug}`} className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">{destination.name}</span>)}</div>
              )}
              <p className="mt-4 text-sm leading-6 text-brand-600">Coverage depends on the local mobile network. A country appearing here does not mean there is reception in every park, lodge, building, or remote area. Download maps and essential travel information before heading away from a reliable connection.</p>
            </DetailSection>
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-brand-100 bg-brand-50 p-6"><Info className="h-6 w-6 text-brand-600" aria-hidden /><h2 className="mt-4 font-black text-brand-900">Before you buy</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-brand-600"><li>Confirm your phone supports eSIM.</li><li>Check that it is carrier unlocked.</li><li>Read the activation rule above.</li><li>Do not delete an installed eSIM prematurely.</li></ul><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2"><Link href="/compatibility" className="font-bold text-brand-700 underline underline-offset-4">Check compatibility</Link><Link href="/refunds" className="font-bold text-brand-700 underline underline-offset-4">Read refund information</Link><WhatsAppSupportLink location="plan" className="font-bold text-brand-700 underline underline-offset-4" /></div></div>
            <div className="rounded-3xl border border-brand-100 bg-white p-6 text-sm leading-6 text-brand-600"><h2 className="font-black text-brand-900">If your eSIM is delayed</h2><p className="mt-2">Check your secure order page first. If payment is confirmed and no setup details appear after 10 minutes, contact <a href="mailto:support@sim.africa" className="font-bold text-brand-700 underline underline-offset-4">support@sim.africa</a> with your order reference.</p><p className="mt-3">We check the existing order with the supplier. If delivery cannot be completed, support will explain the next steps and review the available remedy under our refund policy.</p><Link href="/help#delivery" className="mt-4 inline-block font-bold text-brand-700 underline underline-offset-4">Delivery and delay guidance</Link></div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-white/95 p-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-brand-600">{plan.dataLabel} · {plan.validityDays ? `${plan.validityDays} days` : "Validity unknown"}</p><p className="text-[10px] leading-4 text-brand-600">{plan.coverageVerified ? (coverageNames.length <= 3 ? coverageNames.join(", ") : `${coverageNames.length} covered countries`) : "Confirm coverage before buying"}</p><p className="font-black text-brand-900">{formatMoneyAmount(plan.price.amount, plan.price.currency)}</p></div><AddToCartButton item={cartItem} label="Add to cart" className="w-auto min-w-36" /></div></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c") }} />
    </div>
  );
}

function HeroFact({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><Icon className="h-5 w-5 text-brand-600" aria-hidden /><dt className="mt-4 text-[0.65rem] font-black uppercase tracking-wide text-brand-500">{label}</dt><dd className="mt-1 font-black text-brand-900">{value}</dd></div>;
}

function DetailSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className={id ? "scroll-mt-28" : undefined}><h2 className="text-2xl font-black text-brand-900">{title}</h2><div className="mt-5">{children}</div></section>;
}

function DetailFact({ icon: Icon, label, value }: { icon: typeof Radio; label: string; value: string }) {
  return <div className="bg-white p-5"><Icon className="h-5 w-5 text-brand-500" aria-hidden /><dt className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-500">{label}</dt><dd className="mt-1 font-semibold text-brand-900">{value}</dd></div>;
}

function TimelineStep({ number, title, body }: { number: string; title: string; body: string }) {
  return <li className="rounded-2xl border border-brand-100 bg-white p-5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-black text-white">{number}</span><h3 className="mt-4 font-black text-brand-900">{title}</h3><p className="mt-2 text-sm leading-6 text-brand-600">{body}</p></li>;
}
