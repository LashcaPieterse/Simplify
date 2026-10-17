import type { Metadata } from "next";
import { Smartphone } from "lucide-react";

import { CompatibilityChecker } from "@/components/devices/CompatibilityChecker";

export const metadata: Metadata = {
  title: "eSIM compatible phones",
  description: "Check manufacturer-documented eSIM support for selected Apple, Samsung, Google, Motorola, Huawei, and Xiaomi phones, and verify it on your device.",
  alternates: { canonical: "/compatibility" },
};

export default function CompatibilityPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-3xl text-center"><Smartphone className="mx-auto h-9 w-9 text-brand-600" aria-hidden /><p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-brand-600">Device compatibility</p><h1 className="mt-3 text-4xl font-black tracking-tight text-brand-900 sm:text-6xl">Will an eSIM work on my phone?</h1><p className="mt-5 text-lg leading-8 text-brand-600">Search the curated checker. It returns “unable to verify” whenever exact support is uncertain instead of guessing.</p></div>
      <div className="mx-auto mt-10 max-w-3xl"><CompatibilityChecker /></div>
      <section className="mx-auto mt-16 max-w-3xl"><h2 className="text-2xl font-black text-brand-900">Before buying</h2><ol className="mt-6 grid gap-4 sm:grid-cols-3"><Step number="1" text="Find the exact model name or number in About phone." /><Step number="2" text="Look for Add eSIM in the SIM or mobile-network settings." /><Step number="3" text="Confirm with your carrier that the device is unlocked." /></ol></section>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return <li className="rounded-2xl border border-brand-100 bg-brand-50 p-5"><span className="font-black text-brand-600">{number}</span><p className="mt-3 text-sm leading-6 text-brand-700">{text}</p></li>;
}
