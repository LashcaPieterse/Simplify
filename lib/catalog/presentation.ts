import type { StorefrontPlan } from "./storefront";
import type { CartItem } from "@/components/cart/CartProvider";

export function storefrontPlanToCartItem(
  plan: StorefrontPlan,
): Omit<CartItem, "quantity"> {
  return {
    packageId: plan.externalId,
    title: plan.title,
    destination: plan.destination.title,
    dataLabel: plan.dataLabel,
    validityLabel: plan.validityDays ? `${plan.validityDays} days` : "Validity unavailable",
    unitPriceCents: plan.price.cents,
    currency: plan.price.currency,
  };
}

export function formatKnownBoolean(value: boolean | null, labels?: { yes: string; no: string }): string {
  if (value === null) return "Unknown";
  return value ? labels?.yes ?? "Yes" : labels?.no ?? "No";
}
