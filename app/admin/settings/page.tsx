import prisma from "@/lib/db/client";
import { RunSyncButton } from "@/components/admin/RunSyncButton";

export default async function AdminSettingsPage() {
  const latestSuccess = await prisma.syncRun.findFirst({ where: { status: "success" }, orderBy: { finishedAt: "desc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sync settings</h1>
      <div className="rounded border border-slate-200 bg-white p-4 text-sm">
        <p>Audit thresholds are configured via env vars:</p>
        <ul className="list-disc pl-4">
          <li>PRICING_AUDIT_DELTA_PCT (default 1)</li>
          <li>PRICING_AUDIT_DELTA_ABS (default 0.50)</li>
          <li>DEFAULT_PRICE_MARKUP_PERCENT / DEFAULT_PRICE_MARKUP_FIXED</li>
        </ul>
      </div>
      <div className="rounded border border-slate-200 bg-white p-4 text-sm">
        <p>Last successful sync: {latestSuccess?.finishedAt?.toISOString() ?? "never"}</p>
        <p>Sync frequency: run from cron or use the button below for test runs.</p>
        <div className="mt-3"><RunSyncButton /></div>
      </div>
    </div>
  );
}
