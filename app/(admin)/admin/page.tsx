import { KpiCard } from "@/components/admin/KpiCard";
import type { Prisma } from "@prisma/client";
import { SimpleBarChart } from "@/components/admin/SimpleBarChart";
import { SimpleLineChart } from "@/components/admin/SimpleLineChart";
import { RunSanitySyncButton } from "@/components/admin/RunSanitySyncButton";
import { DpoGatewayControl } from "@/components/admin/DpoGatewayControl";
import prisma from "@/lib/db/client";
import { formatCurrency } from "@/lib/format";
import { supplierCostCents } from "@/lib/affiliates/queries";
import { getCatalogMismatches } from "@/lib/catalog/mismatches";
import { getActiveDpoMode } from "@/lib/payments/dpo-settings";
import { getDpoCredentialStatus } from "@/lib/payments/dpo";

function dateRangeFromParams(range?: string) {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

export default async function AdminDashboard({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const resolvedSearchParams = await searchParams;
  const rangeKey = typeof resolvedSearchParams?.range === "string" ? resolvedSearchParams.range : "30d";
  const rangeStart = dateRangeFromParams(rangeKey);

  const [mismatches, dpoMode] = await Promise.all([getCatalogMismatches(), getActiveDpoMode()]);

  const allOrders = await prisma.esimOrder.findMany({
    where: { createdAt: { gte: rangeStart } },
    select: {
      id: true,
      packageId: true,
      quantity: true,
      totalCents: true,
      currency: true,
      createdAt: true,
    },
  });

  const currencies = Array.from(new Set(allOrders.map(order => order.currency ?? "USD"))).sort();
  const requestedCurrency = typeof resolvedSearchParams?.currency === "string" ? resolvedSearchParams.currency : "NAD";
  const currencyCode = /^[A-Z]{3}$/.test(requestedCurrency) ? requestedCurrency : "NAD";
  const orders = allOrders.filter(order => (order.currency ?? "USD") === currencyCode);

  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const packageIds = Array.from(new Set(orders.map((order) => order.packageId).filter(Boolean)));
  const packageUuidIds = packageIds.filter((id) => uuidRegex.test(id));
  const packageExternalIds = packageIds.filter((id) => !uuidRegex.test(id));

  const packages = packageIds.length
    ? await prisma.package.findMany({
        where: {
          OR: [
            packageUuidIds.length ? { id: { in: packageUuidIds } } : undefined,
            packageExternalIds.length ? { airaloPackageId: { in: packageExternalIds } } : undefined,
          ].filter(Boolean) as Prisma.PackageWhereInput[],
        },
        include: {
          operator: { include: { country: true } },
          state: true,
        },
      })
    : [];

  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));
  const packageByExternalId = new Map(packages.map((pkg) => [pkg.airaloPackageId, pkg]));
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalCents ?? 0), 0);
  let missingCosts = 0;
  const totalCost = orders.reduce((sum, order) => {
    const pkg = packageById.get(order.packageId) ?? packageByExternalId.get(order.packageId);
    const cost = supplierCostCents(pkg?.pricesNetPrice, currencyCode === "NAD" ? "ZAR" : currencyCode)
      ?? (pkg?.state?.currencyCode === currencyCode ? pkg.state.basePriceCents : null);
    if (cost === null) { missingCosts++; return sum; }
    return sum + cost * order.quantity;
  }, 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders === 0 ? 0 : totalRevenue / totalOrders;

  const revenueByDate = orders.reduce<Record<string, number>>((acc, order) => {
    const key = order.createdAt.toISOString().slice(0, 10);
    acc[key] = (acc[key] ?? 0) + (order.totalCents ?? 0);
    return acc;
  }, {});

  const linePoints = Object.entries(revenueByDate)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, value]) => ({ label: date, value }));

  const revenueByCountry = orders.reduce<Record<string, number>>((acc, order) => {
    const pkg = packageById.get(order.packageId) ?? packageByExternalId.get(order.packageId);
    const country = pkg?.operator?.country?.title ?? "Unknown";
    const amount = order.totalCents ?? 0;
    acc[country] = (acc[country] ?? 0) + amount;
    return acc;
  }, {});

  const countryBars = Object.entries(revenueByCountry)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  const revenueByPackage = orders.reduce<Record<string, { name: string; value: number }>>((acc, order) => {
    const pkg = packageById.get(order.packageId) ?? packageByExternalId.get(order.packageId);
    if (!pkg) return acc;
    const amount = order.totalCents ?? 0;
    const key = pkg.id;
    const name = pkg.title;
    acc[key] = { name, value: (acc[key]?.value ?? 0) + amount };
    return acc;
  }, {});

  const topPackages = Object.values(revenueByPackage)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((item) => ({ label: item.name.slice(0, 20), value: item.value }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Sales & Analytics</p>
          <h1 className="text-3xl font-bold text-slate-900">Performance overview</h1>
          <p className="text-sm text-slate-600">Amounts shown in {currencyCode}. Historical currencies are reported separately.</p>
        </div>
        <form method="get" className="flex items-center gap-3 text-sm text-slate-700">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            Range
            <select name="range" defaultValue={rangeKey} className="bg-transparent text-sm focus:outline-none">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <label>Currency <select name="currency" defaultValue={currencyCode} className="rounded border border-slate-200 p-2">{Array.from(new Set(["NAD", ...currencies])).map(code => <option key={code} value={code}>{code}</option>)}</select></label>
          <button type="submit" className="button-ribbon-primary rounded-full px-4 py-2 font-semibold">
            Apply
          </button>
        </form>
      </div>

      <DpoGatewayControl activeMode={dpoMode} configured={getDpoCredentialStatus()} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Catalog publish</p>
        <p className="text-sm text-slate-600">
          Trigger manual database to Sanity sync from the dashboard.
        </p>
        <div className="mt-3">
          <RunSanitySyncButton />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total revenue" value={formatCurrency(totalRevenue, currencyCode)} helper={`Across ${packages.length} packages`} />
        <KpiCard label="Total profit" value={missingCosts ? "Unavailable" : formatCurrency(totalRevenue - totalCost, currencyCode)} helper="Estimated from current same-currency supplier prices" tone="success" />
        <KpiCard label="Total orders" value={`${totalOrders}`} helper={rangeKey === "7d" ? "Last 7 days" : "Last 30 days"} />
        <KpiCard label="Average order value" value={formatCurrency(Math.round(averageOrderValue), currencyCode)} helper={currencyCode} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Catalog mismatches</h3>
            <p className="text-sm text-slate-600">
              Products missing a live DB package or mapped to inactive packages.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mismatches.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {mismatches.length ? `${mismatches.length} issues` : "All clear"}
          </span>
        </div>
        {mismatches.length ? (
          <div className="mt-4 space-y-3 text-sm">
            {mismatches.slice(0, 8).map((entry) => (
              <div key={entry.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <p className="font-semibold text-slate-900">{entry.productName}</p>
                  <p className="text-xs text-slate-500">
                    package={entry.packageExternalId ?? "none"} • {entry.reason.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {entry.packageUpdatedAt ? `db updated ${entry.packageUpdatedAt.toISOString().slice(0, 10)}` : "no db record"}
                </div>
              </div>
            ))}
            {mismatches.length > 8 ? (
              <p className="text-xs text-slate-500">Showing 8 of {mismatches.length}. Fix the package references in Sanity.</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No mismatches detected.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Revenue over time</h3>
              <p className="text-sm text-slate-600">Daily totals for the selected range.</p>
            </div>
          </div>
          <div className="mt-4 h-64">
            <SimpleLineChart points={linePoints} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Sales by country</h3>
          <p className="text-sm text-slate-600">Top destinations by revenue.</p>
          <div className="mt-4 h-64">
            <SimpleBarChart bars={countryBars} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Top packages by revenue</h3>
            <p className="text-sm text-slate-600">Cross-region winners.</p>
          </div>
        </div>
        <div className="mt-4 h-64">
          <SimpleBarChart bars={topPackages} />
        </div>
      </div>
    </div>
  );
}
