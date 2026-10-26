import prisma from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth";
import { formatOpsTime, incidentDestination } from "@/lib/admin/queries";
import { Badge, Empty, OpsLink, PageTitle, Panel } from "@/components/admin/OpsUI";
import { IncidentControls } from "@/components/admin/IncidentControls";

export default async function OperationsPage() {
  await requireAdminSession();
  const result = await Promise.allSettled([
    prisma.$queryRaw<Array<{ alert_key: string; incident_id: string; category: string; title: string; detail: string; entity_id: string | null; first_seen_at: Date; last_seen_at: Date; last_notified_at: Date | null; last_error: string | null }>>`SELECT alert_key, incident_id, category, title, detail, entity_id, first_seen_at, last_seen_at, last_notified_at, last_error FROM recovery_ops.production_alerts WHERE resolved_at IS NULL ORDER BY first_seen_at ASC`,
    prisma.incidentReview.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const alerts = result[0].status === "fulfilled" ? result[0].value : null;
  const reviews = result[1].status === "fulfilled" ? result[1].value : [];
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><PageTitle title="Operations inbox" description="Investigate warnings, recover affected purchases, and track each incident to a verified outcome." /><IncidentControls /></div>
    <div className="flex flex-wrap gap-4 text-sm"><OpsLink href="/admin/payments?filter=attention">Payment attention</OpsLink><OpsLink href="/admin/receipts?filter=attention">Receipt attention</OpsLink><OpsLink href="/admin/orders?filter=supplier">Supplier attention</OpsLink><OpsLink href="/admin/health">System health</OpsLink><OpsLink href="/admin/security">Ownership and security</OpsLink><OpsLink href="/admin/audit">Audit history</OpsLink></div>
    <Panel title={alerts ? `${alerts.length} active incidents` : "Incident monitoring unavailable"}>
      <p className="text-sm text-slate-600">Automatic checks run every five minutes. Acknowledgement records responsibility and keeps the condition active. Email reminders retain their existing hourly limit. Times are shown in Namibia time.</p>
      {!alerts ? <p role="alert" className="text-sm text-rose-800">Incident data could not be loaded. Check database and platform configuration in System health; this does not mean there are no incidents.</p> : !alerts.length ? <Empty>No active incidents in the last completed monitor check. Check System health for heartbeat freshness.</Empty> : alerts.map(alert => {
        const history = reviews.filter(review => review.incidentId === alert.incident_id);
        const acknowledged = history.find(review => review.action === "acknowledge");
        return <article key={alert.incident_id} className="space-y-3 border-t border-brand-100 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-rose-800">{alert.title}</h3><div className="flex gap-2"><Badge>{alert.category.includes("recovery") || alert.category.includes("monitor") ? "Critical · Service health" : alert.category.includes("receipt") || alert.category.includes("affiliate") ? "Medium · Needs review" : "High · Customer impact"}</Badge><Badge>{acknowledged ? "Acknowledged" : "Needs attention"}</Badge></div></div><p className="text-sm text-slate-700">{alert.detail}</p>{alert.entity_id ? <p className="break-all text-xs">Reference: {alert.entity_id}</p> : null}<p className="text-xs text-slate-600">First detected: {formatOpsTime(alert.first_seen_at)} · Last observed: {formatOpsTime(alert.last_seen_at)} · {alert.last_error ? "Alert email requires attention" : alert.last_notified_at ? `Last emailed: ${formatOpsTime(alert.last_notified_at)}` : "Notification pending"}</p><OpsLink href={incidentDestination(alert.category, alert.entity_id)}>Investigate affected records →</OpsLink><details className="rounded-xl border border-brand-100 p-3"><summary className="cursor-pointer text-sm font-medium">Review, notes, and escalation</summary><div className="mt-4 space-y-4"><IncidentControls incidentId={alert.incident_id} />{history.filter(review => review.action !== "detected").map(review => <p key={review.id} className="border-t pt-2 text-xs">{formatOpsTime(review.createdAt)} · {review.actorEmail} · {review.action}<span className="mt-1 block">{review.note}{review.reference ? ` · ${review.reference}` : ""}</span></p>)}</div></details></article>;
      })}
    </Panel><Panel title="Recent incident history">{reviews.length ? reviews.filter(review => ["resolved", "escalate"].includes(review.action)).slice(0, 15).map(review => <p key={review.id} className="border-t py-2 text-sm">{formatOpsTime(review.createdAt)} · {review.alertKey} · <Badge>{review.action}</Badge><span className="mt-1 block text-xs">{review.note}</span></p>) : <Empty>No incident review history recorded.</Empty>}<OpsLink href="/admin/audit">Open full audit history</OpsLink></Panel>
  </div>;
}
