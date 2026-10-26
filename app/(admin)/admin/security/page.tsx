import { requireAdminSession } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { Empty, OpsLink, PageTitle, Panel } from "@/components/admin/OpsUI";
import { revokeAllAdminSessions } from "./actions";

export default async function SecurityOperationsPage() {
  await requireAdminSession();
  const [receipts, ownership] = await Promise.all([prisma.receiptDelivery.count({ where: { status: "review" } }), prisma.esimOrder.count({ where: { ownershipReviewRequired: true } })]);
  return <div className="space-y-6"><PageTitle title="Security and delivery review" description="Review ownership evidence and delivery outcomes in the context of the affected purchase." /><Panel title="Review queues"><p className="text-sm"><OpsLink href="/admin/receipts?filter=attention">Receipt review and delivery attention</OpsLink> · {receipts} receipts awaiting review</p><p className="text-sm"><OpsLink href="/admin/orders?filter=ownership">Historical ownership review</OpsLink> · {ownership} orders</p><p className="text-sm"><OpsLink href="/admin/payments?filter=attention">Payment reconciliation</OpsLink></p>{!receipts && !ownership ? <Empty>No ownership or receipt review records currently pending.</Empty> : null}</Panel><Panel title="Administrator session revocation"><p className="text-sm">Revoke every administrator session, including your current session. The shared account remains the audit identity.</p><form action={revokeAllAdminSessions} className="space-y-3"><label className="block text-sm">Administrator password<input name="password" type="password" autoComplete="current-password" required maxLength={1024} className="mt-1 block min-h-11 w-full rounded-lg border p-2" /></label><label className="flex gap-2 text-sm"><input name="confirmation" type="checkbox" required />I confirm all administrators will need to sign in again.</label><button className="min-h-11 rounded-full bg-rose-800 px-5 py-2 text-white">Revoke all administrator sessions</button></form></Panel></div>;
}
