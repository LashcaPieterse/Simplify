import { requireAdminSession } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { revokeAllAdminSessions, resolveReceipt, resolveOwnership } from "./actions";

export default async function SecurityOperationsPage() {
  await requireAdminSession();
  const [receipts, orders, jobs] = await Promise.all([
    prisma.receiptDelivery.findMany({ where: { status: "review" }, take: 50, orderBy: { createdAt: "asc" } }),
    prisma.esimOrder.findMany({ where: { ownershipReviewRequired: true }, take: 50, orderBy: { createdAt: "asc" } }),
    prisma.lifecycleJob.findMany({ where: { status: "review" }, take: 50, orderBy: { createdAt: "asc" } }),
  ]);
  return <div className="space-y-8"><h1 className="text-3xl font-bold">Security and delivery review</h1>
    <form action={revokeAllAdminSessions}><button className="rounded bg-red-800 px-4 py-2 text-white">Revoke all administrator sessions</button></form>
    <section><h2 className="text-xl font-bold">Receipts needing review</h2>{receipts.map(job => <form key={job.id} action={resolveReceipt} className="my-4 grid gap-3 rounded border p-4"><p>Order {job.orderId} · {job.lastError}</p><input type="hidden" name="id" value={job.id} /><label>Reason<input name="reason" required maxLength={500} className="block border p-2" /></label><label>Provider message ID (required to confirm acceptance)<input name="providerMessageId" maxLength={200} className="block border p-2" /></label><div className="flex gap-4"><button name="action" value="confirm">Confirm accepted</button><button name="action" value="resend">Explicitly resend</button></div></form>)}</section>
    <section><h2 className="text-xl font-bold">Historical ownership</h2>{orders.map(order => <form key={order.id} action={resolveOwnership} className="my-4 grid gap-3 rounded border p-4"><p>Order {order.id}</p><input type="hidden" name="orderId" value={order.id} /><label>Evidence and reason<input name="reason" required maxLength={500} className="block border p-2" /></label><label><input type="checkbox" name="evidenceConfirmed" required /> I independently confirmed ownership</label><button>Restore existing owner access</button></form>)}</section>
    <section><h2 className="text-xl font-bold">Purchase reconciliation</h2>{jobs.map(job => <p key={job.id}>{job.kind} · {job.targetId} · {job.lastError}. Reconcile the existing payment or supplier purchase; do not resubmit blindly.</p>)}</section>
  </div>;
}
