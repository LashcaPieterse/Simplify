import Link from "next/link";
import type { Route } from "next";
import prisma from "@/lib/db/client";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";

export default async function SyncRunDetailsPage({ params }: { params: { id: string } }) {
  const [run, items, responseSnapshots, packageSnapshots] = await Promise.all([
    prisma.syncRun.findUnique({ where: { id: params.id } }),
    prisma.syncRunItem.findMany({
      where: { runId: params.id },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    prisma.entitySnapshot.findMany({
      where: { runId: params.id, entityType: "airalo_response" },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.entitySnapshot.findMany({
      where: { runId: params.id, entityType: "package" },
      orderBy: [{ createdAt: "desc" }],
      take: 1000,
    }),
  ]);

  if (!run) notFound();

  const byType = {
    country: items.filter((item) => item.entityType === "country"),
    operator: items.filter((item) => item.entityType === "operator"),
    package: items.filter((item) => item.entityType === "package"),
  };
  const packageSnapshotByKey = new Map<string, (typeof packageSnapshots)[number]>();
  for (const snapshot of packageSnapshots) {
    if (!packageSnapshotByKey.has(snapshot.entityKey)) {
      packageSnapshotByKey.set(snapshot.entityKey, snapshot);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sync run {run.id.slice(0, 8)}</h1>
          <p className="text-sm text-slate-600">Started {formatDate(run.startedAt)} • Status {run.status}</p>
        </div>
        <Link href={`/api/admin/sync-runs/${run.id}/report` as Route} className="rounded bg-slate-100 px-3 py-2 text-sm">Download run report JSON</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Inserted" value={run.insertedCount} />
        <Stat label="Updated" value={run.updatedCount} />
        <Stat label="Skipped" value={run.skippedCount} />
        <Stat label="Failures" value={run.failureCount} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Airalo API Responses</h2>
        <p className="mt-1 text-xs text-slate-500">Raw `/packages` responses captured page-by-page for this run.</p>
        <div className="mt-3 space-y-2 text-xs">
          {responseSnapshots.length === 0 ? (
            <p className="rounded border border-dashed border-slate-200 p-3 text-slate-500">No raw Airalo response snapshots were captured for this run.</p>
          ) : (
            responseSnapshots.map((snapshot) => {
              const meta = extractSnapshotMeta(snapshot.normalizedJson);
              return (
                <details key={snapshot.id} className="rounded border border-slate-100 p-2">
                  <summary className="cursor-pointer font-medium">
                    Page {typeof meta.page === "number" ? meta.page : "?"} — {snapshot.entityKey}
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2">{JSON.stringify(snapshot.normalizedJson ?? {}, null, 2)}</pre>
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2">{JSON.stringify(snapshot.rawPayloadJson ?? {}, null, 2)}</pre>
                </details>
              );
            })
          )}
        </div>
      </section>

      {(["country", "operator", "package"] as const).map((type) => (
        <section key={type} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold capitalize">{type}s</h2>
          <div className="mt-3 space-y-2 text-xs">
            {byType[type].slice(0, 50).map((item) => (
              <details key={item.id} className="rounded border border-slate-100 p-2">
                <summary className="cursor-pointer font-medium">{item.entityKey} — {item.action}</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2">{JSON.stringify(item.diffJson ?? {}, null, 2)}</pre>
                {type === "package" && packageSnapshotByKey.has(item.entityKey) ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2">
                    {JSON.stringify(packageSnapshotByKey.get(item.entityKey)?.rawPayloadJson ?? {}, null, 2)}
                  </pre>
                ) : null}
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

function extractSnapshotMeta(value: unknown): { page?: number } {
  if (!value || typeof value !== "object") {
    return {};
  }

  const page = (value as Record<string, unknown>).page;
  if (typeof page !== "number") {
    return {};
  }

  return { page };
}
