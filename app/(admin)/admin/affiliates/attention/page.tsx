import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { affiliateCommissionAttentionWhere, affiliateNotificationAttentionWhere, formatOpsTime, listParams, PAGE_SIZE } from "@/lib/admin/queries";
import { affiliateInfrastructureEnabled } from "@/lib/affiliates/referral";
import { Empty, OpsLink, PageTitle, Pagination, Panel } from "@/components/admin/OpsUI";

export default async function AffiliateAttention({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession();
  const { filter, page } = listParams(await searchParams);
  const notifications = filter === "notifications";
  if (!affiliateInfrastructureEnabled()) return <Panel title="Affiliate attention unavailable"><p>Affiliate infrastructure is disabled. Review deployment configuration before reconciliation.</p></Panel>;
  const now = new Date();
  const skip = (page - 1) * PAGE_SIZE;
  const [commissions, messages, count] = await Promise.all([
    notifications ? [] : prisma.checkoutSession.findMany({ where: affiliateCommissionAttentionWhere(now), orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take: PAGE_SIZE + 1, select: { id: true, orderId: true, affiliateId: true, createdAt: true, customerEmail: true } }),
    notifications ? prisma.affiliateNotification.findMany({ where: affiliateNotificationAttentionWhere(now), orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take: PAGE_SIZE + 1, select: { id: true, affiliateId: true, createdAt: true, subject: true } }) : [],
    notifications ? prisma.affiliateNotification.count({ where: affiliateNotificationAttentionWhere(now) }) : prisma.checkoutSession.count({ where: affiliateCommissionAttentionWhere(now) }),
  ]);
  return <div className="space-y-6"><PageTitle title="Affiliate attention" description={`${count} overdue ${notifications ? "notifications" : "commission records"} under the same rules as operational warnings.`} /><div className="flex flex-wrap gap-4"><OpsLink href="/admin/affiliates/attention?filter=commissions">Overdue commissions</OpsLink><OpsLink href="/admin/affiliates/attention?filter=notifications">Overdue notifications</OpsLink><OpsLink href="/admin/affiliates">Open affiliate reconciliation controls</OpsLink></div>
    <Panel title={notifications ? "Overdue notifications" : "Fulfilled sales awaiting commission"}>
      {!count ? <Empty>No overdue records at this check.</Empty> : notifications ? messages.slice(0, PAGE_SIZE).map(message => <div key={message.id} className="space-y-2 border-t py-3 text-sm"><p>{message.subject} · {formatOpsTime(message.createdAt)}</p><p className="break-all">{message.id}</p><OpsLink href={`/admin/affiliates?guide=${message.affiliateId}`}>Review guide and reconciliation</OpsLink></div>) : commissions.slice(0, PAGE_SIZE).map(sale => <div key={sale.id} className="space-y-2 border-t py-3 text-sm"><p>{sale.customerEmail ?? "No customer email"} · {formatOpsTime(sale.createdAt)}</p><div className="flex flex-wrap gap-4"><OpsLink href={`/admin/payments?q=${sale.id}`}>Payment evidence</OpsLink>{sale.orderId ? <OpsLink href={`/admin/orders/${sale.orderId}`}>Order and fulfilment</OpsLink> : null}<OpsLink href={`/admin/affiliates?guide=${sale.affiliateId}`}>Guide and reconciliation</OpsLink></div></div>)}
      <Pagination path="/admin/affiliates/attention" page={page} q="" filter={notifications ? "notifications" : "commissions"} hasNext={(notifications ? messages.length : commissions.length) > PAGE_SIZE} />
    </Panel></div>;
}
