import { NextRequest, NextResponse } from "next/server";
import { readJsonBody, BodyError } from "@/lib/http/bounded-body";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/admin/guards";
import { isAffiliateSameOrigin } from "@/lib/affiliates/http";
import { affiliateInfrastructureEnabled } from "@/lib/affiliates/referral";
import { reviewAffiliate, saveAffiliateSettings } from "@/lib/affiliates/management";
import { reconcileAffiliateCommissions, setCommissionHold } from "@/lib/affiliates/accounting";
import { deferAffiliatePayout, prepareAffiliatePayout, transitionAffiliatePayout } from "@/lib/affiliates/payouts";
import { deliverAffiliateNotifications } from "@/lib/affiliates/notifications";

const inputSchema = z.record(z.string(), z.string().max(2000));
export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  if (!isAffiliateSameOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  if (!affiliateInfrastructureEnabled()) return NextResponse.json({ message: "Enable affiliate infrastructure after deploying its migration." }, { status: 503 });
  try {
    const parsed = inputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new Error("Invalid form fields.");
    const data = parsed.data;
    const actorEmail = session.email;
    const required = (key: string) => { if (!data[key]?.trim()) throw new Error(`Missing ${key}.`); return data[key].trim(); };
    switch (data.operation) {
      case "settings": await saveAffiliateSettings({ enabled: data.enabled === "on", percentage: data.percentage ?? "", actorEmail }); break;
      case "review": await reviewAffiliate({ id: required("id"), status: required("status"), rateOverride: data.rateOverride ?? "", reason: data.reason ?? "", actorEmail }); break;
      case "refund": case "sale-refund": throw new Error("Open the original payment in Payments to record a verified external refund. Its refund journal applies the affiliate adjustment exactly once.");
      case "hold": await setCommissionHold(required("commissionId"), data.onHold === "true", required("reason"), actorEmail); break;
      case "prepare": await prepareAffiliatePayout(required("affiliateId"), required("currency").toUpperCase(), actorEmail); break;
      case "defer": await deferAffiliatePayout(required("affiliateId"), required("reason"), actorEmail); break;
      case "payout": await transitionAffiliatePayout({ id: required("id"), action: z.enum(["processing", "paid", "cancelled"]).parse(data.action), actorEmail, note: data.note, transferReference: data.transferReference, paidAt: data.paidAt, transferAmount: data.transferAmount, transferCurrency: data.transferCurrency?.toUpperCase(), exchangeRate: data.exchangeRate, fees: data.fees, confirmedNotSent: data.confirmedNotSent === "on" }); break;
      case "reconcile": await reconcileAffiliateCommissions(); await deliverAffiliateNotifications(); break;
      default: throw new Error("Invalid affiliate operation.");
    }
    if (data.operation === "review") { try { await deliverAffiliateNotifications(); } catch { console.error("affiliate.notification.queued"); } }
    return NextResponse.json({ message: "Saved. Balances and records have been refreshed." });
  } catch (error) {
    if (error instanceof BodyError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error && !("code" in error) ? error.message : "Unable to save. Refresh and try again." }, { status: 422 });
  }
}
