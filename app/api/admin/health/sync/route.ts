import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin/guards";
import prisma from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAdminApiSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const latest = await prisma.syncRun.findFirst({ where: { status: "success" }, orderBy: { finishedAt: "desc" } });
    return NextResponse.json({
      ok: Boolean(latest),
      lastSuccessfulSyncAt: latest?.finishedAt ?? null,
      runId: latest?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health check error";
    // Deploy-safe fallback while migrations are rolling out.
    return NextResponse.json({
      ok: false,
      lastSuccessfulSyncAt: null,
      runId: null,
      warning: message,
    });
  }
}
