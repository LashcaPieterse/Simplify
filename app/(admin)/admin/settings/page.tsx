import { formatOpsTime } from "@/lib/admin/queries";
import prisma from "@/lib/db/client";
import { RunSyncButton } from "@/components/admin/RunSyncButton";

export default async function AdminSettingsPage() {
  const latestSuccess = await prisma.syncRun.findFirst({ where: { status: "success" }, orderBy: { finishedAt: "desc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sync settings</h1>
      <div className="rounded border border-slate-200 bg-white p-4 text-sm">
        <p>Storefront and checkout prices come from the synced supplier retail catalogue. Sync runs retain their results and source snapshots for investigation.</p>
      </div>
      <div className="rounded border border-slate-200 bg-white p-4 text-sm">
        <p>Last successful sync: {formatOpsTime(latestSuccess?.finishedAt)}</p>
        <p>Sync frequency: run from cron or use the button below for test runs.</p>
        <div className="mt-3"><RunSyncButton /></div>
      </div>
    </div>
  );
}
