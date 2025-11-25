import { RunSyncButton } from "@/components/admin/RunSyncButton";
import prisma from "@/lib/db/client";
import { formatDate } from "@/lib/format";

type SyncDiff = {
  created: { externalId: string; name: string }[];
  updated: { externalId: string; name: string; changes?: Record<string, { from: unknown; to: unknown }> }[];
  deactivated: { externalId: string; name: string }[];
};

export default async function SyncCenterPage() {
  const jobs = await prisma.syncJob.findMany({ orderBy: { startedAt: "desc" }, take: 8 });
  const latest = jobs[0];
  const diffPreview = latest?.diffPreview ? (JSON.parse(latest.diffPreview) as SyncDiff) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Sync Center</p>
          <h1 className="text-3xl font-bold text-slate-900">Airalo integration</h1>
          <p className="text-sm text-slate-600">Keep Simplify packages aligned with the upstream catalog.</p>
        </div>
        <RunSyncButton />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent sync jobs</h3>
          <p className="text-sm text-slate-600">Most recent runs, newest first.</p>
          <div className="mt-3 divide-y divide-slate-100 text-sm">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold text-slate-900">{formatDate(job.startedAt)}</p>
                  <p className="text-xs text-slate-500">Status: {job.status}</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p>Created: {job.itemsCreated}</p>
                  <p>Updated: {job.itemsUpdated}</p>
                  <p>Deactivated: {job.itemsDeactivated}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Latest diff preview</h3>
          <p className="text-sm text-slate-600">New packages, price changes, and removals.</p>
          <div className="mt-4 space-y-4 text-sm text-slate-800">
            {!diffPreview ? (
              <p className="text-slate-500">Run a sync to see the diff.</p>
            ) : (
              <>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">New</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {diffPreview.created.map((item) => (
                      <li key={item.externalId}>{item.name}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Updated</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {diffPreview.updated.map((item) => (
                      <li key={item.externalId}>
                        {item.name}
                        {item.changes ? (
                          <span className="text-xs text-slate-500"> ({Object.keys(item.changes).join(", ")})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Deactivated</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {diffPreview.deactivated.map((item) => (
                      <li key={item.externalId}>{item.name}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
