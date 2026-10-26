import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { formatCurrencyWithCode } from "@/lib/format";
import { DpoGatewayControl } from "@/components/admin/DpoGatewayControl";
import { getActiveDpoMode } from "@/lib/payments/dpo-settings";
import { getDpoCredentialStatus } from "@/lib/payments/dpo";
import { SimpleLineChart } from "@/components/admin/SimpleLineChart";
import { OpsLink, PageTitle, Panel } from "@/components/admin/OpsUI";
import { countFulfilledSales } from "@/lib/admin/reporting";

function reportingStart(days: number) { return new Date(Date.now() - days * 86400000); }

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession(); const params = await searchParams;
  const currency = typeof params.currency === "string" && /^[A-Z]{3}$/.test(params.currency) ? params.currency : "NAD";
  const range = params.range === "7d" ? "7d" : "30d"; const from = reportingStart(range === "7d" ? 7 : 30);
  const mode = params.mode === "test" ? "test" : "live";
  const [gross, refunds, legacyRefunds, fulfilled, daily, currencies, activeMode] = await Promise.all([
    prisma.paymentTransaction.aggregate({ where: { status: "approved", dpoMode: mode, currency, approvedAt: { gte: from } }, _sum: { amountCents: true }, _count: true }),
    prisma.paymentRefund.aggregate({ where: { status: "confirmed", currency, confirmedAt: { gte: from }, payment: { dpoMode: mode } }, _sum: { amountCents: true } }),
    prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COALESCE(sum(a."saleRefundCents"),0)::bigint AS total FROM "AffiliateSaleAdjustment" a JOIN "CheckoutSession" c ON c.id=a."checkoutId" WHERE a."createdAt">=${from} AND c.currency=${currency} AND EXISTS (SELECT 1 FROM "PaymentTransaction" p WHERE p."checkoutId"=c.id AND p.status='approved' AND p."dpoMode"::text=${mode}) AND NOT EXISTS (SELECT 1 FROM "PaymentRefund" r JOIN "PaymentTransaction" rp ON rp.id=r."paymentId" WHERE r.reference=a.reference AND rp."checkoutId"=c.id)`,
    countFulfilledSales(prisma, { from, currency, mode }),
    prisma.$queryRaw<Array<{ label: string; value: bigint }>>`SELECT to_char("approvedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Windhoek','YYYY-MM-DD') AS label, sum("amountCents")::bigint AS value FROM "PaymentTransaction" WHERE status='approved' AND "dpoMode"::text=${mode} AND currency=${currency} AND "approvedAt">=${from} GROUP BY 1 ORDER BY 1`,
    prisma.paymentTransaction.findMany({ distinct: ["currency"], select: { currency: true } }), getActiveDpoMode(),
  ]);
  const captured = gross._sum.amountCents ?? 0; const refunded = (refunds._sum.amountCents ?? 0) + Number(legacyRefunds[0]?.total ?? 0);
  return <div className="space-y-6"><PageTitle title="Performance overview" description="Approved payments, refunds, and fulfilled sales are reported separately. Amounts stay in their original currency; test payments are excluded by default." /><div className="flex flex-wrap gap-4 text-sm"><OpsLink href="/admin/operations">Open operations inbox</OpsLink><OpsLink href="/admin/payments?filter=attention">Payments needing attention</OpsLink><OpsLink href="/admin/health">System health</OpsLink></div><form className="flex flex-wrap items-end gap-3"><label className="text-sm">Period<select name="range" defaultValue={range} className="ml-2 min-h-11 rounded-lg border bg-white p-2"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label><label className="text-sm">Currency<select name="currency" defaultValue={currency} className="ml-2 min-h-11 rounded-lg border bg-white p-2">{Array.from(new Set(["NAD", ...currencies.map(row => row.currency)])).map(code => <option key={code}>{code}</option>)}</select></label><label className="text-sm">Environment<select name="mode" defaultValue={mode} className="ml-2 min-h-11 rounded-lg border bg-white p-2"><option value="live">Live</option><option value="test">Test</option></select></label><button className="min-h-11 rounded-full bg-brand-900 px-4 py-2 text-white">Apply</button></form><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Gross approved payments", formatCurrencyWithCode(captured, currency)], ["Confirmed refunds", formatCurrencyWithCode(refunded, currency)], ["Net receipts", formatCurrencyWithCode(captured - refunded, currency)], ["Fulfilled sales", String(fulfilled)]].map(([label, value]) => <Panel key={label} title={label}><p className="text-2xl font-semibold">{value}</p></Panel>)}</div><Panel title="Approved payments over time"><div className="h-64"><SimpleLineChart points={daily.map(row => ({ label: row.label, value: Number(row.value) }))} /></div><p className="mt-3 text-xs text-slate-600">{gross._count} approved payments in the selected period. Refunds use confirmation dates, so net receipts can be negative when refunding older purchases. Fulfilled sales count current verified delivery once per sale with a payment approved in this period, including non-affiliate and subsequently refunded sales. Historical records without an approval timestamp require evidence backfill before inclusion.</p></Panel><DpoGatewayControl activeMode={activeMode} configured={getDpoCredentialStatus()} /></div>;
}
