import { KpiCard } from "@/components/admin/KpiCard";
import { SimpleBarChart } from "@/components/admin/SimpleBarChart";
import { SimpleLineChart } from "@/components/admin/SimpleLineChart";
import prisma from "@/lib/db/client";
import { formatCurrency } from "@/lib/format";

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

export default async function AdminDashboard({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const rangeKey = typeof searchParams?.range === "string" ? searchParams?.range : "30d";
  const rangeStart = dateRangeFromParams(rangeKey);

  const orders = await prisma.esimOrder.findMany({
    where: { createdAt: { gte: rangeStart } },
    include: { package: true },
  });

  const packages = await prisma.airaloPackage.findMany();
  const totalRevenue = orders.reduce((sum, order) => {
    const selling = order.totalCents ?? (order.package?.sellingPriceCents ?? order.package?.priceCents ?? 0) * order.quantity;
    return sum + selling;
  }, 0);
  const totalCost = orders.reduce((sum, order) => {
    const base = (order.package?.priceCents ?? 0) * order.quantity;
    return sum + base;
  }, 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders === 0 ? 0 : totalRevenue / totalOrders;

  const revenueByDate = orders.reduce<Record<string, number>>((acc, order) => {
    const key = order.createdAt.toISOString().slice(0, 10);
    const amount = order.totalCents ?? (order.package?.sellingPriceCents ?? order.package?.priceCents ?? 0) * order.quantity;
    acc[key] = (acc[key] ?? 0) + amount;
    return acc;
  }, {});

  const linePoints = Object.entries(revenueByDate)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, value]) => ({ label: date, value }));

  const revenueByCountry = orders.reduce<Record<string, number>>((acc, order) => {
    const country = order.package?.country ?? "Unknown";
    const amount = order.totalCents ?? (order.package?.sellingPriceCents ?? order.package?.priceCents ?? 0) * order.quantity;
    acc[country] = (acc[country] ?? 0) + amount;
    return acc;
  }, {});

  const countryBars = Object.entries(revenueByCountry)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  const revenueByPackage = orders.reduce<Record<string, { name: string; value: number }>>((acc, order) => {
    const pkg = order.package;
    if (!pkg) return acc;
    const amount = order.totalCents ?? (pkg.sellingPriceCents ?? pkg.priceCents ?? 0) * order.quantity;
    const key = pkg.id;
    const name = pkg.name;
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Sales & Analytics</p>
          <h1 className="text-3xl font-bold text-slate-900">Performance overview</h1>
          <p className="text-sm text-slate-600">Aggregated from Airalo-powered eSIM orders.</p>
        </div>
        <form method="get" className="flex items-center gap-3 text-sm text-slate-700">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            Range
            <select name="range" defaultValue={rangeKey} className="bg-transparent text-sm focus:outline-none">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white shadow-sm">
            Apply
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total revenue" value={formatCurrency(totalRevenue, "USD")} helper={`Across ${packages.length} packages`} />
        <KpiCard label="Total profit" value={formatCurrency(totalRevenue - totalCost, "USD")} helper="Selling - wholesale" tone="success" />
        <KpiCard label="Total orders" value={`${totalOrders}`} helper={rangeKey === "7d" ? "Last 7 days" : "Last 30 days"} />
        <KpiCard label="Average order value" value={formatCurrency(Math.round(averageOrderValue), "USD")} helper="Blended" />
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
