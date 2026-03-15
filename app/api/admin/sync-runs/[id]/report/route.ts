import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";
import { requireAdminApiSession } from "@/lib/admin/guards";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const MAX_ENTITY_SNAPSHOTS = 500;

  const [run, items, responseSnapshots, entitySnapshots, totalEntitySnapshots, audits] = await Promise.all([
    prisma.syncRun.findUnique({ where: { id: params.id } }),
    prisma.syncRunItem.findMany({ where: { runId: params.id }, orderBy: { createdAt: "asc" } }),
    prisma.entitySnapshot.findMany({
      where: { runId: params.id, entityType: "airalo_response" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.entitySnapshot.findMany({
      where: { runId: params.id, NOT: { entityType: "airalo_response" } },
      orderBy: { createdAt: "asc" },
      take: MAX_ENTITY_SNAPSHOTS,
    }),
    prisma.entitySnapshot.count({
      where: { runId: params.id, NOT: { entityType: "airalo_response" } },
    }),
    prisma.pricingAudit.findMany({ where: { runId: params.id }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const snapshots = [...responseSnapshots, ...entitySnapshots].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return NextResponse.json({ run, items, snapshots, audits, snapshotLimits: { entitySnapshots: MAX_ENTITY_SNAPSHOTS, totalEntitySnapshots } }, {
    headers: { "content-disposition": `attachment; filename=sync-run-${params.id}.json` },
  });
}
