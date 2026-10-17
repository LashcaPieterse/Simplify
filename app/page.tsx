import Link from "next/link";
import Image from "next/image";
import type { Route as NextRoute } from "next";
import {
  Briefcase,
  CheckCircle2,
  ArrowUpRight,
  Signal,
  Globe2,
  Headphones,
  Luggage,
  MapPinned,
  Route,
  ShieldCheck,
  Smartphone,
  Wifi,
} from "lucide-react";

import { DestinationSearch, type DestinationSearchOption } from "@/components/search/DestinationSearch";
import { DestinationCard } from "@/components/destinations/DestinationCard";
import { Button } from "@/components/ui/button";
import { StorefrontPlanCard } from "@/components/plans/StorefrontPlanCard";
import { citySearchTermsForCountry } from "@/lib/content/destination-search";
import { purchaseFaqs } from "@/lib/content/faqs";
import {
  getRegionalStorefrontPlans,
  getStorefrontCountries,
  type StorefrontCountry,
} from "@/lib/catalog/storefront";

export const dynamic = "force-static";
export const revalidate = 300;

const popularCountryNames = [
  "South Africa",
  "Kenya",
  "Tanzania",
  "Namibia",
  "Egypt",
  "Morocco",
  "Mauritius",
  "Uganda",
];

function orderPopularCountries(countries: StorefrontCountry[]): StorefrontCountry[] {
  const popular = popularCountryNames
    .map((name) => countries.find((country) => country.title === name))
    .filter((country): country is StorefrontCountry => Boolean(country));
  const used = new Set(popular.map((country) => country.slug));
  return [...popular, ...countries.filter((country) => !used.has(country.slug))].slice(0, 8);
}

export default async function HomePage() {
  const [countryResult, regionalResult] = await Promise.allSettled([
    getStorefrontCountries(),
    getRegionalStorefrontPlans(),
  ]);
  const countries = countryResult.status === "fulfilled" ? countryResult.value : [];
  const regionalPlans = regionalResult.status === "fulfilled" ? regionalResult.value : [];
  const popularCountries = orderPopularCountries(countries);

  const countryOptions: DestinationSearchOption[] = countries.map((country) => ({
    id: `country-${country.id}`,
    title: country.title,
    subtitle: "Country eSIM",
    href: `/country/${country.slug}` as NextRoute,
    type: "country",
    countryCode: country.countryCode,
    searchTerms: citySearchTermsForCountry(country.slug),
  }));
  const seenRegions = new Set<string>();
  const regionalOptions: DestinationSearchOption[] = regionalPlans
    .filter((plan) => {
      if (seenRegions.has(plan.destination.slug)) return false;
      seenRegions.add(plan.destination.slug);
      return true;
    })
    .map((plan) => ({
      id: `region-${plan.destination.id}`,
      title: plan.destination.title,
      subtitle: "Regional eSIM",
      href: `/regional-esims#${plan.destination.slug}` as NextRoute,
      type: "region",
      countryCode: null,
      searchTerms: plan.coverage.map((destination) => destination.name),
    }));

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: purchaseFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div>
      <section className="page-container pb-12 pt-10 sm:pb-16 sm:pt-14 lg:pb-16 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.12fr_1fr] lg:gap-16">
          <div className="relative z-10 py-3 lg:py-6">
            <p className="eyebrow flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-600" />Less roaming. More exploring.</p>
            <h1 className="mt-7 text-[3.4rem] font-semibold leading-[1.04] tracking-[-0.065em] text-brand-900 sm:text-[4.5rem] lg:text-[4.7rem] xl:text-[5rem]">Africa is calling.<br /><span className="editorial text-brand-700">Stay connected.</span></h1>
            <p className="mt-7 max-w-md text-[15px] leading-7 text-brand-600 sm:text-base">From your first safari to your next city escape. Find prepaid eSIM data for your African journey, ready to install before you fly.</p>
            <div className="mt-8 max-w-xl">
              <DestinationSearch options={[...countryOptions, ...regionalOptions]} popular={["South Africa", "Kenya", "Namibia"]} />
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-brand-600"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />No physical SIM</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />No roaming surprises</span></div>
          </div>
          <div className="relative isolate mx-auto w-full max-w-xl">
            <div className="relative aspect-[1.15] overflow-hidden rounded-2xl bg-sand-200 sm:aspect-[1.2] lg:aspect-[0.94]">
              <Image src="/images/namibia-portrait.jpg" alt="Sweeping orange sand dunes in Namibia's Namib Desert" fill preload sizes="(max-width: 1023px) 100vw, 50vw" className="object-cover object-[56%_center]" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-950/65 via-transparent to-transparent" aria-hidden />
              <div className="absolute bottom-20 left-7 right-7 text-white"><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/80">Somewhere you&apos;d rather be</p><p className="mt-2 text-[2.5rem] leading-none"><span className="editorial">Namib Desert.</span></p><p className="mt-2 flex items-center gap-1.5 text-xs"><MapPinned className="h-3.5 w-3.5" aria-hidden />Namibia, Africa</p></div>
            </div>
            <div className="absolute -right-2 top-6 flex h-[86px] w-[86px] rotate-[9deg] items-center justify-center rounded-full border-[5px] border-canvas bg-accent-200 text-center sm:-right-4 sm:top-8 sm:h-[100px] sm:w-[100px]"><div><Globe2 className="mx-auto h-6 w-6" strokeWidth={1.3} aria-hidden /><p className="mt-1.5 text-[9px] font-bold uppercase leading-3 tracking-widest">Made for<br />the journey</p></div></div>
            <div className="absolute -bottom-5 left-5 right-5 flex items-center gap-3 rounded-xl border border-brand-100 bg-white px-4 py-3.5 shadow-card sm:left-7 sm:right-auto sm:min-w-64"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50"><Signal className="h-5 w-5 text-brand-700" aria-hidden /></span><div><p className="text-xs font-semibold text-brand-900">Big adventures. Simple connections.</p><p className="mt-1 text-[11px] text-brand-500">Your travel data, sorted.</p></div><span className="ml-2 h-2 w-2 rounded-full bg-brand-500" aria-hidden /></div>
          </div>
        </div>
      </section>

      <section aria-label="Purchase benefits" className="mt-6 border-y border-brand-100">
        <div className="page-container grid grid-cols-2 gap-x-5 gap-y-6 py-7 lg:grid-cols-4">
          <TrustItem icon={Wifi} text="Digital eSIM delivery" />
          <TrustItem icon={ShieldCheck} text="Secure online payment" />
          <TrustItem icon={Smartphone} text="Keep your existing SIM" />
          <TrustItem icon={Headphones} text="Real people. Real support." />
        </div>
      </section>

      <section id="destinations" className="section-space scroll-mt-24">
        <div className="page-container">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><SectionHeading eyebrow="Find your next connection" title="Where will Africa take you?" body="A little adventure, a little discovery. A data plan for wherever you’re headed." /><Link href="/destinations" className="text-link shrink-0">All destinations <ArrowUpRight className="h-4 w-4" aria-hidden /></Link></div>
          {popularCountries.length ? <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{popularCountries.map((country, index) => <DestinationCard key={country.id} country={country} photograph={index < 4} />)}</div> : <CatalogUnavailable />}
        </div>
      </section>

      <section id="how-it-works" className="section-space scroll-mt-24 border-y border-brand-100 bg-white">
        <div className="page-container">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.4fr] lg:gap-20"><div><SectionHeading eyebrow="Less admin. More adventure." title="Get connected. Get going." body="Sort your travel data before takeoff. Spend your arrival enjoying the view." /><Link href="/help/installation" className="text-link mt-5">Your installation guide <ArrowUpRight className="h-4 w-4" aria-hidden /></Link></div><ol className="grid gap-8 sm:grid-cols-3 lg:pt-1"><Step number="01" icon={MapPinned} title="Pick your place" body="Find a country or regional plan that fits your itinerary." /><Step number="02" icon={Smartphone} title="Make it yours" body="Buy online and follow your order’s eSIM installation guide." /><Step number="03" icon={Wifi} title="You’re connected" body="Follow your plan’s activation instructions and start exploring." /></ol></div>
        </div>
      </section>

      <section className="section-space">
        <div className="page-container"><SectionHeading eyebrow="Your trip. Your way." title="For every kind of explorer." /><div className="mt-9 grid gap-4 lg:grid-cols-3"><TravelCard icon={Luggage} title="Out-of-office adventures" body="Maps, bookings, and moments worth sharing. Data for the good kind of getting lost." href="/destinations" cta="Explore travel plans" /><TravelCard icon={Briefcase} title="Business, without borders" body="Keep work moving. Compare data and hotspot options for your next business trip." href="/business" cta="Explore business travel" /><TravelCard icon={Route} title="One trip. More Africa." body="Cross a few borders. Find the right combination of plans for your whole route." href="/route-builder" cta="Build your route" /></div></div>
      </section>

      <section className="bg-brand-900 text-white">
        <div className="page-container py-16 sm:py-20"><div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><p className="eyebrow text-accent-200">Go a little further</p><h2 className="mt-4 max-w-2xl text-4xl font-medium leading-[1.12] sm:text-5xl">More countries.<br /><span className="editorial text-accent-200">One beautiful journey.</span></h2><p className="mt-5 max-w-lg text-sm leading-7 text-brand-200">Making a few stops? Explore regional eSIMs and check the named destinations to find a plan that covers your trip.</p></div><Button asChild variant="accent"><Link href="/regional-esims">Explore regional plans <ArrowUpRight className="h-4 w-4" aria-hidden /></Link></Button></div>{regionalPlans.length ? <div className="mt-10 grid gap-5 text-brand-900 lg:grid-cols-3">{regionalPlans.slice(0, 3).map((plan) => <StorefrontPlanCard key={plan.id} plan={plan} compact />)}</div> : <p className="mt-8 border-t border-white/15 pt-6 text-sm text-brand-200">Regional plans are currently unavailable. Explore individual country plans for your journey.</p>}</div>
      </section>

      <section className="section-space"><div className="page-container"><div className="grid overflow-hidden rounded-2xl border border-brand-100 bg-accent-100 md:grid-cols-[1fr_0.8fr]"><div className="p-7 sm:p-10 lg:p-12"><p className="eyebrow">A quick check before you go</p><h2 className="mt-4 max-w-lg text-3xl font-medium leading-tight sm:text-4xl">Your next adventure.<br /><span className="editorial">Your favourite phone.</span></h2><p className="mt-5 max-w-md text-sm leading-7 text-brand-700">Check that your phone supports eSIM and is carrier unlocked. A little peace of mind before the packing begins.</p><Button asChild className="mt-7"><Link href="/compatibility">Check my phone <ArrowUpRight className="h-4 w-4" aria-hidden /></Link></Button></div><div className="flex min-h-60 items-center justify-center border-t border-brand-900/10 p-8 md:border-l md:border-t-0"><div className="relative flex h-48 w-32 rotate-[8deg] items-center justify-center rounded-[1.7rem] border-[5px] border-brand-900 bg-canvas shadow-card"><span className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-brand-900" /><div className="text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-900 text-accent-200"><Globe2 className="h-8 w-8" strokeWidth={1.4} aria-hidden /></span><p className="mt-3 text-[11px] font-semibold">Hello, Africa.</p><span className="mt-1 block text-[9px] text-brand-500">Ready for the journey.</span></div><span className="absolute -right-10 bottom-7 flex h-14 w-14 items-center justify-center rounded-full border-4 border-accent-100 bg-brand-900 text-accent-200"><CheckCircle2 className="h-7 w-7" aria-hidden /></span></div></div></div></div></section>

      <section className="section-space border-t border-brand-100 bg-white"><div className="page-container grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20"><div><SectionHeading eyebrow="Good questions. Simple answers." title="A few things to know." /><p className="mt-5 text-sm leading-7 text-brand-600">A little clarity goes a long way.<br />We&apos;re here to help you get connected.</p><Link href="/help" className="text-link mt-5">Visit the help centre <ArrowUpRight className="h-4 w-4" aria-hidden /></Link></div><div className="divide-y divide-brand-100 border-y border-brand-100">{purchaseFaqs.map((faq) => <details key={faq.question} className="faq-item py-5"><summary className="list-none text-sm font-semibold leading-6 text-brand-900">{faq.question}</summary><p className="mt-3 pr-6 text-sm leading-7 text-brand-600">{faq.answer}</p></details>)}</div></div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return <div className="max-w-2xl"><p className="eyebrow">{eyebrow}</p><h2 className="mt-4 text-[2rem] font-medium leading-[1.15] tracking-[-0.045em] text-brand-900 sm:text-[2.6rem]">{title}</h2>{body ? <p className="mt-4 max-w-lg text-sm leading-7 text-brand-600">{body}</p> : null}</div>;
}
function TrustItem({ icon: Icon, text }: { icon: typeof Wifi; text: string }) {
  return <div className="flex items-center gap-2.5"><Icon className="h-[18px] w-[18px] shrink-0 text-brand-600" strokeWidth={1.5} aria-hidden /><span className="text-[11px] font-medium text-brand-700 sm:text-xs">{text}</span></div>;
}
function TravelCard({ icon: Icon, title, body, href, cta }: { icon: typeof Luggage; title: string; body: string; href: NextRoute; cta: string }) {
  return <article className="flex flex-col rounded-2xl border border-brand-100 bg-white p-7 sm:p-8"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50"><Icon className="h-5 w-5 text-brand-700" strokeWidth={1.5} aria-hidden /></span><h3 className="mt-6 text-xl font-semibold text-brand-900">{title}</h3><p className="mb-5 mt-3 text-sm leading-7 text-brand-600">{body}</p><Link href={href} className="text-link mt-auto">{cta} <ArrowUpRight className="h-4 w-4" aria-hidden /></Link></article>;
}
function Step({ number, icon: Icon, title, body }: { number: string; icon: typeof MapPinned; title: string; body: string }) {
  return <li><div className="flex items-center justify-between border-b border-brand-100 pb-5"><span className="font-editorial text-3xl italic text-brand-400">{number}</span><Icon className="h-5 w-5 text-brand-600" strokeWidth={1.5} aria-hidden /></div><h3 className="mt-6 text-base font-semibold text-brand-900">{title}</h3><p className="mt-3 text-sm leading-7 text-brand-600">{body}</p></li>;
}
function CatalogUnavailable() {
  return <div className="mt-10 rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-8 text-center"><Globe2 className="mx-auto h-8 w-8 text-brand-500" aria-hidden /><h3 className="mt-4 font-semibold text-brand-900">Destinations are temporarily unavailable</h3><p className="mt-2 text-sm text-brand-600">Please try again shortly or contact support for help finding your plan.</p></div>;
}
