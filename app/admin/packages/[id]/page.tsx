import { notFound } from "next/navigation";
import { SimpleLineChart } from "@/components/admin/SimpleLineChart";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TagPill } from "@/components/admin/TagPill";
import prisma from "@/lib/db/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { addNote, saveTags, updateSellingPrice, updateStatus } from "./actions";

function margin(base?: number | null, selling?: number | null) {
  if (!base || !selling) return 0;
  return Math.round(((selling - base) / base) * 100);
}

export default async function PackageDetailPage({ params }: { params: { id: string } }) {
  const pkg = await prisma.airaloPackage.findUnique({
    where: { id: params.id },
    include: { tags: { include: { tag: true } }, notes: true, esimOrders: true },
  });

  if (!pkg) {
    notFound();
  }

  const revenue = pkg.esimOrders.reduce((sum, order) => sum + (order.totalCents ?? 0), 0);
  const units = pkg.esimOrders.reduce((sum, order) => sum + order.quantity, 0);
  const profit = pkg.esimOrders.reduce((sum, order) => {
    const selling = order.totalCents ?? (pkg.sellingPriceCents ?? pkg.priceCents) * order.quantity;
    const base = pkg.priceCents * order.quantity;
    return sum + (selling - base);
  }, 0);

  const salesByDate = pkg.esimOrders.reduce<Record<string, number>>((acc, order) => {
    const date = order.createdAt.toISOString().slice(0, 10);
    acc[date] = (acc[date] ?? 0) + (order.totalCents ?? 0);
    return acc;
  }, {});

  const linePoints = Object.entries(salesByDate)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Package</p>
          <h1 className="text-3xl font-bold text-slate-900">{pkg.name}</h1>
          <p className="text-sm text-slate-600">
            {pkg.country} • {pkg.region ?? "Global"} • {pkg.dataLimitMb ? `${Math.round(pkg.dataLimitMb / 1000)}GB` : "N/A"} •
            {pkg.validityDays ? `${pkg.validityDays} days` : "Flexible"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge active={pkg.isActive} />
            {pkg.tags.map((t) => (
              <TagPill key={t.tagId} label={t.tag.name} />
            ))}
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await updateStatus(pkg.id, !pkg.isActive);
          }}
        >
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ${pkg.isActive ? "border border-slate-200 bg-white text-slate-800" : "bg-teal-600 text-white"}`}
          >
            {pkg.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900">Pricing</h3>
          <p className="text-sm text-slate-600">Override selling price to control margin.</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-slate-600">Base price</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(pkg.priceCents, pkg.currency)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-slate-600">Current selling price</dt>
              <dd className="text-lg font-semibold text-slate-900">
                {pkg.sellingPriceCents ? formatCurrency(pkg.sellingPriceCents, pkg.currency) : "Set a price"}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-slate-600">Margin</dt>
              <dd className="text-lg font-semibold text-slate-900">{margin(pkg.priceCents, pkg.sellingPriceCents)}%</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-slate-600">Profit / unit</dt>
              <dd className="text-lg font-semibold text-slate-900">
                {pkg.sellingPriceCents
                  ? formatCurrency((pkg.sellingPriceCents ?? 0) - pkg.priceCents, pkg.currency)
                  : formatCurrency(0, pkg.currency)}
              </dd>
            </div>
          </dl>
          <form
            className="mt-6 flex items-end gap-3"
            action={async (formData) => {
              "use server";
              const sellingPrice = Number(formData.get("sellingPrice")) * 100;
              if (Number.isFinite(sellingPrice)) {
                await updateSellingPrice(pkg.id, Math.round(sellingPrice));
              }
            }}
          >
            <label className="flex-1 text-sm font-medium text-slate-700">
              Set selling price ({pkg.currency})
              <input
                name="sellingPrice"
                type="number"
                step="0.01"
                defaultValue={pkg.sellingPriceCents ? pkg.sellingPriceCents / 100 : ""}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Eg. 14.99"
              />
            </label>
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              Save
            </button>
          </form>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Operations</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>External ID: {pkg.externalId}</p>
            <p>Last synced: {pkg.lastSyncedAt ? formatDate(pkg.lastSyncedAt) : "—"}</p>
            <p>Last updated: {formatDate(pkg.updatedAt)}</p>
            <p>Deactivated at: {pkg.deactivatedAt ? formatDate(pkg.deactivatedAt) : "—"}</p>
          </div>
          <form
            className="mt-4 space-y-3"
            action={async (formData) => {
              "use server";
              const raw = String(formData.get("tags") ?? "");
              const tags = raw.split(",").map((t) => t.trim());
              await saveTags(pkg.id, tags);
            }}
          >
            <label className="text-sm font-medium text-slate-700">
              Tags (comma separated)
              <input
                name="tags"
                defaultValue={pkg.tags.map((t) => t.tag.name).join(", ")}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </label>
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm">
              Save tags
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900">Sales over time</h3>
          <p className="text-sm text-slate-600">Aggregated by day.</p>
          <div className="mt-4 h-64">
            <SimpleLineChart points={linePoints} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Package totals</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-slate-600">Units sold</dt>
              <dd className="text-lg font-semibold text-slate-900">{units}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-slate-600">Total revenue</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(revenue, pkg.currency)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-slate-600">Total profit</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatCurrency(profit, pkg.currency)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Internal notes</h3>
          <p className="text-sm text-slate-600">Share context for ops teams.</p>
          <form
            className="mt-4 space-y-3"
            action={async (formData) => {
              "use server";
              const body = String(formData.get("note") ?? "");
              if (body.length > 0) {
                await addNote(pkg.id, body);
              }
            }}
          >
            <textarea
              name="note"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              placeholder="Add context or operational notes..."
            />
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              Save note
            </button>
          </form>
          <div className="mt-4 space-y-3">
            {pkg.notes.length === 0 ? (
              <p className="text-sm text-slate-500">No notes yet.</p>
            ) : (
              pkg.notes
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .map((note) => (
                  <div key={note.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    <p>{note.body}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(note.createdAt)}</p>
                  </div>
                ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent orders</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {pkg.esimOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No orders yet.</p>
            ) : (
              pkg.esimOrders
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, 6)
                .map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <p className="font-semibold text-slate-900">Order {order.id.slice(0, 6)}</p>
                      <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {order.totalCents ? formatCurrency(order.totalCents, pkg.currency) : "—"}
                      </p>
                      <p className="text-xs text-slate-500">Qty {order.quantity}</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
