"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

type CheckoutResponseBody = {
  checkoutId?: string;
  message?: string;
  issues?: { message?: string; path?: (string | number)[] }[];
};

export function GuestCheckoutForm({
  packageId,
  defaultEmail = "",
}: {
  packageId: string;
  defaultEmail?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

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
        }),
      });
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
      className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Where should we send your eSIM?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            We&apos;ll email your receipt and a secure link to manage this order.
          </p>
        </div>
        <Mail className="h-5 w-5 text-teal-600" aria-hidden />
      </div>

      <label className="block text-sm font-semibold text-slate-900">
        Email address
        <input
          name="customerEmail"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          disabled={isPending}
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          No account needed. You can save this eSIM after purchase.
        </p>
        <Button type="submit" disabled={isPending || !email.trim()}>
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
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
