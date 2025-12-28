"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";

export type ProviderInfo = {
  id: string;
  name: string;
  type: string;
};

export function AuthForm({ providers, mode }: { providers: ProviderInfo[]; mode: "signin" | "signup" }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const oauthProviders = useMemo(() => providers.filter((provider) => provider.type === "oauth"), [providers]);
  const emailProvider = useMemo(() => providers.find((provider) => provider.type === "email"), [providers]);

  const [email, setEmail] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailProvider) return;
    setPendingId(emailProvider.id);
    setMessage(null);
    setError(null);
    const result = await signIn(emailProvider.id, {
      email,
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      setError("We couldn't send the sign-in link. Try again in a moment.");
    } else {
      setMessage("Check your inbox for a secure sign-in link.");
    }
    setPendingId(null);
  }

  async function handleOAuth(providerId: string) {
    setPendingId(providerId);
    setMessage(null);
    setError(null);
    await signIn(providerId, { callbackUrl });
    setPendingId(null);
  }

  return (
    <div className="space-y-8">
      {emailProvider ? (
        <form onSubmit={handleEmail} className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Email link</p>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-semibold text-brand-900" htmlFor="auth-email">
                  Email address
                </label>
                <p className="text-sm text-brand-700">
                  {mode === "signup" ? "We'll create your account when you verify the link." : "We'll email you a secure link to log in."}
                </p>
              </div>
              <Mail className="h-5 w-5 text-brand-500" />
            </div>
          </div>
          <input
            id="auth-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-brand-100 bg-white px-3.5 py-2.5 text-sm text-brand-900 shadow-inner focus:border-brand-400 focus:outline-none"
            disabled={pendingId === emailProvider.id}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-brand-700">You'll stay signed in on this device after verification.</p>
            <Button type="submit" disabled={pendingId === emailProvider.id || !email}>
              {pendingId === emailProvider.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                <>
                  Send magic link
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          {message ? <p className="text-sm text-brand-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      ) : null}

      {oauthProviders.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">One-tap access</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {oauthProviders.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="secondary"
                className={cn("w-full justify-between border border-brand-200 bg-white text-brand-900 shadow-sm")}
                onClick={() => handleOAuth(provider.id)}
                disabled={pendingId === provider.id}
              >
                <span>{provider.name}</span>
                {pendingId === provider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {!emailProvider && !oauthProviders.length ? (
        <p className="rounded-xl border border-dashed border-brand-200 bg-white/80 px-4 py-3 text-sm text-brand-800">
          No sign-in methods are configured. Add an OAuth provider or email server credentials to enable authentication.
        </p>
      ) : null}
    </div>
  );
}
