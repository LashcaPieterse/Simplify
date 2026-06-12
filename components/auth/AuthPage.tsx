import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Sparkles, SmartphoneNfc } from "lucide-react";

import { AuthForm, type ProviderInfo } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";

export function AuthPage({ providers, mode }: { providers: ProviderInfo[]; mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  const title = isSignup ? "Create your Simplify account" : "Welcome back";
  const copy = isSignup
    ? "Save your travelers, keep receipts together, and activate eSIMs in seconds."
    : "Access your saved eSIMs, manage orders, and stay connected across every trip.";

  return (
    <div className="relative min-h-screen overflow-hidden bg-sand-50">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-radial-fade opacity-75" aria-hidden />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-8 lg:max-w-xl">
          <Link
            href="/"
            aria-label="Go to Simplify home page"
            title="Go to home page"
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl transition hover:bg-white/70 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <Image src="/favicon.png" alt="" width={48} height={48} className="h-12 w-12" priority />
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-700 shadow-subtle">
            <ShieldCheck className="h-4 w-4" />
            {isSignup ? "Set up your login" : "Secure customer access"}
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-brand-900 sm:text-5xl">{title}</h1>
            <p className="text-lg text-brand-700 sm:text-xl">{copy}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Highlight title="Keep orders together" description="View every eSIM, receipt, and activation in a single profile." />
            <Highlight title="Fast activation" description="Sign in once and breeze through checkout on your next trip." />
            <Highlight title="Travel-ready" description="Access on any device and stay signed in while you roam." icon="device" />
            <Highlight title="Privacy-first" description="We only use your details to deliver and secure your eSIMs." icon="shield" />
          </div>
        </div>

        <div className="w-full max-w-xl rounded-[28px] border border-brand-100 bg-white p-6 shadow-[0_30px_80px_-45px_rgba(21,63,65,0.55)] sm:p-8 lg:p-9">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold leading-tight text-brand-900">
                {isSignup ? "Create account" : "Log in"}
              </h2>
              <p className="text-sm text-brand-700 sm:text-base">
                {isSignup ? "Pick the method you prefer to get started." : "Access your eSIMs, orders, and saved trips."}
              </p>
            </div>
            <Link
              href={isSignup ? "/auth/signin" : "/auth/signup"}
              className="shrink-0 text-sm font-semibold text-brand-700 transition hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              {isSignup ? "Have an account? Log in" : "New here? Create account"}
            </Link>
          </div>
          <div className="mt-7">
            <AuthForm providers={providers} mode={mode} />
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-brand-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-brand-900">Need help?</p>
              <p>Contact support and we will get you signed in quickly.</p>
            </div>
            <Button asChild size="sm" variant="secondary" className="w-full bg-white text-xs sm:w-auto">
              <a href="mailto:support@simplify.africa">Contact support</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Highlight({
  title,
  description,
  icon = "sparkles",
}: {
  title: string;
  description: string;
  icon?: "sparkles" | "shield" | "device";
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-brand-600">
        {icon === "shield" ? (
          <ShieldCheck className="h-4 w-4" />
        ) : icon === "device" ? (
          <SmartphoneNfc className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <p className="text-sm font-semibold text-brand-900">{title}</p>
      </div>
      <p className="mt-2 text-sm text-brand-700">{description}</p>
    </div>
  );
}
