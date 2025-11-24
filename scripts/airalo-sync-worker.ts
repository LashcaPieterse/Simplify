/**
 * Background worker to sync Airalo packages every 60 minutes.
 * Run with: npm run airalo:sync:loop
 */
import { setInterval as scheduleInterval } from "node:timers";
import prisma from "../lib/db/client";
import { syncAiraloPackages } from "../lib/catalog/sync";

const INTERVAL_MS = 60 * 60 * 1000;

async function runSync() {
  const startedAt = new Date();
  console.info(`[airalo-sync] Starting sync at ${startedAt.toISOString()}`);

  try {
    const result = await syncAiraloPackages();
    console.info(
      `[airalo-sync] Completed: total=${result.total}, created=${result.created}, updated=${result.updated}, unchanged=${result.unchanged}`,
    );
  } catch (error) {
    console.error("[airalo-sync] Failed to sync Airalo packages", error);
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
  await runSync(); // initial run
  const timer = scheduleInterval(runSync, INTERVAL_MS);
  timer.unref();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error("[airalo-sync] Unhandled error", error);
  await prisma.$disconnect();
  process.exit(1);
});
