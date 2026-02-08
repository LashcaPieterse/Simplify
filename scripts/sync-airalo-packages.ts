/**
 * Synchronizes the Airalo catalog with the local database.
 *
 * Recommended cadence: run this script every 60 minutes via cron or a background worker
 * to keep pricing and availability fresh without overwhelming the upstream API.
 */
import { syncAiraloCatalog } from "../lib/catalog/sync";
import prisma from "../lib/db/client";

async function main() {
  try {
    const result = await syncAiraloCatalog();

    console.log(
      [
        `Countries - created: ${result.countriesCreated}, updated: ${result.countriesUpdated}`,
        `Operators - created: ${result.operatorsCreated}, updated: ${result.operatorsUpdated}`,
        `Packages - created: ${result.packagesCreated}, updated: ${result.packagesUpdated}, unchanged: ${result.packagesUnchanged}, deactivated: ${result.packagesDeactivated}`,
      ].join(" | "),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to sync Airalo packages", error);
  process.exit(1);
});
