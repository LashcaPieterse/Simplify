export const OPERATION_KINDS = ["verify_payment", "capture", "cancel_payment", "refund", "record_refund", "resolve_refund", "replace_order", "supplier_refund", "resolve_supplier_refund", "resolve_operation", "recover_order", "refresh_installation", "retry_fulfillment", "retry_receipt", "confirm_receipt", "resend_receipt", "resolve_ownership", "reconcile_affiliates", "run_recovery", "scheduler", "checkout_pause"] as const;
export type OperationKind = typeof OPERATION_KINDS[number];
export const FINANCIAL_KINDS: ReadonlySet<OperationKind> = new Set<OperationKind>(["capture", "cancel_payment", "refund", "record_refund", "resolve_refund", "replace_order", "supplier_refund", "resolve_supplier_refund", "resolve_operation"]);
export class OperationError extends Error {}
export type ActionChoice = { kind: OperationKind; label: string; effect: string; disabled?: string; amount?: boolean; reference?: string; package?: boolean; resolution?: boolean; enabled?: boolean };
export type ActionEligibility = { targetId: string; version: string; actions: ActionChoice[] };
export type OperationResult = { operationId: string; outcome: string; message: string; eligibility?: ActionEligibility | null };
export function operationMessage(outcome: string) {
  return ({ succeeded: "Completed. The record has been refreshed.", pending: "Recovery is still pending. Review the refreshed record and saved attempt before continuing.", provider_pending: "The provider accepted the request. Final confirmation is still pending.", unknown: "The outcome is uncertain. Reconcile this request before taking another action.", rejected: "The action was rejected. Review the recorded result before trying again.", running: "This operation is in progress. Refresh to check its result." } as Record<string, string>)[outcome] ?? "Recorded. Refresh to check progress.";
}
