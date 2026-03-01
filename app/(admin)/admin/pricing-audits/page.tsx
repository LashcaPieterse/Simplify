import prisma from "@/lib/db/client";
import { resolvePricingAuditAction } from "./server-actions";

export default async function PricingAuditsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const severity = typeof searchParams.severity === "string" ? searchParams.severity : undefined;
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const audits = await prisma.pricingAudit.findMany({
    where: {
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Pricing audits</h1>
      <form className="flex gap-2">
        <select name="severity" defaultValue={severity ?? ""} className="rounded border border-slate-200 px-3 py-2 text-sm"><option value="">All severities</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
        <select name="status" defaultValue={status ?? ""} className="rounded border border-slate-200 px-3 py-2 text-sm"><option value="">All statuses</option><option value="open">open</option><option value="ignored">ignored</option><option value="resolved">resolved</option></select>
        <button className="rounded bg-teal-600 px-3 py-2 text-sm text-white">Apply</button>
      </form>
      <div className="space-y-2">
        {audits.map((audit) => (
          <div key={audit.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold">{audit.packageAiraloId} • {audit.severity} • {audit.status}</p>
            <p>source={audit.sourcePrice.toString()} db={audit.dbPrice?.toString() ?? "-"} published={audit.publishedPrice?.toString() ?? "-"} {audit.currency}</p>
            <p>deltaAbs={audit.deltaAbs.toString()} deltaPct={audit.deltaPct.toString()}%</p>
            <form action={resolvePricingAuditAction} className="mt-2 flex gap-2">
              <input type="hidden" name="id" value={audit.id} />
              <button name="action" value="resolved" className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Mark resolved</button>
              <button name="action" value="ignored" className="rounded bg-amber-600 px-2 py-1 text-xs text-white">Ignore</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
