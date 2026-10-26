import Link from "next/link";
import prisma from "@/lib/db/client";
import { formatCurrencyWithCode } from "@/lib/format";
import { resolveRetailPrices } from "@/lib/catalog/retail-prices";
import { formatOpsTime } from "@/lib/admin/queries";

const PAGE_SIZE = 20;

export default async function AdminPackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const cursor = typeof resolvedSearchParams.cursor === "string" ? resolvedSearchParams.cursor : undefined;

  const packages = await prisma.package.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { airaloPackageId: { contains: q, mode: "insensitive" } },
            { operator: { is: { title: { contains: q, mode: "insensitive" } } } },
            {
              operator: {
                is: {
                  country: { is: { title: { contains: q, mode: "insensitive" } } },
                },
              },
            },
          ],
        }
      : undefined,
    include: {
      operator: {
        select: {
          title: true,
          country: { select: { title: true } },
        },
      },
      state: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasNext = packages.length > PAGE_SIZE;
  const rows = hasNext ? packages.slice(0, PAGE_SIZE) : packages;
  const nextCursor = hasNext ? rows[rows.length - 1].id : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Supplier catalogue</h1>
      <form className="flex gap-2">
        <input defaultValue={q} name="q" placeholder="Search package/operator/country" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
        <button className="button-ribbon-primary rounded-full px-3 py-2 text-sm font-semibold">Search</button>
      </form>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Package</th><th className="px-3 py-2 text-left">Operator / Country</th><th className="px-3 py-2 text-left">Checkout price</th><th className="px-3 py-2 text-left">Availability</th><th className="px-3 py-2 text-left">Last synced</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pkg) => {
              const prices = resolveRetailPrices(pkg.pricesRecommendedRetailPrice);
              const source = prices?.NAD ? formatCurrencyWithCode(prices.NAD, "NAD") : "Unavailable";
              return (
                <tr key={pkg.id} className="border-t border-slate-100">
                  <td className="px-3 py-2"><Link href={`/admin/packages/${pkg.id}`} className="text-brand-700 underline">{pkg.title}</Link><p className="text-xs text-slate-500">{pkg.airaloPackageId}</p></td>
                  <td className="px-3 py-2">{pkg.operator.title} / {pkg.operator.country.title}</td>
                  <td className="px-3 py-2">{source}</td>
                  <td className="px-3 py-2">{pkg.state?.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2">{pkg.state?.lastSyncedAt ? formatOpsTime(pkg.state.lastSyncedAt) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nextCursor ? <Link href={`/admin/packages?${new URLSearchParams({ ...(q ? { q } : {}), cursor: nextCursor }).toString()}`} className="text-sm text-brand-700 underline">Next page →</Link> : null}
    </div>
  );
}
