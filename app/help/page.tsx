import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, HelpCircle, Mail, Settings2, Smartphone } from "lucide-react";

import { purchaseFaqs } from "@/lib/content/faqs";
import { DeliveryHelp } from "@/components/site/DeliveryHelp";
import { WhatsAppSupportLink } from "@/components/site/WhatsAppSupportLink";

export const metadata: Metadata = {
  title: "SIM.Africa help centre",
  description: "Get help with eSIM installation, activation, data roaming, APN settings, top-ups, refunds, and device compatibility.",
  alternates: { canonical: "/help" },
};

const categories: Array<{ title: string; body: string; href: Route; icon: typeof BookOpen }> = [
  { title: "Delivery & delays", body: "Where to find your eSIM and what to do if it has not arrived.", href: "#delivery", icon: Mail },
  { title: "Getting started", body: "What an eSIM is and what to check before buying.", href: "#faq", icon: BookOpen },
  { title: "Installation", body: "iPhone, Samsung, Google Pixel, QR, and manual setup.", href: "/help/installation", icon: Smartphone },
  { title: "Activation & roaming", body: "Understand package-specific activation rules and data roaming.", href: "/help/installation#activation", icon: Settings2 },
  { title: "Troubleshooting", body: "What to check when the eSIM will not install or connect.", href: "/help/installation#troubleshooting", icon: HelpCircle },
  { title: "APN settings", body: "Where to find and apply package-specific APN values.", href: "/help/installation#apn", icon: Settings2 },
  { title: "Top-ups", body: "How eligible top-up packages appear on your secure order page.", href: "#top-ups", icon: BookOpen },
  { title: "Device compatibility", body: "Search the curated checker and verify on your device.", href: "/compatibility", icon: Smartphone },
  { title: "Refund information", body: "Understand how fulfilment and activation affect a request.", href: "/refunds", icon: BookOpen },
  { title: "Contact support", body: "Send the details our team needs to investigate quickly.", href: "#contact", icon: Mail },
];

export default function HelpPage() {
  return <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">Help centre</p><h1 className="mt-3 text-4xl font-black tracking-tight text-brand-900 sm:text-6xl">Help before, during, and after your trip</h1><p className="mt-5 text-lg leading-8 text-brand-600">Find installation and troubleshooting guidance without leaving SIM.Africa. Package-specific order instructions take precedence over generic advice.</p></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map(({ title, body, href, icon: Icon }) => <Link key={title} href={href} className="group rounded-3xl border border-brand-100 bg-white p-6 shadow-subtle hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"><Icon className="h-6 w-6 text-brand-600" aria-hidden /><h2 className="mt-5 text-xl font-black text-brand-900">{title}</h2><p className="mt-2 text-sm leading-6 text-brand-600">{body}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand-700">Open guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden /></span></Link>)}</div><section id="faq" className="mt-20 scroll-mt-28"><h2 className="text-3xl font-black text-brand-900">Frequently asked questions</h2><div className="mt-7 divide-y divide-brand-100 overflow-hidden rounded-3xl border border-brand-100 bg-white">{purchaseFaqs.map((faq) => <details key={faq.question} className="p-5 sm:p-6"><summary className="cursor-pointer font-black text-brand-900">{faq.question}</summary><p className="mt-3 text-sm leading-6 text-brand-600">{faq.answer}</p></details>)}</div></section><DeliveryHelp /><section id="top-ups" className="mt-16 scroll-mt-28 rounded-3xl border border-brand-100 bg-brand-50 p-6"><h2 className="text-2xl font-black text-brand-900">Top-ups</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-brand-600">If the supplier marks your fulfilled eSIM as rechargeable, currently available top-up packages appear on its secure order page. If none are listed, do not assume the eSIM can be topped up; choose another current plan or contact support.</p></section><section id="contact" className="mt-16 scroll-mt-28 rounded-[2rem] bg-brand-900 p-7 text-white sm:p-10"><Mail className="h-7 w-7 text-brand-300" aria-hidden /><h2 className="mt-5 text-2xl font-black">Still need help?</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-brand-100">Email the order reference, destination, phone model, and a screenshot of the issue. Never send passwords or payment-card details.</p><div className="mt-6 flex flex-wrap gap-3"><a href="mailto:support@sim.africa" className="inline-flex min-h-12 items-center rounded-full bg-white px-6 font-black text-brand-900">Email support@sim.africa</a><WhatsAppSupportLink location="help" showIcon className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 px-6 font-black text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" /></div></section></div>;
}
