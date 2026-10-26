import { NextResponse } from "next/server";

import { runLifecycleTick } from "@/lib/jobs/lifecycle";
import { recoverAiraloOrders } from "@/lib/orders/recovery";
import { authenticateRecoveryRequest } from "@/lib/orders/recovery-auth";
import { reconcileAffiliateCommissions } from "@/lib/affiliates/accounting";
import { deliverAffiliateNotifications } from "@/lib/affiliates/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!authenticateRecoveryRequest(request.headers, process.env.AIRALO_SYNC_CRON_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Accounting continues even when the supplier is unavailable, and cannot invalidate its acknowledgements.
    const recover = process.env.PURCHASE_LIFECYCLE_ENABLED === "true" ? runLifecycleTick() : recoverAiraloOrders({ limit: 5 }).then(result => ({ ...result, ok: true, lifecycleEnabled: false }));
    const [recovery, affiliateWork] = await Promise.allSettled([recover, (async () => {
      const commissions = await reconcileAffiliateCommissions();
      const notifications = await deliverAffiliateNotifications();
      return { ...commissions, notifications };
    })()]);
    if (affiliateWork.status === "rejected") console.error("affiliate.recovery.failed");
    if (recovery.status === "rejected") throw recovery.reason;
    return NextResponse.json({ ...recovery.value, ...(affiliateWork.status === "fulfilled" ? { affiliates: affiliateWork.value } : {}) }, { status: recovery.value.ok && affiliateWork.status === "fulfilled" ? 200 : 503 });
  } catch (error) {
    console.error("Airalo recovery job failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}
