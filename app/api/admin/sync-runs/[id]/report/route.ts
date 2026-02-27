import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";
import { requireAdminApiSession } from "@/lib/admin/guards";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [run, items, snapshots, audits] = await Promise.all([
    prisma.syncRun.findUnique({ where: { id: params.id } }),
    prisma.syncRunItem.findMany({ where: { runId: params.id }, orderBy: { createdAt: "asc" } }),
    prisma.entitySnapshot.findMany({ where: { runId: params.id }, orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.pricingAudit.findMany({ where: { runId: params.id }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  return NextResponse.json({ run, items, snapshots, audits }, {
    headers: { "content-disposition": `attachment; filename=sync-run-${params.id}.json` },
  });
}
