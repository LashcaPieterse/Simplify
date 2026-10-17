"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";

import { StorefrontPlanCard } from "@/components/plans/StorefrontPlanCard";
import { Button } from "@/components/ui/button";
import {
  recommendPlanForUsage,
  USAGE_PROFILES,
  type UsageProfileId,
} from "@/lib/catalog/recommendations";
import type { StorefrontPlan } from "@/lib/catalog/storefront";
import { trackEvent } from "@/lib/analytics";

function formatEstimate(megabytes: number): string {
  const gigabytes = Math.ceil((megabytes / 1024) * 10) / 10;
  return `${gigabytes.toFixed(gigabytes % 1 === 0 ? 0 : 1)} GB`;
}

export function UsageRecommender({
  country,
  plans,
}: {
  country: string;
  plans: StorefrontPlan[];
}) {
  const [profileId, setProfileId] = useState<UsageProfileId>("regular");
  const [days, setDays] = useState(14);
  const [submitted, setSubmitted] = useState(false);
  const recommendation = recommendPlanForUsage(plans, days, profileId);

  return (
    <section className="rounded-2xl border border-brand-100 bg-brand-50 p-5 sm:p-7" aria-labelledby="usage-recommender-title">
      <div className="max-w-3xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-subtle">
          <Calculator className="h-5 w-5" aria-hidden />
        </div>
        <h2 id="usage-recommender-title" className="mt-5 text-2xl font-medium text-brand-900 sm:text-3xl">
          How much data might you need?
        </h2>
        <p className="mt-3 text-sm leading-6 text-brand-600">
          Choose how you expect to use your phone and your trip length. This is an estimate, not a usage guarantee.
        </p>
      </div>

      <fieldset className="mt-7">
        <legend className="text-sm font-black text-brand-900">Main phone use</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {USAGE_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              aria-pressed={profileId === profile.id}
              onClick={() => {
                setProfileId(profile.id);
                setSubmitted(false);
              }}
              className={`min-h-24 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                profileId === profile.id
                  ? "border-brand-600 bg-accent-100 shadow-subtle"
                  : "border-brand-100 bg-white/70 hover:border-brand-300"
              }`}
            >
              <span className="block font-black text-brand-900">{profile.label}</span>
              <span className="mt-1 block text-xs leading-5 text-brand-600">{profile.detail}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-[12rem_auto] sm:items-end">
        <label className="text-sm font-black text-brand-900">
          Trip length in days
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(event) => {
              setDays(Math.max(1, Math.min(90, Number(event.target.value) || 1)));
              setSubmitted(false);
            }}
            className="mt-2 h-12 w-full rounded-xl border border-brand-200 bg-white px-3 text-base font-normal focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <Button
          type="button"
          className="w-full sm:w-auto sm:justify-self-start"
          onClick={() => {
            trackEvent("recommendation_started", { destination: country, days, usage: profileId });
            setSubmitted(true);
            trackEvent("recommendation_completed", {
              destination: country,
              days,
              usage: profileId,
              estimated_data_mb: recommendation.estimatedDataMb,
              package_id: recommendation.plan?.externalId ?? null,
              meets_estimate: recommendation.meetsEstimate,
            });
          }}
        >
          Recommend a plan
        </Button>
      </div>

      {submitted ? (
        <div className="mt-7 border-t border-brand-200 pt-7" aria-live="polite">
          <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${recommendation.meetsEstimate ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>
              Estimated need: <strong>about {formatEstimate(recommendation.estimatedDataMb)}</strong> for {days} days. {recommendation.meetsEstimate ? "The plan below meets both the estimated data and trip length." : "No current plan meets both estimates, so this is the closest available option. Review the shortfall before buying."}
            </p>
          </div>
          {recommendation.plan ? (
            <div className="max-w-md">
              <StorefrontPlanCard plan={recommendation.plan} badge={recommendation.meetsEstimate ? "Usage match" : "Closest option"} />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-6 text-sm text-brand-600">
              No current plan is available for this recommendation. Try again after the catalogue refreshes.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
