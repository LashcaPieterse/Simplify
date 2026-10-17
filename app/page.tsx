import Link from "next/link";
import type { Route as NextRoute } from "next";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Globe2,
  Headphones,
  Luggage,
  MapPinned,
  Plane,
  Route,
  ShieldCheck,
  Smartphone,
  Wifi,
} from "lucide-react";

import { DestinationSearch, type DestinationSearchOption } from "@/components/search/DestinationSearch";
import { StorefrontPlanCard } from "@/components/plans/StorefrontPlanCard";
import { formatMoneyAmount } from "@/lib/format";
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

function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code.toUpperCase())) return "🌍";
  return String.fromCodePoint(...Array.from(code.toUpperCase()).map((letter) => 127397 + letter.charCodeAt(0)));
}

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
    <div className="overflow-hidden">
      <section className="relative isolate border-b border-brand-100">
        <div className="absolute inset-0 -z-10 bg-radial-fade" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.7fr)] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-subtle">
              <Plane className="h-4 w-4 text-sand-500" aria-hidden />
              The eSIM specialist for Africa
            </div>
            <h1 className="mt-7 max-w-4xl font-display text-5xl font-black tracking-[-0.045em] text-brand-900 sm:text-6xl lg:text-7xl">
              Stay connected across Africa. <span className="text-brand-600">Before you land.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-brand-700 sm:text-xl">
              Affordable eSIM data for holidays, safaris, and business trips across Africa. Choose your destination, install before departure, and connect according to your plan&apos;s activation instructions.
            </p>
            <div className="mt-9 max-w-3xl">
              <p className="mb-3 text-sm font-black text-brand-900">Where are you travelling?</p>
              <DestinationSearch options={[...countryOptions, ...regionalOptions]} popular={["South Africa", "Kenya", "Namibia", "Tanzania"]} />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-[2rem] border border-brand-200 bg-brand-900 p-7 text-white shadow-card sm:p-9">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><MapPinned className="h-7 w-7 text-brand-200" aria-hidden /></div>
              <h2 className="mt-8 text-2xl font-black">Built for African journeys</h2>
              <p className="mt-3 text-sm leading-6 text-brand-100">Country and regional plans are shown only when they are active, priced, and available in the current supplier catalogue.</p>
              <div className="mt-8 grid gap-3 text-sm">
                {["Country-specific plan discovery", "Exact regional coverage checks", "Package-specific activation guidance"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-sand-300" aria-hidden />{item}</div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Purchase benefits" className="border-b border-brand-100 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-brand-100 px-5 sm:px-6 lg:grid-cols-4 lg:px-8">
          <TrustItem icon={Wifi} text="Digital eSIM delivery" />
          <TrustItem icon={ShieldCheck} text="Secure online payment" />
          <TrustItem icon={Smartphone} text="Keep your existing SIM" />
          <TrustItem icon={Headphones} text="Human email support" />
        </div>
      </section>

      <section id="destinations" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Popular destinations" title="Start with where you’re going" body="Starting prices come from currently sellable catalogue packages, never from promotional placeholder data." />
          {popularCountries.length ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {popularCountries.map((country) => (
                <Link key={country.id} href={`/country/${country.slug}`} className="group rounded-3xl border border-brand-100 bg-white p-5 shadow-subtle transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 motion-reduce:transform-none">
                  <span className="text-3xl" aria-hidden>{countryFlag(country.countryCode)}</span>
                  <h3 className="mt-8 text-xl font-black text-brand-900">{country.title}</h3>
                  <p className="mt-1 text-sm text-brand-500">{country.planCount} plan{country.planCount === 1 ? "" : "s"} available</p>
                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-brand-100 pt-4">
                    <div><span className="block text-[0.65rem] font-bold uppercase tracking-wide text-brand-500">From</span><span className="text-lg font-black text-brand-900">{formatMoneyAmount(country.minimumPrice.amount, country.minimumPrice.currency)}</span></div>
                    <ArrowRight className="h-5 w-5 text-brand-500 transition group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          ) : <CatalogUnavailable />}
          <div className="mt-8 text-center"><Link href="/destinations" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 bg-white px-6 text-sm font-bold text-brand-800 hover:border-brand-300">View all destinations <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
        </div>
      </section>

      <section className="bg-brand-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Choose by travel style" title="Data that fits the way you travel" />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <TravelCard icon={Luggage} title="Holiday & Safari" body="Maps, WhatsApp, social media, and bookings while you explore." href="/#destinations" cta="Find a travel plan" />
            <TravelCard icon={Briefcase} title="Business Travel" body="Compare higher-data and hotspot information for work trips." href="/business" cta="Find a business plan" />
            <TravelCard icon={Route} title="Multi-country Africa" body="Select every country on your itinerary and validate exact coverage." href="/route-builder" cta="Build my route" />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="How it works" title="Three steps to travel data" body="Activation behaviour can vary, so your package page and order instructions remain the authority." />
          <ol className="mt-12 grid gap-6 lg:grid-cols-3">
            <Step number="1" icon={MapPinned} title="Choose your destination" body="Compare only active plans that cover the country or route you selected." />
            <Step number="2" icon={Smartphone} title="Install your eSIM" body="Use the QR or manual instructions supplied with your fulfilled order." />
            <Step number="3" icon={Wifi} title="Connect when you arrive" body="Follow the package-specific activation and roaming instructions." />
          </ol>
          <p className="mt-8 text-center"><Link href="/help/installation" className="font-bold text-brand-700 underline underline-offset-4 hover:text-brand-900">Read the detailed installation guide</Link></p>
        </div>
      </section>

      <section className="bg-brand-900 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-300">Regional eSIMs</p><h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">One plan for more of your trip—when the coverage actually fits.</h2><p className="mt-4 max-w-2xl leading-7 text-brand-100">Every plan below maps to a currently purchasable regional supplier package. Check its named destinations before buying.</p></div>
            <Link href="/regional-esims" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 font-bold text-brand-900">Compare regional plans <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          {regionalPlans.length ? <div className="mt-12 grid gap-6 lg:grid-cols-3 text-brand-900">{regionalPlans.slice(0, 3).map((plan) => <StorefrontPlanCard key={plan.id} plan={plan} compact />)}</div> : <div className="mt-10 rounded-3xl border border-white/20 bg-white/10 p-6 text-sm text-brand-100">No regional package can be displayed from the current catalogue. Country plans remain available above.</div>}
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-[2rem] border border-brand-100 bg-brand-50 p-7 sm:p-10">
            <Smartphone className="h-9 w-9 text-brand-600" aria-hidden />
            <h2 className="mt-6 text-3xl font-black text-brand-900">Will an eSIM work on my phone?</h2>
            <p className="mt-3 leading-7 text-brand-600">Search a curated compatibility list, then confirm the eSIM option in your device settings. Your phone generally also needs to be carrier unlocked.</p>
            <Link href="/compatibility" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-700 px-6 font-bold text-white">Check my phone <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div className="rounded-[2rem] border border-brand-100 bg-white p-7 shadow-subtle sm:p-10">
            <ShieldCheck className="h-9 w-9 text-brand-600" aria-hidden />
            <h2 className="mt-6 text-3xl font-black text-brand-900">Why SIM.Africa?</h2>
            <ul className="mt-6 grid gap-4 text-sm text-brand-700">
              {["Africa-focused destination discovery", "Prices and availability from the current catalogue", "Country and regional coverage kept distinct", "Secure guest checkout and order access"].map((item) => <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden />{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-brand-50 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Questions before you buy" title="Travel eSIM FAQ" />
          <div className="mt-10 divide-y divide-brand-100 overflow-hidden rounded-3xl border border-brand-100 bg-white">
            {purchaseFaqs.map((faq) => <details key={faq.question} className="group p-5 sm:p-6"><summary className="cursor-pointer list-none pr-8 font-bold text-brand-900 marker:hidden">{faq.question}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-brand-600">{faq.answer}</p></details>)}
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight text-brand-900 sm:text-5xl">{title}</h2>{body ? <p className="mt-4 text-base leading-7 text-brand-600">{body}</p> : null}</div>;
}

function TrustItem({ icon: Icon, text }: { icon: typeof Wifi; text: string }) {
  return <div className="flex min-h-24 items-center gap-3 bg-white px-3 py-5 sm:px-5"><Icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden /><span className="text-sm font-bold text-brand-800">{text}</span></div>;
}

function TravelCard({ icon: Icon, title, body, href, cta }: { icon: typeof Luggage; title: string; body: string; href: NextRoute; cta: string }) {
  return <article className="rounded-3xl border border-brand-100 bg-white p-7 shadow-subtle"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100"><Icon className="h-6 w-6 text-brand-700" aria-hidden /></div><h3 className="mt-6 text-2xl font-black text-brand-900">{title}</h3><p className="mt-3 min-h-12 text-sm leading-6 text-brand-600">{body}</p><Link href={href} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-brand-700">{cta} <ArrowRight className="h-4 w-4" aria-hidden /></Link></article>;
}

function Step({ number, icon: Icon, title, body }: { number: string; icon: typeof MapPinned; title: string; body: string }) {
  return <li className="relative rounded-3xl border border-brand-100 bg-white p-7 shadow-subtle"><span className="absolute right-6 top-5 text-5xl font-black text-brand-100" aria-hidden>{number}</span><Icon className="h-8 w-8 text-brand-600" aria-hidden /><h3 className="mt-7 text-xl font-black text-brand-900">{title}</h3><p className="mt-3 text-sm leading-6 text-brand-600">{body}</p></li>;
}

function CatalogUnavailable() {
  return <div className="mt-10 rounded-3xl border border-dashed border-brand-200 bg-brand-50 p-8 text-center"><Globe2 className="mx-auto h-8 w-8 text-brand-500" aria-hidden /><h3 className="mt-4 font-black text-brand-900">Destinations are temporarily unavailable</h3><p className="mt-2 text-sm text-brand-600">The catalogue could not be loaded safely. Please try again shortly or contact support.</p></div>;
}
