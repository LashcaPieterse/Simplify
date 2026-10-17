export type AnalyticsEventName =
  | "destination_search"
  | "destination_selected"
  | "country_view"
  | "plan_view"
  | "plan_selected"
  | "recommendation_started"
  | "recommendation_completed"
  | "route_builder_started"
  | "route_builder_completed"
  | "compatibility_check"
  | "add_to_cart"
  | "remove_from_cart"
  | "checkout_started"
  | "payment_attempt"
  | "purchase_completed"
  | "purchase_failed"
  | "whatsapp_support_clicked"
  | "business_lead_submitted";

type AnalyticsValue = string | number | boolean | null;

export function trackEvent(
  event: AnalyticsEventName,
  properties: Record<string, AnalyticsValue> = {},
): void {
  if (typeof window === "undefined") return;

  const payload = { event, ...properties };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent("sim-africa:analytics", { detail: payload }));
}
