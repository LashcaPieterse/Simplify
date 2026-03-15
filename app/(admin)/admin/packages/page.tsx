import Link from "next/link";
import prisma from "@/lib/db/client";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

export default async function AdminPackagesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const cursor = typeof searchParams.cursor === "string" ? searchParams.cursor : undefined;

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

  const states = await prisma.publishingState.findMany({
    where: { packageAiraloId: { in: rows.map((row) => row.airaloPackageId) } },
  });
  const statesByPackage = new Map(states.map((item) => [item.packageAiraloId, item]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Packages pricing integrity</h1>
      <form className="flex gap-2">
        <input defaultValue={q} name="q" placeholder="Search package/operator/country" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
        <button className="rounded bg-teal-600 px-3 py-2 text-sm text-white">Search</button>
      </form>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Package</th><th className="px-3 py-2 text-left">Operator / Country</th><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-left">DB</th><th className="px-3 py-2 text-left">Published</th><th className="px-3 py-2 text-left">Last synced</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pkg) => {
              const state = statesByPackage.get(pkg.airaloPackageId);
              const currency = pkg.state?.currencyCode ?? "USD";
              const source = pkg.state?.sourcePriceDecimal?.toString() ?? pkg.netPrice?.toString() ?? "-";
              const dbPrice =
                pkg.state?.sellPriceDecimal?.toString() ??
                (typeof pkg.state?.sellingPriceCents === "number"
                  ? (pkg.state.sellingPriceCents / 100).toFixed(2)
                  : "-");
              return (
                <tr key={pkg.id} className="border-t border-slate-100">
                  <td className="px-3 py-2"><Link href={`/admin/packages/${pkg.id}`} className="text-teal-700 underline">{pkg.title}</Link><p className="text-xs text-slate-500">{pkg.airaloPackageId}</p></td>
                  <td className="px-3 py-2">{pkg.operator.title} / {pkg.operator.country.title}</td>
                  <td className="px-3 py-2">{source} {currency}</td>
                  <td className="px-3 py-2">{dbPrice} {currency}</td>
                  <td className="px-3 py-2">{state?.publishedPrice?.toString() ?? "-"} {state?.publishedCurrency ?? currency}</td>
                  <td className="px-3 py-2">{pkg.state?.lastSyncedAt ? formatDate(pkg.state.lastSyncedAt) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nextCursor ? <Link href={`/admin/packages?${new URLSearchParams({ ...(q ? { q } : {}), cursor: nextCursor }).toString()}`} className="text-sm text-teal-700 underline">Next page →</Link> : null}
    </div>
  );
}
