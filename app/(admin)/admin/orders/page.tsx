import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { listParams, orderSearch, PAGE_SIZE, receiptAttentionWhere, supplierAttentionWhere, formatOpsTime } from "@/lib/admin/queries";
import { Badge, Empty, OpsLink, PageTitle, Pagination, Panel } from "@/components/admin/OpsUI";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession(); const { q, filter, page } = listParams(await searchParams);
  const queue: Prisma.EsimOrderWhereInput = filter === "receipts" ? { receiptDeliveries: { some: receiptAttentionWhere() } } : filter === "supplier" ? supplierAttentionWhere() : filter === "ownership" ? { ownershipReviewRequired: true } : {};
  const where = { AND: [orderSearch(q), queue] };
  const [orders, count] = await Promise.all([
    prisma.esimOrder.findMany({ where, select: { id: true, orderNumber: true, customerEmail: true, status: true, createdAt: true, replacementForId: true, package: { select: { title: true } }, payment: { select: { status: true } }, receiptDeliveries: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 } }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }), prisma.esimOrder.count({ where }),
  ]);
  return <div className="space-y-6"><PageTitle title="Orders and delivery" description="Follow each purchase from payment through supplier fulfilment, installation readiness, and receipt acceptance." />
    <form className="flex flex-wrap gap-3"><label className="min-w-48 flex-1 text-sm font-medium">Search<input name="q" defaultValue={q} placeholder="Email, order, checkout, payment, supplier reference or ICCID" className="mt-1 block min-h-11 w-full rounded-xl border bg-white p-3" /></label><label className="text-sm font-medium">Queue<select name="filter" defaultValue={filter} className="mt-1 block min-h-11 rounded-xl border bg-white p-3"><option value="">All orders</option><option value="receipts">Receipt attention</option><option value="supplier">Supplier attention</option><option value="ownership">Ownership review</option></select></label><button className="self-end rounded-full bg-brand-900 px-5 py-3 font-semibold text-white">Search</button></form>
    <Panel title={`${count} matching orders`}>{orders.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3 pr-4">Order / customer</th><th className="pr-4">Package</th><th className="pr-4">Progress</th><th>Created</th></tr></thead><tbody>{orders.map(order => <tr key={order.id} className="border-b border-brand-100 align-top"><td className="py-4 pr-4"><OpsLink href={`/admin/orders/${order.id}`}>{order.orderNumber ?? order.id}</OpsLink><p className="mt-1 break-all text-xs text-slate-600">{order.customerEmail ?? "No email recorded"}</p>{order.replacementForId ? <p className="text-xs">Replacement</p> : null}</td><td className="py-4 pr-4">{order.package.title}</td><td className="space-y-1 py-4 pr-4"><Badge>{order.status}</Badge><p className="text-xs">Payment: {order.payment?.status ?? "Not linked"}</p><p className="text-xs">Receipt: {order.receiptDeliveries[0]?.status ?? "Not queued"}</p></td><td className="py-4 whitespace-nowrap text-xs">{formatOpsTime(order.createdAt)}</td></tr>)}</tbody></table></div> : <Empty />}</Panel><Pagination page={page} hasNext={page * PAGE_SIZE < count} path="/admin/orders" q={q} filter={filter} />
  </div>;
}
