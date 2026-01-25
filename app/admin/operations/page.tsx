import { BulkPriceEditor } from "@/components/admin/BulkPriceEditor";
import prisma from "@/lib/db/client";
import { formatDate } from "@/lib/format";
import { applyRegionMarkup } from "./actions";

export default async function OperationsPage() {
  const countries = await prisma.country.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const samplePackages = await prisma.package.findMany({
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
      country: { select: { name: true } },
      currencyCode: true,
      priceCents: true,
      sellingPriceCents: true,
    },
  });
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Operations</p>
          <h1 className="text-3xl font-bold text-slate-900">Efficiency toolkit</h1>
          <p className="text-sm text-slate-600">Bulk pricing, tagging, and audit visibility for ops teams.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Country markup</h3>
        <p className="text-sm text-slate-600">Apply a percentage markup to all packages in a country.</p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          action={async (formData) => {
            "use server";
            const countryId = String(formData.get("countryId") ?? "");
            const percent = Number(formData.get("percent"));
            if (countryId && Number.isFinite(percent)) {
              await applyRegionMarkup(countryId, percent);
            }
          }}
        >
          <label className="text-sm font-medium text-slate-700">
            Country
            <select
              name="countryId"
              className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Markup %
            <input
              name="percent"
              type="number"
              step="1"
              defaultValue={20}
              className="mt-2 w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </label>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Apply markup
          </button>
        </form>
      </div>

      <BulkPriceEditor
        packages={samplePackages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          country: pkg.country?.name ?? null,
          currency: pkg.currencyCode,
          priceCents: pkg.priceCents,
          sellingPriceCents: pkg.sellingPriceCents,
        }))}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Audit log</h3>
        <p className="text-sm text-slate-600">Key operational actions.</p>
        <div className="mt-3 divide-y divide-slate-100 text-sm">
          {auditLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-semibold text-slate-900">{log.action}</p>
                <p className="text-xs text-slate-500">{log.entityType} · {log.entityId}</p>
              </div>
              <p className="text-xs text-slate-500">{formatDate(log.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
