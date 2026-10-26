import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { listParams, paymentAttentionWhere, paymentSearch, PAGE_SIZE, formatOpsTime } from "@/lib/admin/queries";
import { formatCurrencyWithCode } from "@/lib/format";
import { Badge, Empty, OpsLink, PageTitle, Pagination, Panel } from "@/components/admin/OpsUI";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession();
  const { q, filter, page } = listParams(await searchParams);
  const where = { AND: [paymentSearch(q), filter === "attention" ? paymentAttentionWhere() : {}] };
  const [payments, count] = await Promise.all([
    prisma.paymentTransaction.findMany({ where, include: { checkout: { select: { customerEmail: true, fulfillmentHold: true, activeOrderId: true, orderId: true } }, refunds: { select: { amountCents: true, status: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.paymentTransaction.count({ where }),
  ]);
  return <div className="space-y-6"><PageTitle title="Payments" description="Investigate transactions, reconcile provider evidence, and manage financial actions in the original currency." />
    <form className="flex flex-wrap gap-3"><label className="min-w-48 flex-1 text-sm font-medium">Search<input name="q" defaultValue={q} placeholder="Email, checkout, payment, supplier reference or ICCID" className="mt-1 block min-h-11 w-full rounded-xl border bg-white p-3" /></label><label className="text-sm font-medium">Queue<select name="filter" defaultValue={filter} className="mt-1 block min-h-11 rounded-xl border bg-white p-3"><option value="">All payments</option><option value="attention">Unresolved over 15 minutes</option></select></label><button className="self-end rounded-full bg-brand-900 px-5 py-3 font-semibold text-white">Search</button></form>
    <Panel title={`${count} matching payments`}>{payments.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3 pr-4">Payment / customer</th><th className="pr-4">Amount</th><th className="pr-4">State</th><th>Created</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id} className="border-b border-brand-100 align-top"><td className="py-4 pr-4"><OpsLink href={`/admin/payments/${payment.id}`}>{payment.providerReference ?? payment.id}</OpsLink><p className="mt-1 break-all text-xs text-slate-600">{payment.checkout?.customerEmail ?? "No checkout email"}</p><p className="mt-1 text-xs">{payment.dpoMode ?? "Environment unknown"}</p></td><td className="py-4 pr-4 whitespace-nowrap">{formatCurrencyWithCode(payment.amountCents, payment.currency)}</td><td className="py-4 pr-4"><Badge>{payment.status}</Badge>{payment.checkout?.fulfillmentHold ? <p className="mt-1 text-xs">Fulfilment: {payment.checkout.fulfillmentHold}</p> : null}</td><td className="py-4 whitespace-nowrap text-xs">{formatOpsTime(payment.createdAt)}</td></tr>)}</tbody></table></div> : <Empty />}</Panel>
    <Pagination page={page} hasNext={page * PAGE_SIZE < count} path="/admin/payments" q={q} filter={filter} />
  </div>;
}
