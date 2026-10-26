import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";
import { requireAdminApiSession } from "@/lib/admin/guards";
import { validateAdminCredentials } from "@/lib/auth";
import { operationInputSchema } from "@/lib/admin/financial";
import { executeOperation } from "@/lib/admin/operations";
import { refreshedEligibility } from "@/lib/admin/eligibility";
import { FINANCIAL_KINDS, OperationError } from "@/lib/admin/operations-types";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { readBoundedText, BodyError } from "@/lib/http/bounded-body";
import { enforceRates, refundRates, trustedClientIp, abuseResponse } from "@/lib/security/rate-limit";

export const maxDuration = 300;
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const session = await requireAdminApiSession(request);
    if (!session) return NextResponse.json({ message: "Administrator sign-in required." }, { status: 401 });
    const raw: unknown = JSON.parse(await readBoundedText(request, 8192));
    const parsed = operationInputSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    await enforceRates([{ scope: "admin-operations", identifier: session.email, limit: 30, windowSeconds: 60 }]);
    if (FINANCIAL_KINDS.has(parsed.data.kind)) {
      const passwordRates = await enforceRates([{ scope: "admin-finance-password", identifier: trustedClientIp(request.headers), limit: 5, windowSeconds: 900 }, { scope: "admin-finance-password-account", identifier: session.email, limit: 20, windowSeconds: 3600 }]);
      const password = typeof raw === "object" && raw !== null && "password" in raw ? raw.password : null;
      if (typeof password !== "string" || password.length > 1024 || !validateAdminCredentials(session.email, password)) return NextResponse.json({ message: "Confirm your administrator password to authorize this financial action." }, { status: 403 });
      await refundRates(passwordRates);
    }
    const result = await executeOperation(prisma, parsed.data, session.email);
    // A follow-up read must not turn a completed provider operation into a failed
    // request. Null explicitly means eligibility could not be refreshed.
    const eligibility = await refreshedEligibility(prisma, parsed.data).catch(() => null);
    return NextResponse.json({ ...result, eligibility }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const limited = abuseResponse(error); if (limited) return limited;
    return NextResponse.json({ message: error instanceof OperationError ? error.message : error instanceof BodyError ? "Invalid request body." : "The action could not be completed. Refresh the record before retrying." }, { status: error instanceof OperationError ? 409 : error instanceof BodyError ? error.status : 503 });
  }
}
