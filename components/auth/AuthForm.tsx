"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";
import { registerWithPassword } from "@/app/auth/signup/actions";

export type ProviderInfo = {
  id: string;
  name: string;
  type: string;
};

export function AuthForm({ providers, mode }: { providers: ProviderInfo[]; mode: "signin" | "signup" }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const oauthProviders = useMemo(() => providers.filter((provider) => provider.type === "oauth"), [providers]);
  const emailProvider = useMemo(() => providers.find((provider) => provider.type === "email"), [providers]);
  const hasCredentials = useMemo(() => providers.some((provider) => provider.id === "credentials"), [providers]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (mode === "signup") {
        const result = await registerWithPassword(new FormData(event.currentTarget));
        if (!result.success) {
          setError(result.error ?? "Unable to sign up");
          return;
        }
        await signIn("credentials", { email, password, callbackUrl, redirect: false });
      } else {
        // Sign in existing user with credentials
        const result = await signIn("credentials", { email, password, callbackUrl, redirect: false });
        if (result?.error) {
          setError("Invalid email or password.");
          return;
        }
      }
      router.push(callbackUrl);
    });
  }

  return (
    <div className="space-y-8">
      {hasCredentials ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-2xl border border-brand-100 bg-white/90 p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {mode === "signup" ? "Create with password" : "Log in with password"}
              </p>
              <p className="text-sm text-brand-700">
                {mode === "signup"
                  ? "Set a password for quick access without Google."
                  : "Use your email and password to sign in."}
              </p>
            </div>
            <Lock className="h-4 w-4 text-brand-500" />
          </div>
          {mode === "signup" ? (
            <label className="block text-sm font-semibold text-brand-900">
              Name
              <input
                name="name"
                type="text"
                className="mt-2 w-full rounded-xl border border-brand-100 bg-white px-3 py-2 text-sm text-brand-900 shadow-inner focus:border-brand-400 focus:outline-none"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
              />
            </label>
          ) : null}
          <label className="block text-sm font-semibold text-brand-900">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-xl border border-brand-100 bg-white px-3 py-2 text-sm text-brand-900 shadow-inner focus:border-brand-400 focus:outline-none"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-semibold text-brand-900">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-2 w-full rounded-xl border border-brand-100 bg-white px-3 py-2 text-sm text-brand-900 shadow-inner focus:border-brand-400 focus:outline-none"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
            />
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs text-brand-700">You can still use Google later.</p>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "signup" ? "Creating..." : "Signing in..."}
                </>
              ) : mode === "signup" ? (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Log in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          {message ? <p className="text-sm text-brand-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      ) : null}

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
            <p className="text-xs text-brand-700">You will stay signed in on this device after verification.</p>
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
