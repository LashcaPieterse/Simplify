import Link from "next/link";
import prisma from "@/lib/db/client";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";

export default async function SyncRunDetailsPage({ params }: { params: { id: string } }) {
  const run = await prisma.syncRun.findUnique({ where: { id: params.id } });
  if (!run) notFound();

  const items = await prisma.syncRunItem.findMany({
    where: { runId: params.id },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  const byType = {
    country: items.filter((item) => item.entityType === "country"),
    operator: items.filter((item) => item.entityType === "operator"),
    package: items.filter((item) => item.entityType === "package"),
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sync run {run.id.slice(0, 8)}</h1>
          <p className="text-sm text-slate-600">Started {formatDate(run.startedAt)} • Status {run.status}</p>
        </div>
        <Link href={`/api/admin/sync-runs/${run.id}/report`} className="rounded bg-slate-100 px-3 py-2 text-sm">Download run report JSON</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Inserted" value={run.insertedCount} />
        <Stat label="Updated" value={run.updatedCount} />
        <Stat label="Skipped" value={run.skippedCount} />
        <Stat label="Failures" value={run.failureCount} />
      </div>
      {(["country", "operator", "package"] as const).map((type) => (
        <section key={type} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold capitalize">{type}s</h2>
          <div className="mt-3 space-y-2 text-xs">
            {byType[type].slice(0, 50).map((item) => (
              <details key={item.id} className="rounded border border-slate-100 p-2">
                <summary className="cursor-pointer font-medium">{item.entityKey} — {item.action}</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2">{JSON.stringify(item.diffJson ?? {}, null, 2)}</pre>
                {item.errorText ? <p className="text-red-600">{item.errorText}</p> : null}
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-semibold">{value}</p></div>;
}
