import Link from "next/link";
import { Prisma } from "@prisma/client";
import { StatusBadge } from "@/components/admin/StatusBadge";
import prisma from "@/lib/db/client";
import { formatCurrency, formatDate } from "@/lib/format";

function buildWhere(searchParams: Record<string, string | string[] | undefined>) {
  const { q, region, country, status } = searchParams;
  const where: Prisma.AiraloPackageWhereInput = {};

  if (typeof q === "string" && q.length > 0) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { externalId: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
      { region: { contains: q, mode: "insensitive" } },
    ];
  }

  if (typeof region === "string" && region.length > 0) {
    where.region = { equals: region };
  }

  if (typeof country === "string" && country.length > 0) {
    where.country = { equals: country };
  }

  if (typeof status === "string") {
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
  }

  return where;
}

function margin(base?: number | null, selling?: number | null) {
  if (!base || !selling) return 0;
  const diff = selling - base;
  return Math.round((diff / base) * 100);
}

export default async function PackagesPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const page = Number(searchParams.page ?? 1) || 1;
  const take = 15;
  const skip = (page - 1) * take;
  const where = buildWhere(searchParams);

  const [packages, total] = await Promise.all([
    prisma.airaloPackage.findMany({
      where,
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take,
      skip,
    }),
    prisma.airaloPackage.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  const regions = await prisma.airaloPackage.groupBy({ by: ["region"], where, _count: true });
  const countries = await prisma.airaloPackage.groupBy({ by: ["country"], where, _count: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Packages</p>
          <h1 className="text-3xl font-bold text-slate-900">Airalo catalog</h1>
          <p className="text-sm text-slate-600">Search, filter, and manage eSIM SKUs.</p>
        </div>
        <Link
          href="/admin/sync"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          Go to Sync Center
        </Link>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <input
          type="text"
          name="q"
          placeholder="Search by name, country, region, ID"
          defaultValue={typeof searchParams.q === "string" ? searchParams.q : ""}
          className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        />
        <select
          name="region"
          defaultValue={typeof searchParams.region === "string" ? searchParams.region : ""}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        >
          <option value="">All regions</option>
          {regions
            .filter((r) => r.region)
            .map((r) => (
              <option key={r.region} value={r.region ?? ""}>
                {r.region}
              </option>
            ))}
        </select>
        <select
          name="country"
          defaultValue={typeof searchParams.country === "string" ? searchParams.country : ""}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        >
          <option value="">All countries</option>
          {countries
            .filter((r) => r.country)
            .map((r) => (
              <option key={r.country} value={r.country ?? ""}>
                {r.country}
              </option>
            ))}
        </select>
        <select
          name="status"
          defaultValue={typeof searchParams.status === "string" ? searchParams.status : ""}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          Apply
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Country</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Region</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Data</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Validity</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Base price</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Selling price</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Margin</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Last synced</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/packages/${pkg.id}`} className="font-semibold text-teal-700 hover:underline">
                    {pkg.name}
                  </Link>
                  <p className="text-xs text-slate-500">{pkg.externalId}</p>
                </td>
                <td className="px-4 py-3">{pkg.country ?? "-"}</td>
                <td className="px-4 py-3">{pkg.region ?? "-"}</td>
                <td className="px-4 py-3">{pkg.dataLimitMb ? `${Math.round(pkg.dataLimitMb / 1000)} GB` : "-"}</td>
                <td className="px-4 py-3">{pkg.validityDays ? `${pkg.validityDays} days` : "-"}</td>
                <td className="px-4 py-3">{formatCurrency(pkg.priceCents, pkg.currency)}</td>
                <td className="px-4 py-3">
                  {pkg.sellingPriceCents ? formatCurrency(pkg.sellingPriceCents, pkg.currency) : "—"}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">{margin(pkg.priceCents, pkg.sellingPriceCents)}%</td>
                <td className="px-4 py-3">{pkg.lastSyncedAt ? formatDate(pkg.lastSyncedAt) : "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge active={pkg.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-700">
        <p>
          Showing {(skip + 1).toLocaleString()} – {Math.min(skip + take, total).toLocaleString()} of {total.toLocaleString()} packages
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`?page=${Math.max(1, page - 1)}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm disabled:opacity-50"
            aria-disabled={page <= 1}
          >
            Previous
          </Link>
          <span>
            Page {page} / {totalPages}
          </span>
          <Link
            href={`?page=${Math.min(totalPages, page + 1)}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm disabled:opacity-50"
            aria-disabled={page >= totalPages}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
