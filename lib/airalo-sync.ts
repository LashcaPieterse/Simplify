import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/db/client";

export type AiraloCatalogEntry = {
  externalId: string;
  name: string;
  dataAmountMb?: number;
  validityDays?: number;
  priceCents: number;
  currency?: string;
  currencyCode?: string;
  isActive?: boolean;
};

async function loadCatalogFromDisk(): Promise<AiraloCatalogEntry[]> {
  const filePath = path.join(process.cwd(), "data", "airalo-packages.json");
  const contents = await fs.readFile(filePath, "utf-8");
  return JSON.parse(contents) as AiraloCatalogEntry[];
}

type PackageDiff = {
  externalId: string;
  name: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
};

type SyncSummary = {
  created: PackageDiff[];
  updated: PackageDiff[];
  deactivated: PackageDiff[];
};

function collectChanges(
  entry: AiraloCatalogEntry,
  existing: {
    id: string;
    name: string;
    dataAmountMb: number | null;
    validityDays: number | null;
    priceCents: number;
    sellingPriceCents: number | null;
    currencyCode: string;
    isActive: boolean;
  },
) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (existing.name !== entry.name) changes.name = { from: existing.name, to: entry.name };
  if (existing.dataAmountMb !== entry.dataAmountMb) changes.dataAmountMb = { from: existing.dataAmountMb, to: entry.dataAmountMb };
  if (existing.validityDays !== entry.validityDays) changes.validityDays = { from: existing.validityDays, to: entry.validityDays };
  if (existing.priceCents !== entry.priceCents) changes.priceCents = { from: existing.priceCents, to: entry.priceCents };
  if (existing.currencyCode !== entry.currencyCode) changes.currencyCode = { from: existing.currencyCode, to: entry.currencyCode };
  return changes;
}

export async function runAiraloSyncJob(actorEmail?: string) {
  const startedAt = new Date();
  const job = await prisma.syncJob.create({
    data: {
      status: "running",
      startedAt,
    },
  });

  const catalog = await loadCatalogFromDisk();
  const existing = await prisma.package.findMany({
    select: {
      id: true,
      externalId: true,
      name: true,
      dataAmountMb: true,
      validityDays: true,
      priceCents: true,
      sellingPriceCents: true,
      currencyCode: true,
      isActive: true,
      deactivatedAt: true,
    },
  });
  const existingByExternalId = new Map(existing.map((pkg) => [pkg.externalId, pkg]));

  const summary: SyncSummary = { created: [], updated: [], deactivated: [] };
  const createdCount = 0;
  let updatedCount = 0;

  for (const entry of catalog) {
    const previous = existingByExternalId.get(entry.externalId);
    const currencyCode = entry.currencyCode ?? entry.currency ?? "USD";
    const normalizedEntry = { ...entry, currencyCode };
    const sellingPriceCents = entry.priceCents + Math.round(entry.priceCents * 0.2);

    if (!previous) {
      console.warn(`[airalo-sync] Skipping package ${entry.externalId} (missing country/operator).`);
      continue;
    }

    const changes = collectChanges(normalizedEntry as AiraloCatalogEntry, previous);
    const hasChanges =
      Object.keys(changes).length > 0 || previous.isActive !== (normalizedEntry.isActive ?? true);
    if (hasChanges) {
      await prisma.package.update({
        where: { id: previous.id },
        data: {
          name: normalizedEntry.name,
          dataAmountMb: normalizedEntry.dataAmountMb ?? null,
          validityDays: normalizedEntry.validityDays,
          priceCents: normalizedEntry.priceCents,
          sellingPriceCents: previous.sellingPriceCents ?? sellingPriceCents,
          currencyCode,
          isActive: normalizedEntry.isActive ?? true,
          deactivatedAt: normalizedEntry.isActive === false ? new Date() : previous.deactivatedAt,
          updatedAt: startedAt,
        },
      });
      updatedCount += 1;
      summary.updated.push({ externalId: entry.externalId, name: entry.name, changes });

      await prisma.auditLog.create({
        data: {
          action: "package.updated",
          entityId: previous.id,
          entityType: "Package",
          details: JSON.stringify({ changes, syncedAt: startedAt.toISOString() }),
        },
      });
    }

    existingByExternalId.delete(entry.externalId);
  }

  const deactivated = Array.from(existingByExternalId.values());
  let deactivatedCount = 0;
  for (const pkg of deactivated) {
    if (!pkg.isActive) continue;
    await prisma.package.update({
      where: { id: pkg.id },
      data: { isActive: false, deactivatedAt: startedAt },
    });
    deactivatedCount += 1;
    summary.deactivated.push({ externalId: pkg.externalId, name: pkg.name });

    await prisma.auditLog.create({
      data: {
        action: "package.deactivated",
        entityId: pkg.id,
        entityType: "Package",
        details: JSON.stringify({ externalId: pkg.externalId, syncedAt: startedAt.toISOString() }),
      },
    });
  }

  const finishedAt = new Date();
  const updatedJob = await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      finishedAt,
      itemsCreated: createdCount,
      itemsUpdated: updatedCount,
      itemsDeactivated: deactivatedCount,
      diffPreview: JSON.stringify(summary, null, 2),
    },
  });

  if (actorEmail) {
    await prisma.auditLog.create({
      data: {
        action: "sync.completed",
        entityId: job.id,
        entityType: "SyncJob",
        details: JSON.stringify({ actorEmail, finishedAt: finishedAt.toISOString() }),
      },
    });
  }

  return { job: updatedJob, summary };
}
