import { NextResponse } from "next/server";
import { readJsonBody, BodyError } from "@/lib/http/bounded-body";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAffiliateSameOrigin } from "@/lib/affiliates/http";
import { applyToAffiliateProgram } from "@/lib/affiliates/management";
import { deliverAffiliateNotifications } from "@/lib/affiliates/notifications";

export async function POST(request: Request) {
  if (!isAffiliateSameOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in to apply." }, { status: 401 });
  try {
    await applyToAffiliateProgram(session.user.id, await readJsonBody(request));
    try { await deliverAffiliateNotifications(); } catch { console.error("affiliate.notification.queued"); }
    return NextResponse.json({ message: "Application received. View its status under Guide earnings in your account." });
  } catch (error) {
    if (error instanceof BodyError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error && !("code" in error) ? error.message : "Applications are temporarily unavailable. Please try again." }, { status: 422 });
  }
}
