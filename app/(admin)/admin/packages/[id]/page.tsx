import { notFound } from "next/navigation";
import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { formatCurrencyWithCode } from "@/lib/format";
import { resolveRetailPrices, isCatalogPriceFresh } from "@/lib/catalog/retail-prices";
import { formatOpsTime } from "@/lib/admin/queries";
import { Badge, OpsLink, PageTitle, Panel } from "@/components/admin/OpsUI";
import { updateStatus } from "./actions";

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession(); const { id } = await params;
  const pkg = await prisma.package.findUnique({ where: { id }, include: { operator: { include: { country: true } }, state: true } });
  if (!pkg) notFound(); const prices = resolveRetailPrices(pkg.pricesRecommendedRetailPrice); const active = pkg.state?.isActive === true;
  return <div className="space-y-6"><OpsLink href="/admin/packages">All packages</OpsLink><PageTitle title={pkg.title} description={`${pkg.airaloPackageId} · ${pkg.operator.country.title} · ${pkg.operator.title}`} /><Panel title="Supplier retail prices"><p className="text-sm">Storefront prices and checkout quotes use the supplier retail map. New payments use the ZAR amount as NAD at 1:1. Historical purchases keep their original amounts.</p><div className="flex flex-wrap gap-3">{prices ? Object.entries(prices).map(([currency, cents]) => <Badge key={currency}>{formatCurrencyWithCode(cents!, currency)}</Badge>) : <p className="text-rose-800">No valid ZAR retail price; checkout is unavailable.</p>}</div><p className="text-sm">Last synced: {formatOpsTime(pkg.state?.lastSyncedAt)} · {isCatalogPriceFresh(pkg.state?.lastSyncedAt) ? "Fresh" : "Stale; refresh the catalogue"}</p><OpsLink href="/admin/sync">Open Sync Center</OpsLink></Panel><Panel title="Availability"><p className="text-sm">Current state: <Badge>{active ? "Active" : "Inactive"}</Badge></p><form className="space-y-3" action={async form => { "use server"; await updateStatus(pkg.id, !active, String(form.get("reason") ?? "")); }}><label className="block text-sm">Reason<input name="reason" required minLength={5} maxLength={500} className="mt-1 block min-h-11 w-full rounded-xl border p-3" /></label><button className="min-h-11 rounded-full bg-brand-900 px-5 py-2 text-white">{active ? "Deactivate package" : "Activate package"}</button></form><p className="text-xs text-slate-600">Activation also requires a fresh catalogue and valid retail pricing before a package can be purchased.</p></Panel><Panel title="Related purchases"><OpsLink href={`/admin/orders?q=${encodeURIComponent(pkg.airaloPackageId)}`}>Find related orders</OpsLink></Panel></div>;
}
