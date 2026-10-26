import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { listParams, PAGE_SIZE, formatOpsTime } from "@/lib/admin/queries";
import { Empty, OperationsHistory, OpsLink, PageTitle, Pagination, Panel } from "@/components/admin/OpsUI";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession(); const { q, filter, page } = listParams(await searchParams);
  const contains = { contains: q, mode: "insensitive" as const };
  const where = { AND: [q ? { OR: [{ id: contains }, { targetId: contains }, { actorEmail: contains }, { reason: contains }, { reference: contains }] } : {}, filter === "unresolved" ? { OR: [{ status: { in: ["provider_pending", "unknown"] } }, { status: "running", leaseUntil: { lte: new Date() } }] } : {}] };
  const [operations, count, logs, incidents] = await Promise.all([
    prisma.adminOperation.findMany({ where, orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }), prisma.adminOperation.count({ where }),
    prisma.auditLog.findMany({ where: q ? { OR: [{ action: contains }, { entityId: contains }, { details: contains }] } : {}, take: 25, orderBy: { createdAt: "desc" } }),
    prisma.incidentReview.findMany({ where: q ? { OR: [{ actorEmail: contains }, { alertKey: contains }, { note: contains }, { reference: contains }] } : {}, take: 25, orderBy: { createdAt: "desc" } }),
  ]);
  return <div className="space-y-6"><PageTitle title="Audit and reconciliation" description="Search operator actions, saved provider requests, incident reviews, and operational history. The shared administrator account is the audit identity." /><form className="flex flex-wrap gap-3"><label className="min-w-48 flex-1 text-sm">Search<input name="q" defaultValue={q} placeholder="Reference, target, actor or reason" className="mt-1 block min-h-11 w-full rounded-xl border bg-white p-3" /></label><label className="text-sm">State<select name="filter" defaultValue={filter} className="mt-1 block min-h-11 rounded-xl border bg-white p-3"><option value="">All operations</option><option value="unresolved">Pending or uncertain</option></select></label><button className="self-end rounded-full bg-brand-900 px-5 py-3 text-white">Search</button></form><p className="text-sm">{count} matching operations</p>
    <OperationsHistory operations={operations} /><Pagination page={page} hasNext={page * PAGE_SIZE < count} path="/admin/audit" q={q} filter={filter} />
    <Panel title="Recent incident reviews">{incidents.length ? incidents.map(item => <p key={item.id} className="border-t py-3 text-sm">{formatOpsTime(item.createdAt)} · {item.action} · {item.alertKey}<span className="mt-1 block">{item.actorEmail} · {item.note}{item.reference ? ` · ${item.reference}` : ""}</span></p>) : <Empty />}</Panel>
    <Panel title="Recent audit entries">{logs.length ? logs.map(log => { let reason = ""; try { const details = JSON.parse(log.details ?? "{}"); if (typeof details.reason === "string") reason = details.reason.slice(0, 500); } catch { /* Legacy details are not safe to render wholesale. */ } return <div key={log.id} className="border-t py-3 text-sm"><p>{formatOpsTime(log.createdAt)} · {log.action}</p><p className="break-all text-xs text-slate-600">{log.entityType} · {log.entityId}</p>{reason ? <p>{reason}</p> : null}</div>; }) : <Empty />}<OpsLink href="/admin/operations">Return to incident inbox</OpsLink></Panel>
  </div>;
}
