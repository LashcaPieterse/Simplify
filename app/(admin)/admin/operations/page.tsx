import { BulkPriceEditor } from "@/components/admin/BulkPriceEditor";
import prisma from "@/lib/db/client";
import { formatDate } from "@/lib/format";
import { applyRegionMarkup } from "./actions";

export default async function OperationsPage() {
  const productionAlerts = await prisma.$queryRaw<Array<{
    alert_key: string; title: string; detail: string; entity_id: string | null;
    first_seen_at: Date; last_notified_at: Date | null; last_error: string | null;
  }>>`SELECT alert_key, title, detail, entity_id, first_seen_at, last_notified_at, last_error
      FROM recovery_ops.production_alerts WHERE resolved_at IS NULL ORDER BY first_seen_at ASC LIMIT 50`;
  const countries = await prisma.country.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  const samplePackages = await prisma.package.findMany({
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      netPrice: true,
      price: true,
      operator: { select: { country: { select: { title: true } } } },
      state: {
        select: {
          currencyCode: true,
          basePriceCents: true,
          sellingPriceCents: true,
        },
      },
    },
  });
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Operations</p>
          <h1 className="text-3xl font-bold text-slate-900">Efficiency toolkit</h1>
          <p className="text-sm text-slate-600">Bulk pricing, tagging, and audit visibility for ops teams.</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="production-alerts">
        <h2 id="production-alerts" className="text-lg font-semibold text-slate-900">Production alerts</h2>
        <p className="mt-1 text-sm text-slate-600">Delivery, supplier fulfilment, and recovery health are checked every five minutes. Email reminders are limited to once an hour per incident.</p>
        {productionAlerts.length === 0 ? <p className="mt-3 text-sm text-emerald-800">No active incidents.</p> : (
          <ul className="mt-3 divide-y divide-slate-100">
            {productionAlerts.map(alert => <li key={alert.alert_key} className="py-3 text-sm">
              <h3 className="font-semibold text-rose-800">{alert.title}</h3>
              <p className="mt-1 text-slate-700">{alert.detail}</p>
              {alert.entity_id ? <p className="mt-1 break-all text-slate-600">Reference: {alert.entity_id}</p> : null}
              <p className="mt-1 text-xs text-slate-500">First detected: {formatDate(alert.first_seen_at)} · {alert.last_error ? "Email delivery needs attention" : alert.last_notified_at ? `Last emailed: ${formatDate(alert.last_notified_at)}` : "Email pending"}</p>
            </li>)}
          </ul>
        )}
      </section>

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
              className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.title}
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
              className="mt-2 w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <button type="submit" className="button-ribbon-primary rounded-full px-4 py-2 text-sm font-semibold">
            Apply markup
          </button>
        </form>
      </div>

      <BulkPriceEditor
        packages={samplePackages.map((pkg) => ({
          id: pkg.id,
          name: pkg.title,
          country: pkg.operator.country?.title ?? null,
          currency: pkg.state?.currencyCode ?? "USD",
          priceCents:
            pkg.state?.basePriceCents ??
            Math.round(Number(pkg.netPrice ?? pkg.price) * 100),
          sellingPriceCents: pkg.state?.sellingPriceCents ?? null,
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
