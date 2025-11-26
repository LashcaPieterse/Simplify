/**
 * Background worker to sync Airalo packages every 60 minutes.
 * Run with: npm run airalo:sync:loop
 */
import { setInterval as scheduleInterval } from "node:timers";
import prisma from "../lib/db/client";
import { syncAiraloPackages } from "../lib/catalog/sync";
import { recordPackageSyncResult } from "../lib/observability/metrics";

const INTERVAL_MS = Number.parseInt(process.env.AIRALO_SYNC_INTERVAL_MS ?? "", 10) || 60 * 60 * 1000;
const RUN_ONCE = (process.env.AIRALO_SYNC_RUN_ONCE ?? "false").toLowerCase() === "true";

async function runSync() {
  const startedAt = new Date();
  console.info(`[airalo-sync] Starting sync at ${startedAt.toISOString()}`);

  try {
    const result = await syncAiraloPackages();
    recordPackageSyncResult("success");
    console.info(
      `[airalo-sync] Completed: total=${result.total}, created=${result.created}, updated=${result.updated}, unchanged=${result.unchanged}`,
    );
    return result;
  } catch (error) {
    recordPackageSyncResult("failure");
    console.error("[airalo-sync] Failed to sync Airalo packages", error);
    throw error;
  }
}

async function shutdown(signal: NodeJS.Signals) {
  console.info(`[airalo-sync] Received ${signal}, shutting down...`);
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

async function main() {
  const runSyncSafely = async () => {
    try {
      await runSync();
    } catch (error) {
      console.error("[airalo-sync] Sync execution failed", error);
    }
  };

  await runSyncSafely();

  if (RUN_ONCE) {
    await prisma.$disconnect();
    return;
  }

  const timer = scheduleInterval(runSyncSafely, INTERVAL_MS);
  timer.unref();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error("[airalo-sync] Unhandled error", error);
  await prisma.$disconnect();
  process.exit(1);
});
