import { isSameOriginRequest } from "@/lib/http/same-origin";
import { enforceRates, abuseResponse } from "@/lib/security/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin/guards";
import { runSyncAuditJob } from "@/lib/sync-audit/sync-job";

export const maxDuration = 300;
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await requireAdminApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  await enforceRates([{ scope: "admin-sync", identifier: session.email, limit: 2, windowSeconds: 60 }]);
  const result = await runSyncAuditJob({
    triggeredBy: session.email,
    continueOnError: true,
    notes: "Manual sync run from admin portal",
  });

  return NextResponse.json(result);
  } catch (error) { return abuseResponse(error) ?? NextResponse.json({ error: "Sync could not complete or another sync is running. Inspect Sync Runs before retrying." }, { status: 409 }); }
}
