import Link from "next/link";
import { ShieldCheck, Sparkles, SmartphoneNfc, Wifi } from "lucide-react";

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
          <div className="flex items-center gap-2 text-sm text-brand-800">
            <Wifi className="h-5 w-5 text-brand-600" />
            <Link href="/" className="font-semibold hover:text-brand-900">
              Simplify home
            </Link>
          </div>
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

        <div className="w-full max-w-xl rounded-3xl border border-brand-100 bg-white/90 p-8 shadow-card backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
                {isSignup ? "Create account" : "Log in"}
              </p>
              <p className="text-sm text-brand-700">
                {isSignup ? "Pick the method you prefer to get started." : "Choose an option to get back to your trips."}
              </p>
            </div>
            <Link href={isSignup ? "/auth/signin" : "/auth/signup"} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
              {isSignup ? "Have an account? Log in" : "New here? Create account"}
            </Link>
          </div>
          <div className="mt-6">
            <AuthForm providers={providers} mode={mode} />
          </div>
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-brand-50/80 px-4 py-3 text-xs text-brand-800">
            <div>
              <p className="font-semibold text-brand-900">Need help?</p>
              <p>Contact support and we will get you signed in quickly.</p>
            </div>
            <Button asChild size="sm" variant="secondary" className="text-xs">
              <Link href="/resources">Visit support</Link>
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
