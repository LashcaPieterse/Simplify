import Link from "next/link";
import type { Route } from "next";
import prisma from "@/lib/db/client";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

export default async function SyncRunsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const cursor = typeof searchParams.cursor === "string" ? searchParams.cursor : undefined;

  const runs = await prisma.syncRun.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasNext = runs.length > PAGE_SIZE;
  const items = hasNext ? runs.slice(0, PAGE_SIZE) : runs;
  const nextCursor = hasNext ? items[items.length - 1].id : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sync runs</h1>
          <p className="text-sm text-slate-600">Trace all Airalo synchronization jobs.</p>
        </div>
      </div>
      <form className="flex gap-2" method="get">
        <select name="status" defaultValue={status ?? ""} className="rounded border border-slate-200 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <button className="rounded bg-teal-600 px-3 py-2 text-sm text-white">Apply</button>
      </form>
      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Run</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Started</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Counts</th>
            </tr>
          </thead>
          <tbody>
            {items.map((run) => {
              const duration = run.finishedAt ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000) : null;
              return (
                <tr key={run.id} className="border-t border-slate-100">
                  <td className="px-3 py-2"><Link className="text-teal-700 underline" href={`/admin/sync-runs/${run.id}` as Route}>{run.id.slice(0, 8)}</Link></td>
                  <td className="px-3 py-2">{run.status}</td>
                  <td className="px-3 py-2">{formatDate(run.startedAt)}</td>
                  <td className="px-3 py-2">{duration === null ? "-" : `${duration}s`}</td>
                  <td className="px-3 py-2">I:{run.insertedCount} U:{run.updatedCount} S:{run.skippedCount} E:{run.failureCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nextCursor ? <Link className="text-sm text-teal-700 underline" href={`/admin/sync-runs?${new URLSearchParams({ ...(status ? { status } : {}), cursor: nextCursor }).toString()}` as Route}>Next page →</Link> : null}
    </div>
  );
}
