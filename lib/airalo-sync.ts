import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/db/client";

export type AiraloCatalogEntry = {
  externalId: string;
  name: string;
  amountMb?: number;
  validityDays?: number;
  price?: number;
  currency?: string;
  isActive?: boolean;
};

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

async function loadCatalogFromDisk(): Promise<AiraloCatalogEntry[]> {
  const filePath = path.join(process.cwd(), "data", "airalo-packages.json");
  const contents = await fs.readFile(filePath, "utf-8");
  return JSON.parse(contents) as AiraloCatalogEntry[];
}

function decimalToCents(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
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
      airaloPackageId: true,
      title: true,
      amount: true,
      day: true,
      price: true,
      state: {
        select: {
          isActive: true,
          deactivatedAt: true,
          currencyCode: true,
          basePriceCents: true,
          sellingPriceCents: true,
        },
      },
    },
  });
  const existingByExternalId = new Map(existing.map((pkg) => [pkg.airaloPackageId, pkg]));

  const summary: SyncSummary = { created: [], updated: [], deactivated: [] };
  let updatedCount = 0;
  let deactivatedCount = 0;

  for (const entry of catalog) {
    const previous = existingByExternalId.get(entry.externalId);
    if (!previous) {
      continue;
    }

    const normalizedPrice = Number(entry.price ?? previous.price ?? 0);
    const normalizedAmount = Number(entry.amountMb ?? previous.amount ?? 0);
    const normalizedDay = Number(entry.validityDays ?? previous.day ?? 0);
    const normalizedCurrency = (entry.currency ?? previous.state?.currencyCode ?? "USD").toUpperCase();
    const normalizedActive = entry.isActive ?? true;
    const sourcePriceCents = decimalToCents(normalizedPrice);
    const nextSell =
      previous.state?.sellingPriceCents ??
      sourcePriceCents + Math.round(sourcePriceCents * 0.2);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (previous.title !== entry.name) changes.title = { from: previous.title, to: entry.name };
    if (previous.amount !== normalizedAmount) changes.amount = { from: previous.amount, to: normalizedAmount };
    if (previous.day !== normalizedDay) changes.day = { from: previous.day, to: normalizedDay };
    if (Number(previous.price) !== normalizedPrice) changes.price = { from: Number(previous.price), to: normalizedPrice };
    if ((previous.state?.currencyCode ?? "USD") !== normalizedCurrency) {
      changes.currencyCode = { from: previous.state?.currencyCode ?? "USD", to: normalizedCurrency };
    }
    if ((previous.state?.isActive ?? true) !== normalizedActive) {
      changes.isActive = { from: previous.state?.isActive ?? true, to: normalizedActive };
    }

    if (Object.keys(changes).length === 0) {
      existingByExternalId.delete(entry.externalId);
      continue;
    }

    await prisma.package.update({
      where: { id: previous.id },
      data: {
        title: entry.name,
        amount: normalizedAmount,
        day: normalizedDay,
        price: normalizedPrice,
        state: {
          upsert: {
            create: {
              isActive: normalizedActive,
              deactivatedAt: normalizedActive ? null : new Date(),
              basePriceCents: sourcePriceCents,
              sellingPriceCents: nextSell,
              currencyCode: normalizedCurrency,
              sourcePriceDecimal: normalizedPrice,
              sellPriceDecimal: nextSell / 100,
              lastSyncedAt: startedAt,
            },
            update: {
              isActive: normalizedActive,
              deactivatedAt: normalizedActive ? null : previous.state?.deactivatedAt ?? new Date(),
              basePriceCents: sourcePriceCents,
              sellingPriceCents: nextSell,
              currencyCode: normalizedCurrency,
              sourcePriceDecimal: normalizedPrice,
              sellPriceDecimal: nextSell / 100,
              lastSyncedAt: startedAt,
              updatedAt: startedAt,
            },
          },
        },
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

    existingByExternalId.delete(entry.externalId);
  }

  const deactivated = Array.from(existingByExternalId.values());
  for (const pkg of deactivated) {
    if (!pkg.state?.isActive) continue;
    await prisma.packageState.updateMany({
      where: { packageId: pkg.id, isActive: true },
      data: { isActive: false, deactivatedAt: startedAt },
    });
    deactivatedCount += 1;
    summary.deactivated.push({ externalId: pkg.airaloPackageId, name: pkg.title });

    await prisma.auditLog.create({
      data: {
        action: "package.deactivated",
        entityId: pkg.id,
        entityType: "Package",
        details: JSON.stringify({ externalId: pkg.airaloPackageId, syncedAt: startedAt.toISOString() }),
      },
    });
  }

  const finishedAt = new Date();
  const updatedJob = await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      finishedAt,
      itemsCreated: 0,
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
