"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import Link from "next/link";

type CheckoutResponseBody = {
  checkoutId?: string;
  message?: string;
  issues?: { message?: string; path?: (string | number)[] }[];
};

export function GuestCheckoutForm({
  packageId,
  defaultEmail = "",
  quantity = 1,
}: {
  packageId: string;
  defaultEmail?: string | null;
  quantity?: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          customerEmail: email,
          quantity,
        }),
      });
      trackEvent("checkout_started", { package_id: packageId, quantity });
      const data = (await response.json().catch(() => ({}))) as CheckoutResponseBody;

      if (!response.ok) {
        setError(
          data.issues?.[0]?.message ??
            data.message ??
            "Checkout is temporarily unavailable. Please try again.",
        );
        return;
      }

      if (!data.checkoutId) {
        setError("Checkout is temporarily unavailable. Please try again.");
        return;
      }

      router.push(`/checkout/${data.checkoutId}` as Route);
      trackEvent("payment_attempt", { checkout_id: data.checkoutId });
    } catch (caughtError) {
      console.error("Failed to create checkout", caughtError);
      setError("Checkout is temporarily unavailable. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-brand-100 bg-white p-5 shadow-card sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-brand-900">
            Where should we send your eSIM?
          </h2>
          <p className="mt-1 text-sm leading-6 text-brand-600">
            Your eSIM and installation instructions will be sent to this email when email delivery is configured. A secure order link is also created.
          </p>
        </div>
        <Mail className="h-5 w-5 text-brand-600" aria-hidden />
      </div>

      <label className="block text-sm font-bold text-brand-900">
        Email address
        <input
          name="customerEmail"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 h-12 w-full rounded-xl border border-brand-200 bg-white px-3.5 text-base text-brand-900 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          disabled={isPending}
        />
      </label>

      <label className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm leading-6 text-brand-700">
        <input type="checkbox" required checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500" disabled={isPending} />
        <span>I confirm the destination and device compatibility, and agree to the <Link href="/terms" className="font-semibold underline">terms</Link> and <Link href="/refunds" className="font-semibold underline">refund information</Link>.</span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-brand-500">
          No account needed. You can save this eSIM after purchase.
        </p>
        <Button type="submit" disabled={isPending || !email.trim() || !acceptedTerms}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting payment...
            </>
          ) : (
            <>
              Continue to secure payment
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
