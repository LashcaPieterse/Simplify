"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

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
  const initialEmail = searchParams.get("email") ?? "";

  const oauthProviders = useMemo(() => providers.filter((provider) => provider.type === "oauth"), [providers]);
  const googleProvider = useMemo(() => oauthProviders.find((provider) => provider.id === "google"), [oauthProviders]);
  const emailProvider = useMemo(() => providers.find((provider) => provider.type === "email"), [providers]);
  const hasCredentials = useMemo(() => providers.some((provider) => provider.id === "credentials"), [providers]);

  const [email, setEmail] = useState(initialEmail);
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

  async function handleGoogle() {
    if (!googleProvider) {
      setMessage(null);
      setError("Google sign-in is not available right now. Use email and password to continue.");
      return;
    }
    await handleOAuth(googleProvider.id);
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
      if (callbackUrl.startsWith("http")) {
        window.location.assign(callbackUrl);
        return;
      }
      router.push(callbackUrl as Route);
    });
  }

  if (mode === "signin") {
    const googleIsPending = googleProvider ? pendingId === googleProvider.id : false;

    return (
      <div className="space-y-6">
        <button
          type="button"
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-brand-100 bg-white px-5 text-base font-semibold text-brand-900 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:pointer-events-none disabled:opacity-70"
          onClick={handleGoogle}
          disabled={googleIsPending || isPending}
        >
          {googleIsPending ? <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> : <GoogleIcon className="h-5 w-5" />}
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-brand-100" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">or continue with email</p>
          <div className="h-px flex-1 bg-brand-100" />
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          <label className="block text-sm font-semibold text-brand-900">
            Email
            <span className="relative mt-2 block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-500" />
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-[52px] w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 pl-12 text-base text-brand-900 shadow-inner transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </span>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-brand-900" htmlFor="auth-password">
                Password
              </label>
              <a
                href="mailto:support@simplify.africa?subject=Password%20reset%20help"
                className="text-sm font-semibold text-brand-700 transition hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                Forgot password?
              </a>
            </div>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-500" />
              <input
                id="auth-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                className="h-[52px] w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 pl-12 text-base text-brand-900 shadow-inner transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
              />
            </span>
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-[52px] w-full text-base"
            disabled={isPending || !hasCredentials}
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Log in
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>

          {message ? <p className="text-sm font-medium text-brand-700">{message}</p> : null}
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        </form>

        <div className="flex items-center justify-center gap-2 rounded-2xl bg-brand-50/70 px-4 py-3 text-center text-sm text-brand-700">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-500" />
          <span>Secure sign-in. We'll never share your personal details.</span>
        </div>
      </div>
    );
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

      {!hasCredentials && !emailProvider && !oauthProviders.length ? (
        <p className="rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-brand-800">
          Secure sign-in. We'll never share your personal details.
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
