import { NextResponse } from "next/server";
import prisma from "@/lib/db/client";

export async function GET() {
  const latest = await prisma.syncRun.findFirst({ where: { status: "success" }, orderBy: { finishedAt: "desc" } });
  return NextResponse.json({
    ok: Boolean(latest),
    lastSuccessfulSyncAt: latest?.finishedAt ?? null,
    runId: latest?.id ?? null,
  });
}
