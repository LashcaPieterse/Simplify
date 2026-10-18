"use client";

import { useEffect, useState } from "react";
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
  field?: string;
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
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState("");
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const [guide, setGuide] = useState<{ publicName: string; code: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/affiliates/referral${affiliateCode.trim() ? `?code=${encodeURIComponent(affiliateCode.trim())}` : ""}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        setAffiliateEnabled(Boolean(data.enabled));
        setGuide(data.guide ?? null);
      } catch { /* Checkout remains usable if optional referral preview is unavailable. */ }
    }, affiliateCode ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [affiliateCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setError(null);
    setAffiliateError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          customerEmail: email,
          quantity,
          ...(affiliateCode.trim() ? { affiliateCode: affiliateCode.trim() } : {}),
        }),
      });
      trackEvent("checkout_started", { package_id: packageId, quantity });
      const data = (await response.json().catch(() => ({}))) as CheckoutResponseBody;

      if (!response.ok) {
        if (data.field === "affiliateCode") {
          setAffiliateError(data.message ?? "Check this referral code.");
          return;
        }
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

      {affiliateEnabled ? <div className="rounded-2xl border border-brand-100 p-4">
        <label htmlFor="affiliate-code" className="block text-sm font-bold text-brand-900">Guide referral code (optional)</label>
        <input id="affiliate-code" name="affiliateCode" value={affiliateCode} maxLength={32} onChange={event => { setAffiliateCode(event.target.value); setAffiliateError(null); setGuide(null); }} disabled={isPending} aria-invalid={Boolean(affiliateError)} aria-describedby="affiliate-code-help" autoComplete="off" className="mt-2 h-12 w-full rounded-xl border border-brand-200 px-3.5 text-base uppercase text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        <p id="affiliate-code-help" className="mt-2 text-xs leading-6 text-brand-600">{guide ? `Referred by ${guide.publicName}. Your guide may earn commission at no extra cost to you.` : "Enter your guide’s code. Referral codes provide attribution, with no change to the price."}</p>
        {guide && !affiliateCode.trim() ? <button type="button" className="mt-1 text-xs font-semibold text-brand-600 underline" disabled={isPending} onClick={async () => { const response = await fetch("/api/affiliates/referral", { method: "DELETE" }); if (response.ok) setGuide(null); }}>Forget remembered guide</button> : null}
        {affiliateError ? <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{affiliateError}</p> : null}
      </div> : null}

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
