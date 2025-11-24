import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/db/client";

export type AiraloCatalogEntry = {
  externalId: string;
  name: string;
  country?: string;
  countryCode?: string;
  region?: string;
  dataLimitMb?: number;
  validityDays?: number;
  priceCents: number;
  currency: string;
  isActive?: boolean;
};

function entryHash(entry: AiraloCatalogEntry) {
  return crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex");
}

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

function collectChanges(entry: AiraloCatalogEntry, existing: typeof entry & { id: string; sellingPriceCents: number | null }) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (existing.name !== entry.name) changes.name = { from: existing.name, to: entry.name };
  if (existing.region !== entry.region) changes.region = { from: existing.region, to: entry.region };
  if (existing.country !== entry.country) changes.country = { from: existing.country, to: entry.country };
  if (existing.countryCode !== entry.countryCode) changes.countryCode = { from: existing.countryCode, to: entry.countryCode };
  if (existing.dataLimitMb !== entry.dataLimitMb) changes.dataLimitMb = { from: existing.dataLimitMb, to: entry.dataLimitMb };
  if (existing.validityDays !== entry.validityDays) changes.validityDays = { from: existing.validityDays, to: entry.validityDays };
  if (existing.priceCents !== entry.priceCents) changes.priceCents = { from: existing.priceCents, to: entry.priceCents };
  if (existing.currency !== entry.currency) changes.currency = { from: existing.currency, to: entry.currency };
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
  const existing = await prisma.airaloPackage.findMany();
  const existingByExternalId = new Map(existing.map((pkg) => [pkg.externalId, pkg]));

  const summary: SyncSummary = { created: [], updated: [], deactivated: [] };
  let createdCount = 0;
  let updatedCount = 0;

  for (const entry of catalog) {
    const previous = existingByExternalId.get(entry.externalId);
    const nowHash = entryHash(entry);
    const sellingPriceCents = entry.priceCents + Math.round(entry.priceCents * 0.2);

    if (!previous) {
      const created = await prisma.airaloPackage.create({
        data: {
          externalId: entry.externalId,
          name: entry.name,
          country: entry.country,
          countryCode: entry.countryCode,
          region: entry.region,
          dataLimitMb: entry.dataLimitMb,
          validityDays: entry.validityDays,
          priceCents: entry.priceCents,
          sellingPriceCents,
          currency: entry.currency,
          isActive: entry.isActive ?? true,
          lastSyncedAt: startedAt,
          sourceHash: nowHash,
          lastSyncJobId: job.id,
        },
      });
      createdCount += 1;
      summary.created.push({ externalId: entry.externalId, name: entry.name });

      await prisma.auditLog.create({
        data: {
          action: "package.created",
          entityId: created.id,
          entityType: "AiraloPackage",
          details: JSON.stringify({ externalId: entry.externalId, syncedAt: startedAt.toISOString() }),
        },
      });
      continue;
    }

    const changes = collectChanges(entry, previous as AiraloCatalogEntry & { id: string; sellingPriceCents: number | null });
    const hasChanges = Object.keys(changes).length > 0 || previous.sourceHash !== nowHash || previous.isActive !== entry.isActive;
    if (hasChanges) {
      await prisma.airaloPackage.update({
        where: { id: previous.id },
        data: {
          name: entry.name,
          country: entry.country,
          countryCode: entry.countryCode,
          region: entry.region,
          dataLimitMb: entry.dataLimitMb,
          validityDays: entry.validityDays,
          priceCents: entry.priceCents,
          sellingPriceCents: previous.sellingPriceCents ?? sellingPriceCents,
          currency: entry.currency,
          isActive: entry.isActive ?? true,
          lastSyncedAt: startedAt,
          sourceHash: nowHash,
          lastSyncJobId: job.id,
          deactivatedAt: entry.isActive === false ? new Date() : previous.deactivatedAt,
        },
      });
      updatedCount += 1;
      summary.updated.push({ externalId: entry.externalId, name: entry.name, changes });

      await prisma.auditLog.create({
        data: {
          action: "package.updated",
          entityId: previous.id,
          entityType: "AiraloPackage",
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
    await prisma.airaloPackage.update({
      where: { id: pkg.id },
      data: { isActive: false, deactivatedAt: startedAt, lastSyncJobId: job.id },
    });
    deactivatedCount += 1;
    summary.deactivated.push({ externalId: pkg.externalId, name: pkg.name });

    await prisma.auditLog.create({
      data: {
        action: "package.deactivated",
        entityId: pkg.id,
        entityType: "AiraloPackage",
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
