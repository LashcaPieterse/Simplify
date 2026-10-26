import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatCurrencyWithCode } from "@/lib/format";
import { formatOpsTime } from "@/lib/admin/queries";
import { refundBalance } from "@/lib/admin/financial";
import { paymentActionChoices } from "@/lib/admin/eligibility";
import { OperationForm } from "@/components/admin/OperationForm";
import { Badge, Empty, OperationsHistory, OpsLink, PageTitle, Panel } from "@/components/admin/OpsUI";

export default async function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession(); const { id } = await params;
  const payment = await prisma.paymentTransaction.findUnique({ where: { id }, include: { checkout: true, orders: { select: { id: true, status: true, replacementForId: true } }, refunds: { orderBy: { createdAt: "desc" } }, webhookEvents: { select: { id: true, eventType: true, fromStatus: true, toStatus: true, receivedAt: true }, orderBy: { receivedAt: "desc" }, take: 30 } } });
  if (!payment) notFound();
  const balance = await prisma.$transaction(tx => refundBalance(tx, id));
  const operations = await prisma.adminOperation.findMany({ where: { OR: [{ targetId: id }, ...(payment.checkoutId ? [{ payload: { path: ["saleId"], equals: payment.checkoutId } }] : [])] }, orderBy: { startedAt: "desc" }, take: 40 });
  const locked = operations.some(op => ["running", "unknown", "provider_pending"].includes(op.status) && ["capture", "cancel_payment", "refund", "replace_order"].includes(op.kind));
  const actions = paymentActionChoices(payment, balance.remaining, locked);
  return <div className="space-y-6"><OpsLink href="/admin/payments">All payments</OpsLink><PageTitle title={payment.providerReference ?? "Payment details"} description={`${payment.id} · ${payment.dpoMode ?? "unknown"} gateway · ${formatCurrencyWithCode(payment.amountCents, payment.currency)}`} />
    <Panel title="Payment evidence"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt>Status</dt><dd><Badge>{payment.status}</Badge></dd></div><div><dt>Customer</dt><dd className="break-all">{payment.checkout?.customerEmail ?? "Not recorded"}</dd></div><div><dt>Provider result code</dt><dd>{payment.providerCode ?? "Not verified"}</dd></div><div><dt>First approval</dt><dd>{formatOpsTime(payment.approvedAt)}</dd></div><div><dt>Checkout</dt><dd className="break-all">{payment.checkoutId ?? "Not recorded"}</dd></div><div><dt>Fulfilment disposition</dt><dd>{payment.checkout?.fulfillmentHold ?? "Active"}</dd></div><div><dt>Confirmed refunds</dt><dd>{formatCurrencyWithCode(balance.confirmed, payment.currency)}</dd></div><div><dt>Remaining refundable balance</dt><dd>{formatCurrencyWithCode(balance.remaining, payment.currency)}</dd></div></dl></Panel>
    <Panel title="Actions"><OperationForm targetId={id} version={payment.updatedAt.toISOString()} actions={actions} context={`${payment.providerReference ?? payment.id} · ${payment.dpoMode ?? "unknown"} DPO environment · ${formatCurrencyWithCode(payment.amountCents, payment.currency)}`} /></Panel>
    <Panel title="Orders">{payment.orders.length ? payment.orders.map(order => <p key={order.id} className="text-sm"><OpsLink href={`/admin/orders/${order.id}`}>{order.id}</OpsLink> · {order.status}{order.replacementForId ? " · replacement, no additional customer charge" : ""}</p>) : <Empty>No supplier purchase has been created.</Empty>}</Panel>
    <Panel title="Refund journal">{payment.refunds.length ? payment.refunds.map(refund => <div key={refund.id} className="border-t py-3 text-sm"><p>{formatCurrencyWithCode(refund.amountCents, refund.currency)} · <Badge>{refund.status}</Badge></p><p className="mt-1 break-all text-xs">{refund.reference} · {formatOpsTime(refund.createdAt)}</p><p className="mt-1 text-xs">{refund.evidence}</p></div>) : <Empty>No journal refunds. Historical external adjustments are included in the balance above.</Empty>}</Panel>
    <Panel title="Payment and callback timeline">{payment.webhookEvents.length ? payment.webhookEvents.map(event => <p key={event.id} className="border-t py-2 text-sm">{formatOpsTime(event.receivedAt)} · {event.eventType} · {event.fromStatus ?? "notification"} → {event.toStatus ?? "no state transition"}</p>) : <Empty>No matched provider notifications or transitions recorded.</Empty>}<OpsLink href="/admin/health">View callback diagnostics and system health</OpsLink></Panel>
    <OperationsHistory operations={operations} />
  </div>;
}
