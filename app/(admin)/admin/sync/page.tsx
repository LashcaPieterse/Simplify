import Link from "next/link";
import type { Route } from "next";
import { RunSyncButton } from "@/components/admin/RunSyncButton";
import prisma from "@/lib/db/client";
import { formatDate } from "@/lib/format";

export default async function SyncCenterPage() {
  const runs = await prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">Sync Center</p>
          <h1 className="text-3xl font-bold text-slate-900">Airalo integration</h1>
          <p className="text-sm text-slate-600">Run idempotent sync jobs with full snapshots and pricing audits.</p>
        </div>
        <RunSyncButton />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Recent runs</h3>
        <div className="mt-3 space-y-2 text-sm">
          {runs.map((run) => (
            <div key={run.id} className="flex items-center justify-between rounded border border-slate-100 p-2">
              <div>
                <Link className="font-semibold text-teal-700 underline" href={`/admin/sync-runs/${run.id}` as Route}>{run.id.slice(0, 8)}</Link>
                <p className="text-xs text-slate-500">{formatDate(run.startedAt)} • {run.status}</p>
              </div>
              <p className="text-xs">I:{run.insertedCount} U:{run.updatedCount} S:{run.skippedCount} F:{run.failureCount}</p>
            </div>
          ))}
        </div>
        <Link href={"/admin/sync-runs" as Route} className="mt-4 inline-block text-sm text-teal-700 underline">See all runs →</Link>
      </div>
    </div>
  );
}
