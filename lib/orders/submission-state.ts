import { AiraloError } from "../airalo/client";
import { extractAiraloBusinessError } from "../airalo/errors";
import { OrderServiceError } from "./errors";

export const ORDER_SUBMITTING_STATUS = "airalo_submitting";
export const ORDER_REJECTED_STATUS = "airalo_rejected";
export const ORDER_OUTCOME_UNKNOWN_STATUS = "airalo_outcome_unknown";
export const ORDER_CLAIMABLE_STATUSES = ["pending", ORDER_REJECTED_STATUS];

export type PurchaseFailureOutcome = "rejected" | "unknown";

export function resolvePurchaseFailureOutcome(error: unknown): PurchaseFailureOutcome {
  if (!(error instanceof AiraloError)) return "unknown";
  if (error.details.purchaseNotSubmitted) return "rejected";

  // A temporary/unexpected supplier failure may follow purchase acceptance.
  // Only explicit rejections are safe to submit again in a later attempt.
  if (extractAiraloBusinessError(error.details.body)?.code === 53) return "unknown";
  return [400, 401, 403, 404, 422, 429].includes(error.details.status)
    ? "rejected"
    : "unknown";
}

export function assertPurchaseOutcomeKnown(order: {
  orderNumber?: string | null;
  requestId?: string | null;
  status?: string | null;
}): void {
  if (
    !order.orderNumber && !order.requestId &&
    // Legacy failures did not distinguish rejection from acceptance followed
    // by a lost response. They must not be automatically resubmitted either.
    [ORDER_OUTCOME_UNKNOWN_STATUS, "airalo_failed"].includes(order.status ?? "")
  ) {
    throw new OrderServiceError(
      "Supplier purchase outcome is unknown. Reconcile the existing order before retrying fulfillment.",
      503,
    );
  }
}
