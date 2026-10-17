import type { Metadata } from "next";
import { Briefcase, CheckCircle2, Globe2, ReceiptText, Route, Users } from "lucide-react";

import { BusinessLeadForm } from "@/components/business/BusinessLeadForm";

export const metadata: Metadata = {
  title: "Business eSIM connectivity across Africa",
  description: "Talk to SIM.Africa about current travel eSIM options for teams visiting African countries.",
  alternates: { canonical: "/business" },
};

export default function BusinessPage() {
  return (
    <div>
      <section className="bg-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
          <Briefcase className="h-10 w-10 text-brand-300" aria-hidden />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-brand-300">SIM.Africa Business</p>
          <h1 className="mt-3 max-w-5xl text-4xl font-black tracking-tight sm:text-6xl">Business connectivity across Africa, without the roaming bill.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-brand-100">Get help selecting currently available data plans for recurring work trips, teams, and multi-country itineraries. We confirm requirements before promising any corporate feature.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-black text-brand-900">Plan travel data with a human</h2>
            <p className="mt-4 leading-7 text-brand-600">Tell us where your team travels and how they use data. SIM.Africa can assess the current catalogue and explain what is available now.</p>
            <div className="mt-8 grid gap-3">
              <Benefit icon={Globe2} text="Africa-focused country and regional plan discovery" />
              <Benefit icon={Route} text="Exact multi-country coverage validation" />
              <Benefit icon={Users} text="Requirements gathering for multiple travellers" />
              <Benefit icon={ReceiptText} text="Order and payment receipt records" />
            </div>
            <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm leading-6 text-brand-700"><strong>Future-ready architecture:</strong> catalogue, checkout, orders, and users are separate domains so corporate accounts and bulk provisioning can be added without replacing the storefront.</div>
          </div>
          <BusinessLeadForm />
        </div>
      </section>
    </div>
  );
}

function Benefit({ icon: Icon, text }: { icon: typeof Globe2; text: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-white p-4"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden /><span className="text-sm font-semibold leading-6 text-brand-800">{text}</span><CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-brand-400" aria-hidden /></div>;
}
