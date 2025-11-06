import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PortableTextRenderer } from "@/components/rich/PortableText";
import { getPlanBySlug, getPosts } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";

export const revalidate = 60;

type PlanPageProps = {
  params: { slug: string };
};

export default async function PlanPage({ params }: PlanPageProps) {
  const plan = await getPlanBySlug(params.slug);

  if (!plan) {
    notFound();
  }

  const relatedPosts = (await getPosts()).slice(0, 3);
  const providerLogo = plan.provider?.logo ? urlForImage(plan.provider.logo)?.width(160).height(160).url() : null;
  const providerHandle = plan.provider?.title
    ? plan.provider.title.toLowerCase().replace(/\s+/g, "")
    : "simplify";

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16 lg:px-10">
      <div className="rounded-[2rem] border border-brand-100/80 bg-white p-10 shadow-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">{plan.provider?.title}</p>
            <h1 className="font-display text-4xl text-brand-900 sm:text-5xl">{plan.title}</h1>
            <p className="text-base text-brand-600">{plan.shortBlurb}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-brand-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-600">
                <span className="material-symbols-rounded text-brand-400">public</span>
                {plan.country?.title}
              </span>
              {plan.fiveG ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-600">
                  <span className="material-symbols-rounded text-brand-400">network_wifi_3_bar</span>
                  5G access
                </span>
              ) : null}
              {plan.hotspot ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand-600">
                  <span className="material-symbols-rounded text-brand-400">wifi_tethering</span>
                  Hotspot enabled
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-4 text-right">
            {providerLogo ? (
              <Image src={providerLogo} alt={plan.provider?.title ?? "Carrier"} width={64} height={64} className="rounded-full" />
            ) : null}
            <p className="text-3xl font-semibold text-brand-900">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                plan.priceUSD
              )}
            </p>
            <Button size="lg" className="shadow-subtle">
              Get this plan
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr,0.7fr]">
          <div>
            <h2 className="text-xl font-semibold text-brand-900">What&apos;s included</h2>
            <ul className="mt-4 space-y-3 text-sm text-brand-600">
              {plan.whatsIncluded.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-brand-400">check_circle</span>
                  {item}
                </li>
              ))}
            </ul>

            {plan.features?.length ? (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-brand-900">Perks</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-600">
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-10 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-brand-900">Installation steps</h3>
                <div className="prose prose-brand max-w-none">
                  <PortableTextRenderer value={plan.installSteps} />
                </div>
              </div>
              {plan.terms?.length ? (
                <div>
                  <h3 className="text-lg font-semibold text-brand-900">Terms</h3>
                  <div className="prose prose-brand max-w-none">
                    <PortableTextRenderer value={plan.terms} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-6 rounded-2xl border border-brand-100 bg-brand-50/70 p-6">
            <h3 className="text-lg font-semibold text-brand-900">Travel tips</h3>
            <p className="text-sm text-brand-600">
              Activate your eSIM within 30 days of purchase. Need help? Email support@{providerHandle}.travel or chat in the app.
            </p>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Latest resources</h4>
              <ul className="space-y-3 text-sm text-brand-600">
                {relatedPosts.map((post) => (
                  <li key={post._id} className="flex items-center justify-between">
                    <Link href={`/resources/${post.slug}`} className="hover:text-brand-900">
                      {post.title}
                    </Link>
                    <span className="text-xs text-brand-400">{post.readingMinutes} min read</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
