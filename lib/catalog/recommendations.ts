import type { StorefrontPlan } from "./storefront";

export type UsageProfileId = "light" | "regular" | "business" | "heavy";

export type UsageProfile = {
  id: UsageProfileId;
  label: string;
  detail: string;
  perDayMb: number;
};

export const USAGE_PROFILES: readonly UsageProfile[] = [
  {
    id: "light",
    label: "Light",
    detail: "WhatsApp, maps, and email",
    perDayMb: 250,
  },
  {
    id: "regular",
    label: "Regular",
    detail: "Social media, maps, music, and browsing",
    perDayMb: 600,
  },
  {
    id: "business",
    label: "Business",
    detail: "Email, Teams or Zoom, and cloud tools",
    perDayMb: 1200,
  },
  {
    id: "heavy",
    label: "Heavy",
    detail: "Video, large uploads, and streaming",
    perDayMb: 2000,
  },
] as const;

export function getUsageProfile(id: UsageProfileId): UsageProfile {
  return USAGE_PROFILES.find((profile) => profile.id === id) ?? USAGE_PROFILES[1]!;
}

export function estimateTripDataMb(days: number, profileId: UsageProfileId): number {
  const normalizedDays = Number.isFinite(days) ? Math.max(1, Math.min(90, Math.round(days))) : 1;
  return Math.ceil(normalizedDays * getUsageProfile(profileId).perDayMb);
}

export function planMeetsTripNeed(
  plan: StorefrontPlan,
  days: number,
  requiredDataMb: number,
): boolean {
  const validityFits = typeof plan.validityDays === "number" && plan.validityDays >= days;
  const dataFits = plan.isUnlimited || (
    typeof plan.dataAmountMb === "number" && plan.dataAmountMb >= requiredDataMb
  );
  return validityFits && dataFits;
}

function tripShortfall(plan: StorefrontPlan, days: number, requiredDataMb: number) {
  const validityShortfall = Math.max(0, days - (plan.validityDays ?? 0));
  const dataShortfall = plan.isUnlimited
    ? 0
    : Math.max(0, requiredDataMb - (plan.dataAmountMb ?? 0));
  return {
    missingDimensions: Number(validityShortfall > 0) + Number(dataShortfall > 0),
    validityShortfall,
    dataShortfall,
  };
}

export function comparePlansForTripNeed(
  left: StorefrontPlan,
  right: StorefrontPlan,
  days: number,
  requiredDataMb: number,
): number {
  const leftShortfall = tripShortfall(left, days, requiredDataMb);
  const rightShortfall = tripShortfall(right, days, requiredDataMb);

  const fitDifference =
    leftShortfall.missingDimensions - rightShortfall.missingDimensions ||
    leftShortfall.validityShortfall - rightShortfall.validityShortfall ||
    leftShortfall.dataShortfall - rightShortfall.dataShortfall;
  if (fitDifference) return fitDifference;

  if (left.price.currency === right.price.currency) {
    const priceDifference = left.price.cents - right.price.cents;
    if (priceDifference) return priceDifference;
  }

  const leftExcessData = left.isUnlimited
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, (left.dataAmountMb ?? 0) - requiredDataMb);
  const rightExcessData = right.isUnlimited
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, (right.dataAmountMb ?? 0) - requiredDataMb);

  return (
    leftExcessData - rightExcessData ||
    (left.validityDays ?? Number.MAX_SAFE_INTEGER) -
      (right.validityDays ?? Number.MAX_SAFE_INTEGER) ||
    left.title.localeCompare(right.title)
  );
}

export function recommendPlanForUsage(
  plans: StorefrontPlan[],
  days: number,
  profileId: UsageProfileId,
): {
  estimatedDataMb: number;
  plan: StorefrontPlan | null;
  meetsEstimate: boolean;
} {
  const estimatedDataMb = estimateTripDataMb(days, profileId);
  const plan = [...plans].sort((left, right) =>
    comparePlansForTripNeed(left, right, days, estimatedDataMb),
  )[0] ?? null;

  return {
    estimatedDataMb,
    plan,
    meetsEstimate: Boolean(plan && planMeetsTripNeed(plan, days, estimatedDataMb)),
  };
}
