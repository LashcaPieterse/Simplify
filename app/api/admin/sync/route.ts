import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin/guards";
import { runSyncAuditJob } from "@/lib/sync-audit/sync-job";

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSyncAuditJob({
    triggeredBy: session.email,
    continueOnError: true,
    notes: "Manual sync run from admin portal",
  });

  return NextResponse.json(result);
}
