import type { PaymentTransaction, Prisma, PrismaClient, ReceiptDelivery } from "@prisma/client";
import { formatCurrencyWithCode } from "../format";
import { featureFor, refundBalance, type OperationInput } from "./financial";
import { orderDetailInclude } from "./queries";
import type { ActionChoice, ActionEligibility } from "./operations-types";

function financialGate(kind: string, reason?: string) {
  const feature = featureFor(kind);
  return reason || (feature && process.env[feature] !== "true" ? `${feature} is disabled pending provider validation.` : undefined);
}

export function paymentActionChoices(payment: PaymentTransaction, remaining: number, locked: boolean): ActionChoice[] {
  const gate = (kind: string, reason?: string) => financialGate(kind, reason || (locked ? "Another financial operation requires reconciliation." : undefined));
  const unavailable = payment.provider !== "dpo" || !payment.dpoMode || !payment.transactionToken ? "A saved DPO environment and original transaction token are required." : undefined;
  return [
    { kind: "verify_payment", label: "Verify with DPO", effect: "Read the original transaction using its saved gateway environment. Only independent payment verification can approve fulfilment.", disabled: unavailable },
    { kind: "capture", label: "Capture authorization", effect: `Queue capture of ${formatCurrencyWithCode(payment.amountCents, payment.currency)}. This does not immediately establish payment completion.`, disabled: gate("capture", unavailable || (payment.status !== "authorized" ? "The payment must be authorized." : undefined)) },
    { kind: "cancel_payment", label: "Cancel unpaid transaction", effect: "Cancel the original unpaid token. This does not guarantee immediate release of a bank hold.", disabled: gate("cancel_payment", unavailable || (!["pending", "authorized", "verification_error"].includes(payment.status) ? "Only an unpaid transaction is eligible." : undefined)) },
    { kind: "refund", label: "Refund payment", amount: true, effect: `Refund up to ${formatCurrencyWithCode(remaining, payment.currency)} to the original payment method. An uncertain request reserves its balance until reconciled.`, disabled: gate("refund", unavailable || (payment.status !== "approved" || remaining <= 0 ? "No independently approved refundable balance." : undefined)) },
    { kind: "record_refund", label: "Record external refund", amount: true, reference: "Verified external refund / chargeback reference", effect: `Record a refund already completed outside the app in ${payment.currency}. No provider refund will be submitted.`, disabled: gate("record_refund", payment.provider !== "dpo" || !payment.dpoMode || payment.status !== "approved" || remaining <= 0 ? "No independently approved refundable balance in a saved DPO environment." : undefined) },
  ];
}

type DetailedOrder = Prisma.EsimOrderGetPayload<{ include: typeof orderDetailInclude }>;
export function orderActionChoices(order: DetailedOrder, unresolvedKinds: string[] = []): ActionChoice[] {
  const sale = order.saleCheckout ?? order.checkout;
  const blocked = Boolean(sale?.fulfillmentHold || sale?.activeOrderId && sale.activeOrderId !== order.id);
  return [
    { kind: "recover_order", label: "Reconcile supplier purchase", effect: "Search and recover the original purchase using its saved supplier identifiers and exact order marker. This does not buy another eSIM." },
    { kind: "refresh_installation", label: "Refresh installation", effect: "Fetch available installation details for this existing eSIM.", disabled: blocked ? "Delivery is held or superseded." : !order.orderNumber ? "A confirmed supplier reference is required." : undefined },
    { kind: "retry_fulfillment", label: "Retry unsubmitted purchase", effect: "Retry through the existing leased worker only when no supplier submission was accepted.", disabled: blocked || order.saleCheckoutId || !sale || !["pending", "airalo_rejected"].includes(order.status) || order.orderNumber || order.requestId ? "Only an active, definitively unsubmitted original purchase is eligible." : process.env.PURCHASE_LIFECYCLE_ENABLED !== "true" ? "Purchase lifecycle workers are disabled." : undefined },
    { kind: "replace_order", label: "Create goodwill replacement", effect: `Purchase a replacement at the business's cost. Current package: ${order.package.title} · ${order.package.data} · ${order.package.day} days · ${order.package.operator.country.title}. The original purchase is preserved and future delivery uses the replacement.`, package: true, disabled: financialGate("replace_order", blocked || !sale || order.payment?.status !== "approved" ? "An active sale with confirmed payment is required." : order.ownershipReviewRequired || sale.ownershipReviewRequired ? "Resolve ownership review first." : unresolvedKinds.some(kind => ["refund", "capture", "replace_order"].includes(kind)) ? "Another financial operation requires reconciliation." : undefined) },
    { kind: "supplier_refund", label: "Request supplier reimbursement", effect: "Submit an Airalo refund request for this eSIM. The supplier determines the approved credit amount; submission does not establish reimbursement. Supplier credit is separate from any customer refund.", reference: "Airalo refund reason code (e.g. INSTALLATION_FAILURE)", disabled: financialGate("supplier_refund", !order.profiles.length ? "An identified eSIM is required; escalate missing supplier purchases." : unresolvedKinds.includes("supplier_refund") ? "An existing supplier refund request needs reconciliation." : undefined) },
    { kind: "resolve_ownership", label: "Restore existing owner access", effect: "Confirm that you independently checked ownership evidence. Restore access to the existing owner only; no ownership reassignment is performed.", disabled: !order.ownershipReviewRequired ? "This order does not require ownership review." : !order.user?.emailProofAt || order.user.recoveryRequired ? "Fresh proof of the existing account email is required." : undefined },
  ];
}

export function receiptActionChoices(receipt: Pick<ReceiptDelivery, "status">, blocked: boolean): ActionChoice[] {
  return [
    { kind: "retry_receipt", label: "Retry delivery", effect: "Retry the immutable payload and existing idempotency key.", disabled: blocked ? "Delivery held or superseded." : receipt.status !== "pending" ? "Only pending delivery can be retried." : process.env.RECEIPT_OUTBOX_ENABLED !== "true" ? "Receipt worker is disabled." : undefined },
    { kind: "confirm_receipt", label: "Confirm provider acceptance", reference: "Verified provider message ID", effect: "Record independent provider acceptance evidence without sending another message.", disabled: blocked || receipt.status !== "review" ? "Only an active receipt awaiting review can be confirmed." : undefined },
    { kind: "resend_receipt", label: "Explicitly resend", effect: "Create a new delivery key after review. The customer may receive another copy if the earlier send was accepted.", disabled: blocked || receipt.status !== "review" ? "Only an active receipt awaiting review can be resent." : undefined },
  ];
}

/** Read fresh, sanitized eligibility after commands; provider calls remain in the command layer. */
export async function refreshedEligibility(db: PrismaClient, input: OperationInput): Promise<ActionEligibility | null> {
  if (["verify_payment", "capture", "cancel_payment", "refund", "record_refund"].includes(input.kind)) {
    const balance = await db.$transaction(tx => refundBalance(tx, input.targetId));
    const locked = await db.adminOperation.count({ where: { status: { in: ["running", "unknown", "provider_pending"] }, kind: { in: ["capture", "cancel_payment", "refund", "replace_order"] }, OR: [{ targetId: input.targetId }, ...(balance.payment.checkoutId ? [{ payload: { path: ["saleId"], equals: balance.payment.checkoutId } }] : [])] } });
    return { targetId: input.targetId, version: balance.payment.updatedAt.toISOString(), actions: paymentActionChoices(balance.payment, balance.remaining, locked > 0) };
  }
  if (["retry_receipt", "confirm_receipt", "resend_receipt"].includes(input.kind)) {
    const receipt = await db.receiptDelivery.findUniqueOrThrow({ where: { id: input.targetId }, include: { order: { include: { checkout: true, saleCheckout: true } } } });
    const sale = receipt.order.saleCheckout ?? receipt.order.checkout;
    const blocked = Boolean(sale?.fulfillmentHold || sale?.activeOrderId && sale.activeOrderId !== receipt.orderId);
    return { targetId: input.targetId, version: receipt.updatedAt.toISOString(), actions: receiptActionChoices(receipt, blocked) };
  }
  if (["recover_order", "refresh_installation", "retry_fulfillment", "replace_order", "supplier_refund", "resolve_ownership"].includes(input.kind)) {
    const order = await db.esimOrder.findUniqueOrThrow({ where: { id: input.targetId }, include: orderDetailInclude });
    const sale = order.saleCheckout ?? order.checkout;
    const pending = await db.adminOperation.findMany({ where: { status: { in: ["running", "unknown", "provider_pending"] }, OR: [{ targetId: order.id }, ...(sale ? [{ payload: { path: ["saleId"], equals: sale.id } }] : [])] }, select: { kind: true } });
    return { targetId: input.targetId, version: order.updatedAt.toISOString(), actions: orderActionChoices(order, pending.map(operation => operation.kind)) };
  }
  return null;
}
