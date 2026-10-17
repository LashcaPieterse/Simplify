import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { AuthForm, type ProviderInfo } from "@/components/auth/AuthForm";

export function AuthPage({ providers, mode }: { providers: ProviderInfo[]; mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  return (
    <div className="page-container grid gap-10 py-10 sm:py-16 lg:grid-cols-2 lg:items-start lg:gap-20">
      <div className="lg:py-4">
        <p className="eyebrow">Your travel companion</p>
        <h1 className="mt-5 max-w-lg text-4xl font-medium leading-[1.1] tracking-[-0.05em] sm:text-5xl">Your journeys.<br /><span className="editorial">All in one place.</span></h1>
        <p className="mt-6 max-w-md text-sm leading-7 text-brand-600">Keep your eSIMs, orders, and receipts together. A little less to think about on your next adventure.</p>
        <div className="relative mt-8 hidden aspect-[1.8] overflow-hidden rounded-2xl bg-sand-200 sm:block"><Image src="/images/namibia-dunes.jpg" alt="Travellers walking along a sunlit sand dune in Namibia" fill sizes="(max-width: 1023px) 90vw, 45vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 to-transparent" aria-hidden /><p className="absolute bottom-6 left-6 font-editorial text-3xl italic text-white">More moments like this.</p></div>
        <ul className="mt-7 grid gap-3 text-xs text-brand-600">{["Your orders and installation details, together", "Quicker checkout on your next trip", "Your travel history, wherever you are"].map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />{item}</li>)}</ul>
      </div>
      <div className="rounded-2xl border border-brand-100 bg-white p-6 sm:p-9">
        <div className="mb-7"><span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-brand-600"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />Secure account access</span><h2 className="mt-4 text-3xl font-medium tracking-tight text-brand-900">{isSignup ? "Let’s get you started." : "Welcome back."}</h2><p className="mt-3 text-sm leading-6 text-brand-600">{isSignup ? "Create your account for the journey ahead." : "Log in to your SIM.Africa account."}</p></div>
        <AuthForm providers={providers} mode={mode} />
        <p className="mt-7 border-t border-brand-100 pt-6 text-center text-xs text-brand-600">{isSignup ? "Already part of the adventure?" : "New around here?"} <Link href={isSignup ? "/auth/signin" : "/auth/signup"} className="font-semibold text-brand-900 underline underline-offset-4">{isSignup ? "Log in" : "Create an account"}</Link></p>
        <a href="mailto:support@sim.africa" className="mt-5 flex min-h-11 items-center justify-center gap-1.5 rounded-md text-xs text-brand-500 hover:text-brand-900">A little help getting in? Contact us <ArrowUpRight className="h-3 w-3" aria-hidden /></a>
      </div>
    </div>
  );
}
