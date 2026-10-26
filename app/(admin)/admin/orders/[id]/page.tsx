import { resolveReceiptDeliveryDetails } from "@/lib/notifications/receipts";
import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { orderActionChoices, receiptActionChoices } from "@/lib/admin/eligibility";
import { formatOpsTime, orderDetailInclude } from "@/lib/admin/queries";
import { formatCurrencyWithCode } from "@/lib/format";
import { OperationForm } from "@/components/admin/OperationForm";
import { Badge, Empty, OperationsHistory, OpsLink, PageTitle, Panel } from "@/components/admin/OpsUI";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession(); const { id } = await params;
  const order = await prisma.esimOrder.findUnique({ where: { id }, include: orderDetailInclude });
  if (!order) notFound();
  let payload = null; try { payload = order.installation ? JSON.parse(order.installation.payload) : null; } catch { /* Invalid payload is not ready. */ }
  const installationReady = resolveReceiptDeliveryDetails(payload, order.profiles[0]?.activationCode).ready;
  const sale = order.saleCheckout ?? order.checkout;
  const blocked = Boolean(sale?.fulfillmentHold || sale?.activeOrderId && sale.activeOrderId !== id);
  const operations = await prisma.adminOperation.findMany({ where: { OR: [{ targetId: id }, { targetId: { in: order.receiptDeliveries.map(r => r.id) } }, ...(sale ? [{ payload: { path: ["saleId"], equals: sale.id } }] : [])] }, orderBy: { startedAt: "desc" }, take: 40 });
  const actions = orderActionChoices(order, operations.filter(op => ["running", "unknown", "provider_pending"].includes(op.status)).map(op => op.kind));
  return <div className="space-y-6"><OpsLink href="/admin/orders">All orders</OpsLink><PageTitle title={order.package.title} description={`Order ${order.id} · Supplier ${order.orderNumber ?? "not confirmed"}`} />
    <Panel title="Purchase and delivery"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt>Supplier status</dt><dd><Badge>{order.status}</Badge></dd></div><div><dt>Customer / receipt recipient</dt><dd className="break-all">{order.customerEmail ?? order.user?.email ?? "Not recorded"}</dd></div><div><dt>Payment</dt><dd>{order.payment ? <OpsLink href={`/admin/payments/${order.payment.id}`}>{order.payment.status} · {formatCurrencyWithCode(order.payment.amountCents, order.payment.currency)} · {order.payment.dpoMode}</OpsLink> : "No linked payment"}</dd></div><div><dt>Fulfilment</dt><dd>{sale?.fulfillmentHold ?? (blocked ? "Superseded" : "Active delivery")}{sale?.activeOrderId && sale.activeOrderId !== id ? <p><OpsLink href={`/admin/orders/${sale.activeOrderId}`}>Open active replacement</OpsLink></p> : null}</dd></div><div><dt>Installation payload</dt><dd>{sale?.intent === "top-up" ? "Top-up; no new installation required" : installationReady ? "Personalised installation details are ready" : "Missing personalised details; refresh installation or reconcile the supplier purchase"}</dd></div><div><dt>Ownership</dt><dd>{order.ownershipReviewRequired ? "Independent review required" : "No review pending"} · Account proof: {formatOpsTime(order.user?.emailProofAt)}</dd></div></dl>{order.replacementForId ? <p className="text-sm">Replacement for <OpsLink href={`/admin/orders/${order.replacementForId}`}>{order.replacementForId}</OpsLink> · No additional customer charge</p> : null}{order.profiles.map(profile => <p key={profile.id} className="text-sm">ICCID {profile.iccid} · {profile.status ?? "Unknown status"}</p>)}</Panel>
    <Panel title="Recovery and financial actions"><OperationForm targetId={id} version={order.updatedAt.toISOString()} context={`${order.id} · ${order.payment?.dpoMode ?? "unknown"} payment environment · ${order.package.operator.country.title}`} actions={actions} /></Panel>
    <Panel title="Receipt delivery">{order.receiptDeliveries.length ? order.receiptDeliveries.map(receipt => <div key={receipt.id} id={`receipt-${receipt.id}`} className="space-y-3 border-t border-brand-100 py-4 text-sm"><p><Badge>{receipt.status}</Badge> · {receipt.attempts} attempts · {receipt.lastError ?? "No delivery error"}</p><p>Next attempt: {formatOpsTime(receipt.nextAttemptAt)} · Accepted: {formatOpsTime(receipt.acceptedAt)}</p><p className="break-all">Provider message: {receipt.providerMessageId ?? "No acceptance evidence"}{receipt.acceptanceUnknown ? " · Acceptance uncertain" : ""}</p><OperationForm targetId={receipt.id} version={receipt.updatedAt.toISOString()} context={`Receipt ${receipt.id} · ${order.customerEmail ?? order.user?.email ?? "No recipient"}`} actions={receiptActionChoices(receipt, blocked)} /></div>) : <Empty>No receipt delivery queued. Purchase fulfilment and installation must complete first. Top-ups do not send a new installation receipt.</Empty>}</Panel>
    <Panel title="Supplier recovery attempts">{order.recoveryAttempts.length ? order.recoveryAttempts.map(attempt => <p key={attempt.id} className="border-t py-2 text-sm">{formatOpsTime(attempt.createdAt)} · {attempt.result} · {attempt.reason ? "Review required: supplier identity or readiness could not be established." : "No additional diagnostic"}</p>) : <Empty>No recovery attempts recorded.</Empty>}</Panel>
    <OperationsHistory operations={operations} />
  </div>;
}
