import Link from "next/link";
import type { Metadata } from "next";
import { findPublicGuide } from "@/lib/affiliates/program";
import { safeReferralDestination } from "@/lib/affiliates/rules";
import { panelClass } from "@/components/affiliates/Fields";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your guide’s eSIM recommendation", robots: { index: false, follow: false } };
export default async function ReferralPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ to?: string }> }) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const guide = await findPublicGuide(code);
  const destination = safeReferralDestination(typeof query.to === "string" ? query.to : null);
  return <div className="mx-auto max-w-xl px-5 py-20"><section className={panelClass}>
    {guide ? <><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Recommended by your guide</p><h1 className="mt-3 text-3xl font-black text-brand-900">{guide.publicName} invited you to SIM.Africa</h1><p className="mt-5 leading-7 text-brand-700">Find a travel eSIM for your trip. Your guide may earn commission on eligible purchases, at no extra cost to you.</p><p className="mt-4 text-sm leading-6 text-brand-600">With your permission, we will remember this guide in this browser for 30 days using a referral cookie. A later guide referral can replace it. You can also enter code <strong>{guide.code}</strong> at checkout.</p><form action="/api/affiliates/referral" method="post" className="mt-6 space-y-3"><input type="hidden" name="code" value={guide.code} /><input type="hidden" name="to" value={destination} /><button name="remember" value="yes" className="w-full rounded-xl bg-brand-900 px-4 py-3 font-bold text-white">Remember my guide and browse eSIMs</button><button name="remember" value="no" className="w-full rounded-xl border border-brand-200 px-4 py-3 font-semibold text-brand-700">Continue without remembering</button></form><p className="mt-4 text-xs text-brand-500"><Link href="/privacy" className="underline">How we handle referral information</Link></p></> : <><h1 className="text-3xl font-black text-brand-900">This guide link is unavailable</h1><p className="mt-4 leading-7 text-brand-600">You can still browse and purchase travel eSIMs from SIM.Africa.</p><Link href="/destinations" className="mt-6 inline-block font-bold text-brand-700 underline">Browse destinations</Link></>}
  </section></div>;
}
