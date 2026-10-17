import {
  comparePlansForTripNeed,
  planMeetsTripNeed,
} from "@/lib/catalog/recommendations";
import {
  planCoversDestination,
  type StorefrontCountry,
  type StorefrontPlan,
} from "@/lib/catalog/storefront";

export type RoutePlanMatch = {
  plan: StorefrontPlan;
  destinations: StorefrontCountry[];
  meetsEstimate: boolean;
};

export type RouteCombination = {
  matches: RoutePlanMatch[];
  totalCents: number | null;
  currency: string | null;
};

function coverageIndexes(
  plan: StorefrontPlan,
  destinations: StorefrontCountry[],
): number[] {
  if (plan.isRegional && !plan.coverageVerified) return [];
  return destinations
    .map((destination, index) =>
      planCoversDestination(plan, destination) ? index : -1,
    )
    .filter((index) => index >= 0);
}

function coverageKey(indexes: Iterable<number>): string {
  return Array.from(new Set(indexes)).sort((left, right) => left - right).join(",");
}

function mergeCoverage(left: string, right: string): string {
  const indexes = `${left},${right}`
    .split(",")
    .filter(Boolean)
    .map(Number);
  return coverageKey(indexes);
}

function solutionQuality(
  plans: StorefrontPlan[],
  days: number,
  requiredDataMb: number,
): number {
  return plans.reduce((total, plan) => {
    const validityShortfall = Math.max(0, days - (plan.validityDays ?? 0));
    const dataShortfall = plan.isUnlimited
      ? 0
      : Math.max(0, requiredDataMb - (plan.dataAmountMb ?? 0));
    return total + validityShortfall * 100_000 + dataShortfall;
  }, 0);
}

function totalForSameCurrency(plans: StorefrontPlan[]): {
  cents: number | null;
  currency: string | null;
} {
  const currencies = new Set(plans.map((plan) => plan.price.currency));
  if (currencies.size !== 1 || plans.length === 0) {
    return { cents: null, currency: null };
  }
  return {
    cents: plans.reduce((total, plan) => total + plan.price.cents, 0),
    currency: plans[0]!.price.currency,
  };
}

function compareSolutions(
  left: StorefrontPlan[],
  right: StorefrontPlan[],
  days: number,
  requiredDataMb: number,
): number {
  const countDifference = left.length - right.length;
  if (countDifference) return countDifference;

  const fitDifference =
    solutionQuality(left, days, requiredDataMb) -
    solutionQuality(right, days, requiredDataMb);
  if (fitDifference) return fitDifference;

  const leftTotal = totalForSameCurrency(left);
  const rightTotal = totalForSameCurrency(right);
  if (
    leftTotal.cents !== null &&
    rightTotal.cents !== null &&
    leftTotal.currency === rightTotal.currency
  ) {
    const priceDifference = leftTotal.cents - rightTotal.cents;
    if (priceDifference) return priceDifference;
  }

  return left.map((plan) => plan.id).join("|").localeCompare(
    right.map((plan) => plan.id).join("|"),
  );
}

function bestPlan(
  plans: StorefrontPlan[],
  days: number,
  requiredDataMb: number,
): StorefrontPlan | null {
  return [...plans].sort((left, right) =>
    comparePlansForTripNeed(left, right, days, requiredDataMb),
  )[0] ?? null;
}

/**
 * Finds an exact minimum-cardinality set cover from verified regional coverage
 * groups plus one local fallback per uncovered country. Regional packages with
 * identical route coverage are collapsed to their best trip fit first, keeping
 * the dynamic-programming state small without weakening coverage validation.
 */
export function findSmallestRouteCombination({
  destinations,
  regionalPlans,
  localPlans,
  days,
  requiredDataMb,
  excludePlanIds = [],
}: {
  destinations: StorefrontCountry[];
  regionalPlans: StorefrontPlan[];
  localPlans: StorefrontPlan[];
  days: number;
  requiredDataMb: number;
  excludePlanIds?: string[];
}): RouteCombination | null {
  if (destinations.length === 0) return null;
  const excluded = new Set(excludePlanIds);

  const regionalGroups = new Map<string, StorefrontPlan[]>();
  for (const plan of regionalPlans) {
    if (excluded.has(plan.id)) continue;
    const key = coverageKey(coverageIndexes(plan, destinations));
    if (!key) continue;
    const group = regionalGroups.get(key) ?? [];
    group.push(plan);
    regionalGroups.set(key, group);
  }

  const regionalCandidates = Array.from(regionalGroups.entries()).map(
    ([key, plans]) => ({ key, plan: bestPlan(plans, days, requiredDataMb)! }),
  );

  const localCandidates = destinations.map((destination) =>
    bestPlan(
      localPlans.filter(
        (plan) => !excluded.has(plan.id) && planCoversDestination(plan, destination),
      ),
      days,
      requiredDataMb,
    ),
  );

  const states = new Map<string, StorefrontPlan[]>([["", []]]);
  for (const candidate of regionalCandidates) {
    const snapshot = Array.from(states.entries());
    for (const [covered, plans] of snapshot) {
      const nextCoverage = mergeCoverage(covered, candidate.key);
      if (nextCoverage === covered) continue;
      const nextPlans = [...plans, candidate.plan];
      const existing = states.get(nextCoverage);
      if (!existing || compareSolutions(nextPlans, existing, days, requiredDataMb) < 0) {
        states.set(nextCoverage, nextPlans);
      }
    }
  }

  let winningPlans: StorefrontPlan[] | null = null;
  for (const [covered, regionalSelection] of Array.from(states.entries())) {
    const coveredIndexes = new Set(
      covered.split(",").filter(Boolean).map(Number),
    );
    const completed = [...regionalSelection];
    let complete = true;

    for (let index = 0; index < destinations.length; index += 1) {
      if (coveredIndexes.has(index)) continue;
      const localPlan = localCandidates[index];
      if (!localPlan) {
        complete = false;
        break;
      }
      completed.push(localPlan);
    }

    if (
      complete &&
      (!winningPlans || compareSolutions(completed, winningPlans, days, requiredDataMb) < 0)
    ) {
      winningPlans = completed;
    }
  }

  if (!winningPlans) return null;
  const total = totalForSameCurrency(winningPlans);

  return {
    matches: winningPlans.map((plan) => ({
      plan,
      destinations: destinations.filter((destination) =>
        planCoversDestination(plan, destination),
      ),
      meetsEstimate: planMeetsTripNeed(plan, days, requiredDataMb),
    })),
    totalCents: total.cents,
    currency: total.currency,
  };
}
