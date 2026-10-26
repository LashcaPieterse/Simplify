import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/client";
import { requireAdminApiSession } from "@/lib/admin/guards";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { readBoundedText } from "@/lib/http/bounded-body";
import { enforceRates, abuseResponse } from "@/lib/security/rate-limit";
import { productionAlertStore, readAlertConfig } from "@/lib/operations/alert-store";
import { findProductionIncidents } from "@/lib/operations/alerts";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const session = await requireAdminApiSession(request);
    if (!session) return NextResponse.json({ message: "Administrator sign-in required." }, { status: 401 });
    await enforceRates([{ scope: "admin-incidents", identifier: session.email, limit: 20, windowSeconds: 60 }]);
    const parsed = z.object({ action: z.enum(["refresh", "acknowledge", "note", "escalate"]), incidentId: z.string().uuid().optional(), note: z.string().trim().max(500).optional(), reference: z.string().trim().max(200).optional() }).safeParse(JSON.parse(await readBoundedText(request, 4096)));
    if (!parsed.success) return NextResponse.json({ message: "Invalid incident action." }, { status: 400 });
    const input = parsed.data;
    if (input.action === "refresh") {
      const config = await readAlertConfig(prisma);
      if (!config) return NextResponse.json({ message: "Alert monitoring has not been configured. Review system health." }, { status: 409 });
      const store = productionAlertStore(prisma, config);
      await store.sync(findProductionIncidents(await store.snapshot(), new Date()));
      return NextResponse.json({ message: "Conditions rechecked. This did not send notifications or change the scheduler heartbeat." });
    }
    if (!input.incidentId || !input.note || input.action === "escalate" && !input.reference) return NextResponse.json({ message: "Record a note and an escalation reference when escalating." }, { status: 400 });
    const incidents = await prisma.$queryRaw<Array<{ alert_key: string }>>`SELECT alert_key FROM recovery_ops.production_alerts WHERE incident_id=${input.incidentId}::uuid AND resolved_at IS NULL`;
    if (!incidents[0]) return NextResponse.json({ message: "The incident changed or resolved. Refresh." }, { status: 409 });
    await prisma.$transaction(async tx => {
      await tx.incidentReview.create({ data: { incidentId: input.incidentId!, alertKey: incidents[0].alert_key, actorEmail: session.email, action: input.action, note: input.note!, reference: input.reference } });
      await tx.auditLog.create({ data: { action: `incident.${input.action}`, entityType: "Incident", entityId: input.incidentId!, details: JSON.stringify({ actor: session.email, reason: input.note, reference: input.reference }) } });
    });
    return NextResponse.json({ message: "Incident review recorded. The warning stays active until its condition clears." });
  } catch (error) { return abuseResponse(error) ?? NextResponse.json({ message: "Incident monitoring is unavailable. Review system health." }, { status: 503 }); }
}
